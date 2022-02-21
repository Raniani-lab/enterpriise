# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.exceptions import UserError


class HrPlanWizard(models.TransientModel):
    _inherit = 'hr.plan.wizard'

    def action_launch(self):
        res = super().action_launch()

        employee = self.employee_id
        contract = employee.contract_id
        for signature_request in self.plan_id.plan_signature_request_ids:
            if signature_request.responsible_signer == 'hr_responsible':
                responsible = contract.hr_responsible_id or employee.parent_id.user_id
            elif signature_request.responsible_signer == 'coach':
                responsible = employee.coach_id.user_id or employee.parent_id.user_id
            elif signature_request.responsible_signer == 'manager':
                responsible = employee.parent_id.user_id
            else:
                responsible = signature_request.responsible_id
            if not responsible:
                raise UserError(_('No responsible found for employee %s', employee.name))

            self.env['hr.contract.sign.document.wizard'].create({
                'contract_id': self.employee_id.contract_id.id,
                'employee_id': self.employee_id.id,
                'responsible_id': responsible.id,
                'employee_role_id': signature_request.employee_role_id.id,
                'sign_template_ids': [(4, signature_request.sign_template_id.id)],
                'subject': _('Signature Request'),
            }).validate_signature()

        return res
