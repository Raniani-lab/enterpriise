# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import fields, models


class SaleSubscriptionReport(models.Model):
    _name = "sale.subscription.report"
    _description = "Subscription Analysis"
    _auto = False

    name = fields.Char()
    date_order = fields.Date('Order Date', readonly=True)
    end_date = fields.Date('End Date', readonly=True)
    product_id = fields.Many2one('product.product', 'Product', readonly=True)
    product_uom = fields.Many2one('uom.uom', 'Unit of Measure', readonly=True)
    recurring_monthly = fields.Float('Monthly Recurring Revenue', readonly=True)
    recurring_yearly = fields.Float('Yearly Recurring Revenue', readonly=True)
    recurring_total = fields.Float('Recurring Amount', readonly=True)
    quantity = fields.Float('Quantity', readonly=True)
    partner_id = fields.Many2one('res.partner', 'Customer', readonly=True)
    user_id = fields.Many2one('res.users', 'Salesperson', readonly=True)
    team_id = fields.Many2one('crm.team', 'Sales Team', readonly=True)
    company_id = fields.Many2one('res.company', 'Company', readonly=True)
    categ_id = fields.Many2one('product.category', 'Product Category', readonly=True)
    pricelist_id = fields.Many2one('product.pricelist', 'Pricelist', readonly=True)
    template_id = fields.Many2one('sale.order.template', 'Subscription Template', readonly=True)
    product_tmpl_id = fields.Many2one('product.template', 'Product Template', readonly=True)
    country_id = fields.Many2one('res.country', 'Country', readonly=True)
    commercial_partner_id = fields.Many2one('res.partner', 'Customer Company', readonly=True)
    industry_id = fields.Many2one('res.partner.industry', 'Industry', readonly=True)
    analytic_account_id = fields.Many2one('account.analytic.account', 'Analytic Account', readonly=True)
    close_reason_id = fields.Many2one('sale.order.close.reason', 'Close Reason', readonly=True)
    to_renew = fields.Boolean('To Renew', readonly=True)
    stage_category = fields.Selection([
        ('draft', 'Draft'),
        ('progress', 'In Progress'),
        ('closed', 'Closed')], readonly=True)
    health = fields.Selection([
        ('normal', 'Neutral'),
        ('done', 'Good'),
        ('bad', 'Bad')], string="Health", readonly=True)
    stage_id = fields.Many2one('sale.order.stage', string='Stage', readonly=True)
    state = fields.Selection(selection=[
            ('draft', "Quotation"),
            ('sent', "Quotation Sent"),
            ('sale', "Sales Order"),
            ('done', "Locked"),
            ('cancel', "Cancelled"),
        ],
        string="Status", readonly=True)
    next_invoice_date = fields.Date('Next Invoice Date', readonly=True)
    recurrence_id = fields.Many2one('sale.temporal.recurrence', 'Recurrence', readonly=True)
    origin_order_id = fields.Many2one('sale.order', string='First contract', readonly=True)

    def _case_value_or_one(self, value):
        return f'CASE COALESCE({ value }, 0) WHEN 0 THEN 1.0 ELSE { value } END'

    def _select(self):
        select_str = f"""
                    min(l.id) as id,
                    sub.name as name,
                    l.product_id as product_id,
                    l.product_uom as product_uom,
                    sub.analytic_account_id as analytic_account_id,
                    SUM(
                        coalesce(
                         CASE WHEN t.recurring_invoice THEN l.price_subtotal ELSE 0 END
                          / nullif(rc.recurring_subtotal, 0), 0
                        )
                        * sub.recurring_monthly
                        * { self._case_value_or_one('sub.currency_rate') }
                        * { self._case_value_or_one('currency_table.rate') }
                    ) as recurring_monthly,
                    SUM(
                        coalesce(
                         CASE WHEN t.recurring_invoice THEN l.price_subtotal ELSE 0 END
                          / nullif(rc.recurring_subtotal, 0), 0
                        )
                        * sub.recurring_monthly * 12
                        * { self._case_value_or_one('sub.currency_rate') }
                        * { self._case_value_or_one('currency_table.rate') }
                    ) as recurring_yearly,
                    SUM (
                        CASE WHEN t.recurring_invoice THEN l.price_subtotal ELSE 0 END
                        * { self._case_value_or_one('sub.currency_rate') }
                        * { self._case_value_or_one('currency_table.rate') }
                    ) as recurring_total,
                    SUM(l.product_uom_qty) as quantity,
                    sub.date_order as date_order,
                    sub.end_date as end_date,
                    sub.partner_id as partner_id,
                    sub.user_id as user_id,
                    sub.team_id,
                    sub.company_id as company_id,
                    sub.to_renew,
                    sub.stage_category,
                    sub.health,
                    sub.stage_id,
                    sub.sale_order_template_id as template_id,
                    t.categ_id as categ_id,
                    sub.pricelist_id as pricelist_id,
                    p.product_tmpl_id,
                    partner.country_id as country_id,
                    partner.commercial_partner_id as commercial_partner_id,
                    partner.industry_id as industry_id,
                    sub.close_reason_id as close_reason_id,
                    sub.state as state,
                    sub.next_invoice_date as next_invoice_date,
                    sub.recurrence_id as recurrence_id,
                    sub.origin_order_id as origin_order_id
        """
        return select_str

    def _from(self):
        from_str = """
                    sale_order_line l
            JOIN    sale_order sub on (l.order_id=sub.id)
            JOIN    sale_order_stage stage on sub.stage_id = stage.id
            JOIN    res_partner partner on sub.partner_id = partner.id
            LEFT JOIN product_product p on (l.product_id=p.id)
            LEFT JOIN product_template t on (p.product_tmpl_id=t.id)
            LEFT JOIN uom_uom u on (u.id=l.product_uom)
            LEFT OUTER JOIN account_analytic_account a on sub.id=a.id
            LEFT JOIN ( 
                SELECT 
                    sub.id AS id,
                    SUM(l.price_subtotal) AS recurring_subtotal
                FROM 
                            sale_order_line l
                    JOIN    sale_order sub ON (l.order_id=sub.id)
                    LEFT JOIN product_product p ON (l.product_id=p.id)
                    LEFT JOIN product_template t ON (p.product_tmpl_id=t.id)
                WHERE 
                    sub.is_subscription
                AND t.recurring_invoice
                GROUP BY
                    sub.id
            ) rc ON rc.id = sub.id
            JOIN    {currency_table} ON currency_table.company_id = sub.company_id
        """.format(
            currency_table=self.env['res.currency']._get_query_currency_table(
                {
                    'multi_company': True,
                    'date': {'date_to': fields.Date.today()}
                }),
        )
        return from_str

    def _where(self):
        return """
            sub.is_subscription
        """

    def _group_by(self):
        group_by_str = """
                    l.product_id,
                    l.product_uom,
                    t.categ_id,
                    sub.analytic_account_id,
                    sub.recurring_monthly,
                    sub.amount_untaxed,
                    sub.date_order,
                    sub.end_date,
                    sub.partner_id,
                    sub.user_id,
                    sub.team_id,
                    sub.company_id,
                    sub.to_renew,
                    sub.stage_category,
                    sub.health,
                    sub.stage_id,
                    sub.name,
                    sub.sale_order_template_id,
                    sub.pricelist_id,
                    p.product_tmpl_id,
                    partner.country_id,
                    partner.commercial_partner_id,
                    partner.industry_id,
                    sub.close_reason_id,
                    sub.state,
                    sub.next_invoice_date,
                    sub.recurrence_id,
                    sub.origin_order_id
        """
        return group_by_str

    @property
    def _table_query(self):
        return self._query()

    def _query(self):
        return """
            SELECT %s
              FROM ( %s )
             WHERE %s
          GROUP BY %s
        """ % (self._select(), self._from(), self._where(), self._group_by())
