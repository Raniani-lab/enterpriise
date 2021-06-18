# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrContractSignDocumentWizard(models.TransientModel):
    _inherit = 'hr.contract.sign.document.wizard'

    sign_template_id = fields.Many2one(compute='_compute_sign_template_id', store=True, readonly=False)

    @api.depends('contract_id')
    def _compute_sign_template_id(self):
        for wizard in self:
            contract = wizard.contract_id
            if not contract:
                continue
            if contract.state == 'draft' and contract.sign_template_id:
                wizard.sign_template_id = contract.sign_template_id
            elif contract.state in ['open', 'close'] and contract.contract_update_template_id:
                wizard.sign_template_id = contract.contract_update_template_id
