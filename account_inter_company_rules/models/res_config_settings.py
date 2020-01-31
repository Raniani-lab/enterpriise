# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    rule_type = fields.Selection(related='company_id.rule_type', readonly=False)
    intercompany_user_id = fields.Many2one(related='company_id.intercompany_user_id', readonly=False, required=True)
    rules_company_id = fields.Many2one(related='company_id', string='Select Company', readonly=True)
    intercompany_transaction_message = fields.Char(compute='_compute_intercompany_transaction_message')

    @api.depends('rule_type', 'company_id')
    def _compute_intercompany_transaction_message(self):
        for record in self:
            self.company_id.rule_type = self.rule_type
            self.intercompany_transaction_message = self.company_id.intercompany_transaction_message
