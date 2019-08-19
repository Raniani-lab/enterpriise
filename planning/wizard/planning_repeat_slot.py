# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError

from odoo import tools


class PlanningRepeatSlot(models.TransientModel):
    _name = 'planning.repeat.slot'
    _description = 'Make a Shift recurrent'

    @api.model
    def default_get(self, fields):
        result = super(PlanningRepeatSlot, self).default_get(fields)

        if 'planning_slot_id' in fields:
            active_model = self._context.get('active_model')
            if active_model != 'planning.slot':
                raise UserError(_("You can only apply this action from a planning shift."))
            result['planning_slot_id'] = self._context.get('active_id')

        return result

    planning_slot_id = fields.Many2one("planning.slot", readonly=True)
    repeat_interval = fields.Integer(string="Repeat every", required=True, default=1)
    repeat_unit = fields.Selection([
        ('week', 'Weeks'),
        ('month', 'Months'),
    ], default="week", required=True)
    repeat_until = fields.Date()

    @api.constrains('planning_slot_id')
    def _check_planning_id_not_recurrent(self):
        for wizard in self:
            if wizard.planning_slot_id.recurrency_id:
                raise ValidationError(_("Cannot repeat an already repeating shift"))

    def action_repeat(self):
        self.ensure_one()
        if not (self.repeat_until and self.planning_slot_id.end_datetime >= datetime.combine(self.repeat_until, datetime.min.time())):
            # set the values to  a new slot that would be the first repeat of the original one
            delta = tools.get_timedelta(self.repeat_interval, self.repeat_unit)
            slot_values = self.planning_slot_id.copy_data()[0]
            start_datetime = self.planning_slot_id.start_datetime + delta
            end_datetime = self.planning_slot_id.end_datetime + delta
            # use the repeat params from the wizard and create them in repeat
            recurrency_values = {
                'repeat_until': self.repeat_until,
                'repeat_interval': self.repeat_interval,
                'repeat_unit': self.repeat_unit,
                'slot_ids': [(4, self.planning_slot_id.id, False)],
                'company_id': self.planning_slot_id.company_id.id,
            }
            recurrency = self.env['planning.recurrency'].create(recurrency_values)
            return recurrency.create_slot(start_datetime, end_datetime, slot_values, recurrency.repeat_until)
