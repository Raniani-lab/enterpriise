# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


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
    previous_planning_id = fields.Many2one('planning.slot', string='Recent Forecasts', store=False)
    autocomplete_planning_ids = fields.Many2many('planning.slot', store=False, compute='_compute_autocomplete_planning_ids')

    # Used to display warning in Form view
    employee_tz_warning = fields.Char("Timezone Warning", compute='_compute_employee_tz_warning')

    _sql_constraints = [
        ('check_end_date_lower_repeat_until', 'CHECK(repeat_until IS NULL OR end_datetime < repeat_until)', 'Forecast should end before the repeat ends'),
    ]

    @api.depends('employee_id')
    def _compute_autocomplete_planning_ids(self):
        """Computes a list of plannings that could be used to complete the creation wizard
            plannings must
                -be assigned to the same employee
                -have distinct roles
            they are ordered by their end_datetime (most recent first)
        """
        if self.employee_id:
            plannings = self.env['planning.slot'].search([
                ['employee_id', '=', self.employee_id.id]
            ], order='end_datetime')
            seen = {}

            def filter_func(planning):
                uniq = seen.get(planning.role_id, True)
                seen[planning.role_id] = False
                return uniq

            plannings = plannings.filtered(filter_func)
            self.autocomplete_planning_ids = plannings

    @api.depends('employee_id')
    def _compute_employee_tz_warning(self):
        for planning in self:
            if(planning.employee_id and self.env.user.tz and planning.employee_id.tz != self.env.user.tz):
                planning.employee_tz_warning = _('%s\'s schedules timezone differs from yours' % (planning.employee_id.name,))
            else:
                planning.employee_tz_warning = False

    @api.onchange('previous_planning_id')
    def _onchange_previous_planning_id(self):
        if self.previous_planning_id and self.start_datetime:
            interval = self.previous_planning_id.end_datetime - self.previous_planning_id.start_datetime
            self.end_datetime = self.start_datetime + interval

            self.role_id = self.previous_planning_id.role_id

    def action_save_and_send(self):
        """
            we have a different send function to use with the save & send button, that's because
            planning could have been repeated when created, we have to find related ones so that
            they are sent as well
        """
        related_plannings = self.action_create_new()
        for planning in related_plannings:
            planning.action_send()

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
