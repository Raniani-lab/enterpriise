# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResPartner(models.Model):
    _name = 'res.partner'
    _inherit = 'res.partner'

    account_represented_company_ids = fields.One2many('res.company', 'account_representative_id')

    def open_partner_ledger(self):
        action = self.env["ir.actions.actions"]._for_xml_id("account_reports.action_account_report_partner_ledger")
        action['params'] = {
            'options': {'partner_ids': [self.id]},
            'ignore_session': 'both',
        }
        return action
