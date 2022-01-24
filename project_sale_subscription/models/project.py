# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import api, fields, models, _lt
from odoo.osv import expression


class Project(models.Model):
    _inherit = 'project.project'

    subscriptions_count = fields.Integer('# Subscriptions', compute='_compute_subscriptions_count', groups='sale_subscription.group_sale_subscription_view')

    @api.depends('analytic_account_id')
    def _compute_subscriptions_count(self):
        if not self.analytic_account_id:
            self.subscriptions_count = 0
            return
        subscriptions_data = self.env['sale.subscription']._read_group([
            ('analytic_account_id', 'in', self.analytic_account_id.ids)
        ], ['analytic_account_id'], ['analytic_account_id'])
        mapped_data = {data['analytic_account_id'][0]: data['analytic_account_id_count'] for data in subscriptions_data}
        for project in self:
            project.subscriptions_count = mapped_data.get(project.analytic_account_id.id, 0)

    # -------------------------------------------
    # Actions
    # -------------------------------------------

    def _get_subscription_action(self, domain=None, subscription_ids=None):
        if not domain and not subscription_ids:
            return {}
        action = self.env["ir.actions.actions"]._for_xml_id("sale_subscription.sale_subscription_action")
        action_context = {'default_analytic_account_id': self.analytic_account_id.id}
        if self.commercial_partner_id:
            action_context['default_partner_id'] = self.commercial_partner_id.id
        action.update({
            'views': [[False, 'tree'], [False, 'kanban'], [False, 'form'], [False, 'pivot'], [False, 'graph'], [False, 'cohort']],
            'context': action_context,
            'domain': domain or [('id', 'in', subscription_ids)]
        })
        if subscription_ids and len(subscription_ids) == 1:
            action["views"] = [[False, 'form']]
            action["res_id"] = subscription_ids[0]
        return action

    def action_open_project_subscriptions(self):
        self.ensure_one()
        if not self.analytic_account_id:
            return {}
        subscription_ids = self.env['sale.subscription']._search([('analytic_account_id', 'in', self.analytic_account_id.ids)])
        return self._get_subscription_action(subscription_ids=subscription_ids)

    def action_profitability_items(self, section_name, domain=None, res_id=False):
        if section_name == 'subscriptions':
            return self._get_subscription_action(domain, [res_id] if res_id else [])
        return super().action_profitability_items(section_name, domain, res_id)

    # -------------------------------------------
    # Project Update
    # -------------------------------------------

    def _get_profitability_labels(self):
        labels = super()._get_profitability_labels()
        labels['subscriptions'] = _lt('Subscriptions')
        return labels

    def _get_profitability_aal_domain(self):
        return expression.AND([
            super()._get_profitability_aal_domain(),
            ['|', ('move_id', '=', False), ('move_id.subscription_id', '=', False)],
        ])

    def _get_profitability_items(self, with_action=True):
        profitability_items = super()._get_profitability_items(with_action)
        if not self.analytic_account_id:
            return profitability_items
        subscription_read_group = self.env['sale.subscription'].sudo()._read_group(
            [('analytic_account_id', 'in', self.analytic_account_id.ids),
             ('stage_category', '!=', 'draft'),
             ('recurring_total', '>', 0.0),
            ],
            ['stage_category', 'template_id', 'recurring_total', 'ids:array_agg(id)'],
            ['template_id', 'stage_category'],
            lazy=False,
        )
        if not subscription_read_group:
            return profitability_items
        all_subscription_ids = []
        subscription_data_per_template_id = {}
        for res in subscription_read_group:
            subscription_data_per_template_id.setdefault(res['template_id'][0], {})[res['stage_category']] = res['recurring_total']
            all_subscription_ids.extend(res['ids'])

        subscription_template_dict = {
            res['id']: res['recurring_rule_count']
            for res in self.env['sale.subscription.template'].sudo().search_read(
                [('id', 'in', list(subscription_data_per_template_id.keys())), ('recurring_rule_boundary', '=', 'limited')],
                ['id', 'recurring_rule_count'],
            )
        }
        amount_to_invoice = 0.0
        for subcription_template_id, subscription_data_per_stage_category in subscription_data_per_template_id.items():
            nb_period = subscription_template_dict.get(subcription_template_id, 1)
            for category, recurring_total in subscription_data_per_stage_category.items():
                amount_to_invoice += recurring_total * (nb_period if category != 'closed' else 1)  # if the category is closen the subscriptions are supposed to be end.

        aal_read_group = self.env['account.analytic.line'].sudo()._read_group(
            [('move_id.subscription_id', 'in', all_subscription_ids), ('account_id', 'in', self.analytic_account_id.ids)],
            ['amount'],
            [],
        )
        amount_invoiced = aal_read_group[0]['amount'] if aal_read_group and aal_read_group[0]['__count'] else 0.0
        amount_to_invoice -= amount_invoiced  # because the amount_to_invoice included the amount_invoiced.
        revenues = profitability_items['revenues']
        section_id = 'subscriptions'
        subscription_revenue = {
            'id': section_id,
            'invoiced': amount_invoiced,
            'to_invoice': amount_to_invoice,
        }
        if with_action and all_subscription_ids and self.user_has_groups('sale_subscription.group_sale_subscription_view'):
            action = {'name': 'action_profitability_items', 'type': 'object', 'section': section_id, 'domain': json.dumps([('id', 'in', all_subscription_ids)])}
            if len(all_subscription_ids) == 1:
                action['res_id'] = all_subscription_ids[0]
            subscription_revenue['action'] = action
        revenues['data'].append(subscription_revenue)
        revenues['total']['invoiced'] += amount_invoiced
        revenues['total']['to_invoice'] += amount_to_invoice
        return profitability_items
