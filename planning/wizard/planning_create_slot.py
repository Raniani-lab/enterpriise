# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math

from datetime import datetime, timedelta, time
import pytz

from datetime import timedelta
from odoo import api, fields, models, _
from odoo.tools import format_time


def timedelta_to_float_time(td):
    if not isinstance(td, timedelta):
        raise TypeError('Argument \'td\' must be of type datetime.timedelta (received %s)' % td.__class__)
    ts = td.total_seconds()
    m, s = divmod(ts, 60)
    h, m = divmod(m, 60)
    return h, m


class PlanningCreateSlot(models.TransientModel):
    _name = 'planning.create.slot'
    _inherit = 'planning.slot'
    _description = 'Planning Shift Creation'

    # Recurrence fields
    repeat = fields.Boolean("Repeat")
    repeat_interval = fields.Integer("Repeat every", default=1)
    repeat_unit = fields.Selection([
        ('week', 'Weeks'),
        ('month', 'Months'),
    ], default='week')
    repeat_until = fields.Date("Repeat Until", help="If set, the recurrence stop at that date. Otherwise, the recurrence is applied indefinitely.")

    # Autocomplete fields
    shift_template_id = fields.Many2one('planning.slot.template', string='Shift templates')
    autocomplete_templates_ids = fields.Many2many('planning.slot.template', store=False, compute='_compute_autocomplete_planning_ids')

    # Used to display warning in Form view
    employee_tz_warning = fields.Char("Timezone Warning", compute='_compute_employee_tz_warning')

    _sql_constraints = [
        ('check_end_date_lower_repeat_until', 'CHECK(repeat_until IS NULL OR end_datetime < repeat_until)', 'Planning should end before the repeat ends'),
    ]

    @api.depends('role_id')
    def _compute_autocomplete_planning_ids(self):
        """Computes a list of plannings templates that could be used to complete the creation wizard
            plannings must
                -be a record of planning.slot.template
                -be assigned to the same employee if the employee field is set
                -have the same role as the one set in the Roles field of the wizard if it is set
            they are ordered by their start_time (most recent first)
        """
        domain = []
        if self.role_id:
            domain = [('role_id', '=', self.role_id.id)]
        self.autocomplete_templates_ids = self.env['planning.slot.template'].search(domain, order='start_time', limit=10)

    @api.depends('employee_id')
    def _compute_employee_tz_warning(self):
        for planning in self:
            if(planning.employee_id and self.env.user.tz and planning.employee_id.tz != self.env.user.tz):
                planning.employee_tz_warning = _('%s\'s schedules timezone differs from yours' % (planning.employee_id.name,))
            else:
                planning.employee_tz_warning = False

    @api.onchange('shift_template_id')
    def _onchange_shift_template_id(self):
        user_tz = pytz.timezone(self.env.user.tz or 'UTC')
        if self.shift_template_id and self.start_datetime:
            start_datetime = user_tz.localize(datetime.combine(
                self.start_datetime,
                time(
                    hour=int(self.shift_template_id.start_time), minute=round(math.modf(self.shift_template_id.start_time)[0] / (1 / 60.0))
                )
            ))
            start_datetime = start_datetime.astimezone(pytz.utc)
            self.start_datetime = start_datetime.replace(tzinfo=None)
            self.end_datetime = (self.start_datetime + timedelta(
                hours=int(self.shift_template_id.duration_hours_count),
                minutes=round(
                    math.modf(self.shift_template_id.duration_hours_count)[0] / (1 / 60.0)
                )
            )).replace(tzinfo=None)
            self.role_id = self.shift_template_id.role_id

    def action_save_and_send(self):
        """
            we have a different send function to use with the save & send button, that's because
            planning could have been repeated when created, we have to find related ones so that
            they are sent as well
        """
        related_plannings = self.action_create_new()
        for planning in related_plannings:
            planning.action_send()

    def action_save_as_template(self):
        """ hit save as template button: current form values will be a new planning.slot.template record attached
        to the current document. """
        self.ensure_one()
        destination_tz = pytz.timezone(self.env.user.tz or 'UTC')
        start_datetime = pytz.utc.localize(self.start_datetime).astimezone(destination_tz)
        end_datetime = pytz.utc.localize(self.end_datetime).astimezone(destination_tz)
        duration = end_datetime - start_datetime  # Compute duration w/ tzinfo otherwise DST will not be taken into account
        self.env['planning.slot.template'].create(self._prepare_template_values(start_datetime, duration, self.role_id.id))
        return self._reopen(self.id)

    def action_create_new(self):
        self.ensure_one()
        plannings = []
        planning_values = self._prepare_planning_values()
        recurrency_values = self._prepare_recurrency_values()
        if self.repeat:
            recurrency = self.env['planning.recurrency'].create(recurrency_values)
            plannings = recurrency.create_slot(
                self.start_datetime,
                self.end_datetime,
                planning_values,
                recurrency.repeat_until
            )
            if not plannings:
                planning_values.update({'recurrency_id': recurrency.id})
                plannings = self.env['planning.slot'].create(planning_values)
        else:
            plannings = self.env['planning.slot'].create(planning_values)
        return plannings

    def _prepare_planning_values(self):
        result = {}
        for fname, field in self.env['planning.slot']._fields.items():
            if field.compute is None and not field.related:  # related and computed fields can not be written
                result[fname] = self[fname]
        return self._convert_to_write(result)

    def _prepare_recurrency_values(self):
        return {
            'repeat_interval': self.repeat_interval,
            'repeat_unit': self.repeat_unit,
            'repeat_until': self.repeat_until,
            'company_id': self.company_id.id,
        }

    def _prepare_template_values(self, start_dt, duration, role_id):
        duration_hours, duration_minutes = timedelta_to_float_time(duration)
        return {
            'start_time': start_dt.hour + 1 / 60.0 * start_dt.minute,
            'duration_hours_count': duration_hours + 1 / 60.0 * duration_minutes,
            'role_id': role_id or False
        }

    def _reopen(self, res_id):
        # save original model in context, because selecting the list of available
        # templates requires a model in context
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_id': res_id,
            'res_model': self._name,
            'target': 'new',
            'context': self._context,
        }
