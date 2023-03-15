# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import fields, models
from odoo.addons.sale_subscription.models.sale_order import SUBSCRIPTION_STATES

class SaleSubscriptionReport(models.Model):
    _inherit = "sale.report"
    _name = "sale.subscription.report"
    _description = "Subscription Analysis"
    _auto = False

    client_order_ref = fields.Char(string="Customer Reference", readonly=False)
    first_contract_date = fields.Date(string='First contract date', readonly=True)
    end_date = fields.Date('End Date', readonly=True)
    recurring_monthly = fields.Float('Monthly Recurring', readonly=True)
    recurring_yearly = fields.Float('Yearly Recurring', readonly=True)
    recurring_total = fields.Float('Recurring Revenue', readonly=True)
    is_subscription = fields.Boolean(readonly=True)
    template_id = fields.Many2one('sale.order.template', 'Subscription Template', readonly=True)
    country_id = fields.Many2one('res.country', 'Country', readonly=True)
    commercial_partner_id = fields.Many2one('res.partner', 'Customer Company', readonly=True)
    industry_id = fields.Many2one('res.partner.industry', 'Industry', readonly=True)
    close_reason_id = fields.Many2one('sale.order.close.reason', 'Close Reason', readonly=True)
    margin = fields.Float() # not used but we want to avoid creating a bridge module for nothing
    subscription_state = fields.Selection(SUBSCRIPTION_STATES, readonly=True)
    health = fields.Selection([
        ('normal', 'Neutral'),
        ('done', 'Good'),
        ('bad', 'Bad')], string="Health", readonly=True)
    next_invoice_date = fields.Date('Next Invoice Date', readonly=True)
    recurrence_id = fields.Many2one('sale.temporal.recurrence', 'Recurrence', readonly=True)
    origin_order_id = fields.Many2one('sale.order', string='First contract', readonly=True)

    def _select_additional_fields(self):
        res = super()._select_additional_fields()
        res['is_subscription'] = "s.is_subscription"
        res['subscription_state'] = "s.subscription_state"
        res['end_date'] = "s.end_date"
        res['first_contract_date'] = "s.first_contract_date"
        res['health'] = "s.health"
        res['template_id'] = "s.sale_order_template_id"
        res['close_reason_id'] = "s.close_reason_id"
        res['next_invoice_date'] = "s.next_invoice_date"
        res['recurrence_id'] = "s.recurrence_id"
        res['origin_order_id'] = "s.origin_order_id"
        res['client_order_ref'] = "s.client_order_ref"
        res['margin'] = 0
        res['recurring_monthly'] = f"""
                    SUM(
                        coalesce(
                         CASE WHEN t.recurring_invoice THEN l.price_subtotal ELSE 0 END
                          / nullif(rc.recurring_subtotal, 0), 0
                        )
                        * s.recurring_monthly
                        * {self._case_value_or_one('s.currency_rate')}
                        * {self._case_value_or_one('currency_table.rate')}
                    )
        """
        res['recurring_yearly'] = f"""
            SUM(
                coalesce(
                 CASE WHEN t.recurring_invoice THEN l.price_subtotal ELSE 0 END
                  / nullif(rc.recurring_subtotal, 0), 0
                )
                * s.recurring_monthly * 12
                * { self._case_value_or_one('s.currency_rate') }
                * { self._case_value_or_one('currency_table.rate') }
            )
        """
        res['recurring_total'] = f"""
                s.recurring_total
                * {self._case_value_or_one('s.currency_rate') }
                * {self._case_value_or_one('currency_table.rate') }  
        """
        return res

    def _from_sale(self):
        from_str = super()._from_sale()
        from_str = f"""{from_str}
            LEFT OUTER JOIN account_analytic_account a on s.id=a.id
            LEFT JOIN ( 
                SELECT 
                    s.id AS id,
                    SUM(l.price_subtotal) AS recurring_subtotal
                FROM 
                            sale_order_line l
                    JOIN    sale_order s ON (l.order_id=s.id)
                    LEFT JOIN product_product p ON (l.product_id=p.id)
                    LEFT JOIN product_template t ON (p.product_tmpl_id=t.id)
                WHERE s.is_subscription
                  AND t.recurring_invoice
               GROUP BY
                    s.id
            ) rc ON rc.id = s.id
        """
        return from_str

    def _where_sale(self):
        where = super()._where_sale()
        return f"""
            {where}
            AND s.subscription_state IS NOT NULL
        """

    def _group_by_sale(self):
        group_by_str = super()._group_by_sale()
        group_by_str = f"""{group_by_str},
                    s.subscription_state,
                    s.recurring_monthly,
                    s.end_date,
                    s.health,
                    s.subscription_state,
                    s.sale_order_template_id,
                    partner.industry_id,
                    s.close_reason_id,
                    s.state,
                    s.next_invoice_date,
                    s.recurrence_id,
                    s.origin_order_id,
                    s.first_contract_date,
                    s.client_order_ref
               --     t.recurring_invoice
        """
        return group_by_str

    def action_open_subscription_order(self):
        self.ensure_one()
        if self.order_id:
            action = self.order_id._get_associated_so_action()
            action['views'] = [(self.env.ref('sale_subscription.sale_subscription_primary_form_view').id, 'form')]
            action['res_id'] = self.order_id.id
            return action
        return {
            'res_model': self._name,
            'type': 'ir.actions.act_window',
            'views': [[False, "form"]],
            'res_id': self.id,
        }
