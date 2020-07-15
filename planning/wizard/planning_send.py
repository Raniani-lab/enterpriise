# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _
from odoo.exceptions import UserError


class PlanningSend(models.TransientModel):
    _name = 'planning.send'
    _description = "Send Planning"

    @api.model
    def default_get(self, default_fields):
        res = super().default_get(default_fields)
        if 'slot_ids' in res and 'employee_ids' in default_fields:
            res['employee_ids'] = self.env['planning.slot'].browse(res['slot_ids'][0][2]).mapped('employee_id.id')
        return res

    start_datetime = fields.Datetime("Period", required=True)
    end_datetime = fields.Datetime("Stop Date", required=True)
    include_unassigned = fields.Boolean("Include Open Shifts", default=True)
    note = fields.Text("Extra Message", help="Additional message displayed in the email sent to employees")
    employee_ids = fields.Many2many('hr.employee', string="Employees", help="Employees who will receive planning by email if you click on publish & send.")
    slot_ids = fields.Many2many('planning.slot')

    def action_send(self):
        if not self.employee_ids:
            raise UserError(_('You must select employees who will receive planning.'))
        if self.include_unassigned:
            slot_to_send = self.slot_ids.filtered(lambda s: not s.employee_id or s.employee_id in self.employee_ids)
        else:
            slot_to_send = self.slot_ids.filtered(lambda s: s.employee_id in self.employee_ids)

        # create the planning
        planning = self.env['planning.planning'].create({
            'start_datetime': self.start_datetime,
            'end_datetime': self.end_datetime,
            'include_unassigned': self.include_unassigned,
            'slot_ids': [(6, 0, slot_to_send.ids)],
        })
        return planning._send_planning(message=self.note, employees=self.employee_ids)

    def action_publish(self):
        slot_to_publish = self.slot_ids
        if not self.include_unassigned:
            slot_to_publish = slot_to_publish.filtered(lambda s: s.employee_id)
        slot_to_publish.write({
            'is_published': True,
            'publication_warning': False
        })
        return True
