# -*- coding: utf-8 -*-
from collections import defaultdict
from datetime import datetime

from odoo import Command, models, fields, api, _
from odoo.addons.resource.models.utils import Intervals
from odoo.addons.web.controllers.utils import clean_action
from odoo.exceptions import UserError
from odoo.http import request


class MrpWorkorder(models.Model):
    _inherit = 'mrp.workorder'

    # used to display the connected employee that will start a workorder on the tablet view
    employee_id = fields.Many2one('hr.employee', string="Employee", compute='_compute_employee_id')
    employee_name = fields.Char(compute='_compute_employee_id')

    # employees that started working on the wo
    employee_ids = fields.Many2many('hr.employee', string='Working employees', copy=False)
    # employees assigned to the wo
    employee_assigned_ids = fields.Many2many('hr.employee', 'mrp_workorder_employee_assigned',
                                             'workorder_id', 'employee_id', string='Assigned', copy=False)
    # employees connected
    connected_employee_ids = fields.Many2many('hr.employee', search='search_is_assigned_to_connected', store=False)

    # True if the workcenter need authentication
    allow_employee = fields.Boolean(related='workcenter_id.allow_employee')
    # list of employees allowed to work on the workcenter
    allowed_employees = fields.Many2many(related='workcenter_id.employee_ids')
    # True if all employees are allowed on that workcenter
    all_employees_allowed = fields.Boolean(compute='_all_employees_allowed')

    def _compute_duration(self):
        wo_ids_without_employees = set()
        for wo in self:
            if not wo.workcenter_id.allow_employee:
                wo_ids_without_employees.add(wo.id)
                continue
            wo.duration = wo.get_duration()
            wo.duration_unit = round(wo.duration / max(wo.qty_produced, 1), 2)
            if wo.duration_expected:
                wo.duration_percent = 100 * (wo.duration_expected - wo.duration) / wo.duration_expected
            else:
                wo.duration_percent = 0
        return super(MrpWorkorder, self.env['mrp.workorder'].browse(wo_ids_without_employees))._compute_duration()

    @api.depends('employee_ids')
    def _compute_employee_id(self):
        main_employee_connected = self.env['hr.employee'].get_session_owner()
        self.employee_id = main_employee_connected
        self.employee_name = self.env['hr.employee'].browse(main_employee_connected).name

    def search_is_assigned_to_connected(self, operator, value):
        # retrieving employees connected in the session
        main_employee_connected = self.env['hr.employee'].get_session_owner()
        # if no one is connected, all records are valid
        if not main_employee_connected:
            return []
        search_query = self.env['mrp.workorder']._search([('employee_assigned_ids', '=', main_employee_connected)])
        return [('id', operator, search_query)]

    @api.depends('all_employees_allowed')
    def _all_employees_allowed(self):
        for wo in self:
            wo.all_employees_allowed = wo.allow_employee and len(wo.allowed_employees) == 0 or not wo.allow_employee

    def start_employee(self, employee_id):
        self.ensure_one()
        if employee_id in self.employee_ids.ids and any(not t.date_end for t in self.time_ids if t.employee_id.id == employee_id):
            return
        self.employee_ids = [Command.link(employee_id)]
        time_data = self._prepare_timeline_vals(self.duration, datetime.now())
        time_data['employee_id'] = employee_id
        self.env['mrp.workcenter.productivity'].create(time_data)
        self.state = "progress"

    def stop_employee(self, employee_ids):
        self.employee_ids = [Command.unlink(emp) for emp in employee_ids]
        self.env['mrp.workcenter.productivity'].search([
            ('employee_id', 'in', employee_ids),
            ('workorder_id', 'in', self.ids),
            ('date_end', '=', False)
        ])._close()

    def get_workorder_data(self):
        # Avoid to get the products full name because code and name are separate in the barcode app.
        data = super().get_workorder_data() or {}
        if not self.workcenter_id.allow_employee:
            data['employee_id'] = False
            data['employee_ids'] = []
            data['employee_list'] = []
            return data
        employee_domain = [('company_id', '=', self.company_id.id)]
        if self.workcenter_id.employee_ids:
            employee_domain = [('id', 'in', self.workcenter_id.employee_ids.ids)]
        fields_to_read = self.env['hr.employee']._get_employee_fields_for_tablet()
        working_state = self.working_state
        data.update({
            "working_state": working_state,
            "employee_id": self.employee_id.id,
            "employee_ids": self.employee_ids.ids,
            "employee_list": self.env['hr.employee'].search_read(employee_domain, fields_to_read, load=False),
        })
        return data

    def record_production(self):
        action = super().record_production()
        if action is not True and self.employee_id:
            action.get('context', {})['employee_id'] = self.employee_id.id
        return action

    def action_back(self):
        action = super().action_back()
        if self.employee_id:
            action['context']['employee_id'] = self.employee_id.id
            action['context']['employee_name'] = self.employee_id.name
        if self.employee_ids:
            action['context']['employee_ids'] = self.employee_ids

        return clean_action(action, self.env)

    def _should_start_timer(self):
        """ Return True if the timer should start once the workorder is opened."""
        self.ensure_one()
        if self.workcenter_id.allow_employee:
            return False
        return super()._should_start_timer()

    def _intervals_duration(self, intervals):
        """ Return the duration of the given intervals.
        If intervals overlaps the duration is only counted once.

        The timer could be share between several intervals. However it is not
        an issue since the purpose is to make a difference between employee time and
        blocking time.

        :param list intervals: list of tuple (date_start, date_end, timer)
        """
        if not intervals:
            return 0.0
        duration = 0
        for date_start, date_stop, timer in Intervals(intervals):
            duration += timer.loss_id._convert_to_duration(date_start, date_stop, timer.workcenter_id)
        return duration

    def get_duration(self):
        self.ensure_one()
        if self.workcenter_id.allow_employee:
            now = datetime.now()
            loss_type_times = defaultdict(lambda: self.env['mrp.workcenter.productivity'])
            for time in self.time_ids:
                loss_type_times[time.loss_id.loss_type] |= time
            duration = 0
            for dummy, times in loss_type_times.items():
                duration += self._intervals_duration([(t.date_start, t.date_end or now, t) for t in times])
            return duration
        return self.duration + super().get_working_duration()

    def get_working_duration(self):
        self.ensure_one()
        if self.workcenter_id.allow_employee:
            now = datetime.now()
            return self._intervals_duration([(t.date_start, now, t) for t in self.time_ids if not t.date_end])
        return super().get_working_duration()

    def get_productive_duration(self):
        self.ensure_one()
        if self.workcenter_id.allow_employee:
            now = datetime.now()
            productive_times = []
            for time in self.time_ids:
                if time.loss_id.loss_type == "productive":
                    productive_times.append(time)
            duration = 0
            duration += self._intervals_duration([(t.date_start, t.date_end or now, t) for t in productive_times])
            return duration
        return super().get_productive_duration()

    def _cal_cost(self):
        return super()._cal_cost() + sum(self.time_ids.mapped('total_cost'))

    def button_start(self, bypass=False):
        # this override checks if the connected people are allowed to work on the wo
        if bypass:
            return super().button_start()
        if not self.workcenter_id.allow_employee or not request:
            return super().button_start()
        connected_employees = self.env['hr.employee'].get_employees_connected()
        if len(connected_employees) == 0:
            raise UserError(_("You need to log in to process this work order."))
        main_employee = self.env['hr.employee'].get_session_owner()
        if not main_employee:
            raise UserError(_("There is no session chief. Please log in."))
        if main_employee not in [emp.id for emp in self.allowed_employees] and not self.all_employees_allowed:
            raise UserError(_("You are not allowed to work on the workorder"))
        super().button_start()
        if len(self.allowed_employees) == 0 or main_employee in [emp.id for emp in self.allowed_employees]:
            self.start_employee(self.env['hr.employee'].browse(main_employee).id)
            self.employee_ids |= self.env['hr.employee'].browse(main_employee)

    def button_pending(self):
        for emp in self.employee_ids:
            self.stop_employee([emp.id])
        super().button_pending()

    def action_mark_as_done(self):
        main_employee_connected = self.env['hr.employee'].get_session_owner()

        for wo in self:
            if wo.allow_employee and not main_employee_connected:
                raise UserError(_('You must be logged in to process some of these work orders.'))
            if wo.allow_employee and len(wo.allowed_employees) != 0 and main_employee_connected not in [wo.id for wo in wo.allowed_employees]:
                raise UserError(_('You are not allow to work on some of these work orders.'))
            if wo.working_state == 'blocked':
                raise UserError(_('Some workorders require another workorder to be completed first'))
        self.button_finish()

        loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'productive')], limit=1)
        if len(loss_id) < 1:
            raise UserError(_("You need to define at least one productivity loss in the category 'Productive'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))

        wo.state = 'done'
        productivity = []
        for wo in self:
            if wo.allow_employee:
                if not wo.time_ids:
                    now = datetime.now()
                    date_start = datetime.fromtimestamp(now.timestamp() - ((wo.duration_expected * 60) // 1))
                    date_end = now
                    productivity.append({
                        'workorder_id': wo.id,
                        'workcenter_id': wo.workcenter_id.id,
                        'description': _('Time Tracking: %(user)s', user=self.env.user.name),
                        'date_start': date_start,
                        'date_end': date_end,
                        'loss_id': loss_id[0].id,
                        'user_id': self.env.user.id,
                        'company_id': wo.company_id.id,
                        'employee_id': main_employee_connected
                    })
                continue
            if wo.duration == 0.0:
                wo.duration = wo.duration_expected
                wo.duration_percent = 100
        self.env['mrp.workcenter.productivity'].create(productivity)

    def _should_be_pending(self):
        return super()._should_be_pending() and len(self.employee_ids.ids) == 0

    def _should_start(self):
        if (not self.is_user_working or self.allow_employee) and self.working_state != 'blocked' and self.state in ('ready', 'waiting', 'progress', 'pending'):
            if self.allow_employee:
                if self.env['hr.employee'].get_session_owner():
                    return True
                else:
                    self.button_start(bypass=True)
            else:
                return True
        return False
