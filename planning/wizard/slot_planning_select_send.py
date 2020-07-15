# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class SlotPlanningSelectSend(models.TransientModel):
    _name = 'slot.planning.select.send'
    _description = "Select Employees and Send One Slot"

    @api.model
    def default_get(self, default_fields):
        res = super().default_get(default_fields)
        if 'employee_ids' in default_fields and res.get('slot_id') and 'employee_ids' not in res:
            slot = self.env['planning.slot'].browse(res['slot_id'])
            if slot and slot.role_id:
                res['employee_ids'] = self.env['hr.employee'].sudo().search([
                    '|', ('planning_role_ids', '=', False), ('planning_role_ids', 'in', slot.role_id.id),
                    ('company_id', '=', slot.company_id), ('work_email', '!=', False),
                ]).ids
        return res

    slot_id = fields.Many2one('planning.slot', "Shifts", required=True, readonly=True)
    company_id = fields.Many2one('res.company', related='slot_id.company_id')
    employee_ids = fields.Many2many('hr.employee', required=True, check_company=True, domain="[('work_email', '!=', False)]")

    def action_send(self):
        return self.slot_id._send_slot(self.employee_ids, self.slot_id.start_datetime, self.slot_id.end_datetime)
