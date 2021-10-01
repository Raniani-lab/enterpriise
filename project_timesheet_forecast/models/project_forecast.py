# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from datetime import datetime

from odoo import _, api, fields, models
from odoo.osv import expression


class Forecast(models.Model):
    _inherit = 'planning.slot'

    allow_timesheets = fields.Boolean("Allow timesheets", related='project_id.allow_timesheets', help="Timesheets can be logged on this slot.", readonly=True)
    effective_hours = fields.Float("Effective Hours", compute='_compute_effective_hours', compute_sudo=True, store=True, help="Number of hours on the employee's Timesheets for this task (and its sub-tasks) during the timeframe of the shift.")
    timesheet_ids = fields.Many2many('account.analytic.line', compute='_compute_effective_hours', compute_sudo=True)
    can_open_timesheets = fields.Boolean(compute='_compute_can_open_timesheet')
    percentage_hours = fields.Float("Progress", compute='_compute_percentage_hours', compute_sudo=True, store=True)
    encode_uom_in_days = fields.Boolean(compute='_compute_encode_uom_in_days')
    allocated_hours_cost = fields.Float("Allocated Hours Cost", compute='_compute_hours_cost', store=True)
    effective_hours_cost = fields.Float("Effective Hours Cost", compute='_compute_hours_cost', store=True)

    def _compute_encode_uom_in_days(self):
        self.encode_uom_in_days = self.env.company.timesheet_encode_uom_id == self.env.ref('uom.product_uom_day')

    @api.depends('allocated_hours', 'effective_hours', 'employee_id')
    def _compute_hours_cost(self):
        employee_read = self.env['hr.employee'].search_read([('id', 'in', self.employee_id.ids)], ['id', 'timesheet_cost'])
        employee_dict = {res['id']: res['timesheet_cost'] for res in employee_read}
        for slot in self:
            timesheet_cost = employee_dict.get(slot.employee_id.id, 0.0)
            slot.allocated_hours_cost = slot.allocated_hours * timesheet_cost
            slot.effective_hours_cost = slot.effective_hours * timesheet_cost

    @api.depends('allocated_hours', 'effective_hours')
    def _compute_percentage_hours(self):
        for forecast in self:
            if forecast.allocated_hours:
                forecast.percentage_hours = forecast.effective_hours / forecast.allocated_hours * 100
            else:
                forecast.percentage_hours = 0

    def _get_timesheet_domain(self):
        '''
        Returns the domain used to fetch the timesheets, None is returned in case there would be no match
        '''
        self.ensure_one
        if not self.task_id or not self.project_id:
            return None
        domain = [
            ('employee_id', '=', self.employee_id.id),
            ('date', '>=', self.start_datetime.date()),
            ('date', '<=', self.end_datetime.date())
        ]
        if self.task_id:
            all_task = self.task_id + self.task_id.with_context(active_test=False)._get_all_subtasks()
            domain = expression.AND([[('task_id', 'in', all_task.ids)], domain])
        elif self.project_id:
            domain = expression.AND([[('account_id', '=', self.project_id.analytic_account_id.id)], domain])
        return domain

    @api.depends('task_id', 'employee_id', 'start_datetime', 'end_datetime', 'project_id.analytic_account_id', 'task_id.timesheet_ids', 'project_id.analytic_account_id.line_ids', 'project_id.analytic_account_id.line_ids.unit_amount')
    def _compute_effective_hours(self):
        Timesheet = self.env['account.analytic.line']
        for forecast in self:
            if (not forecast.task_id and not forecast.project_id) or not forecast.start_datetime or not forecast.end_datetime:
                forecast.effective_hours = 0
                forecast.timesheet_ids = False
            else:
                domain = forecast._get_timesheet_domain()
                if domain:
                    timesheets = Timesheet.search(domain)
                else:
                    timesheets = Timesheet.browse()

                forecast.effective_hours = sum(timesheet.unit_amount for timesheet in timesheets)
                forecast.timesheet_ids = timesheets

    def _read_group_fields_nullify(self):
        return super()._read_group_fields_nullify() + ['effective_hours', 'effective_hours_cost', 'percentage_hours']

    @api.depends_context('uid')
    @api.depends('user_id', 'timesheet_ids')
    def _compute_can_open_timesheet(self):
        # A timesheet approver will be able to open any slot's timesheets, however
        # a regular employee will need to be a timesheet user AND be assigned to this slot
        # to be able to open them.
        is_approver = self.user_has_groups('hr_timesheet.group_hr_timesheet_approver')
        is_user = is_approver or self.user_has_groups('hr_timesheet.group_hr_timesheet_user')
        if not is_user:
            self.can_open_timesheets = False
        else:
            for slot in self:
                if (is_approver or (is_user and self.env.user == slot.user_id)):
                    slot.can_open_timesheets = True
                else:
                    slot.can_open_timesheets = False

    def _gantt_progress_bar_project_id(self, res_ids, start, stop):
        project_dict = {
            project.id: project.allocated_hours
            for project in self.env['project.project'].search([('id', 'in', res_ids)])
        }
        planning_read_group = self.env['planning.slot']._read_group(
            [('project_id', 'in', res_ids), ('start_datetime', '<=', stop), ('end_datetime', '>=', start)],
            ['project_id', 'allocated_hours'],
            ['project_id'],
        )
        return {
            res['project_id'][0]: {
                'value': res['allocated_hours'],
                'max_value': project_dict.get(res['project_id'][0], 0)
            }
            for res in planning_read_group
        }

    def _gantt_progress_bar(self, field, res_ids, start, stop):
        if field == 'project_id':
            return dict(
                self._gantt_progress_bar_project_id(res_ids, start, stop),
                warning=_("This project isn't expected to have slot during this period. Planned hours :"),
            )
        return super()._gantt_progress_bar(field, res_ids, start, stop)

    def _action_generate_timesheet(self):
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_user'):
            return self._get_notification_action("warning", _('You do not have the right to create timesheets.'))

        filter_domain = [
            ('project_id', '!=', False),
            ('allow_timesheets', '!=', False),
            ('state', '=', 'published'),
            ('employee_id', '!=', False),
            ('start_datetime', '<', fields.Datetime.now())
        ]
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_approver'):
            filter_domain = expression.AND([[('user_id', '=', self.env.uid)], filter_domain])

        slots = self.filtered_domain(filter_domain)
        if not slots:
            return self._get_notification_action("warning", _("There are no timesheets to generate or you don't have the right."))

        today = fields.Datetime.now()
        interval_per_employee = defaultdict(lambda: (today, datetime(1970, 1, 1)))
        for slot in slots:
            start_datetime, end_datetime = interval_per_employee[slot.employee_id]
            if start_datetime > slot.start_datetime:
                start_datetime = slot.start_datetime
            if end_datetime < slot.end_datetime:
                end_datetime = slot.end_datetime if slot.end_datetime <= today else today
            interval_per_employee[slot.employee_id] = (start_datetime, end_datetime)

        work_data_per_employee_id = {}
        min_date, max_date = today.date(), None
        for employee, (start_datetime, end_datetime) in interval_per_employee.items():
            work_data = employee.list_work_time_per_day(
                start_datetime,
                end_datetime,
            )
            work_data_per_employee_id[employee.id] = work_data
            if work_data:
                start_date = work_data[0][0]
                end_date = work_data[-1][0]
                if start_date < min_date:
                    min_date = start_date
                if not max_date or end_date > max_date:
                    max_date = end_date

        timesheet_read_group = self.env['account.analytic.line'].read_group(
            [('project_id', 'in', slots.project_id.ids),
             ('task_id', 'in', slots.task_id.ids),
             ('employee_id', 'in', list(work_data_per_employee_id.keys())),
             ('date', '>=', min_date),
             ('date', '<=', max_date),
             ('slot_id', '!=', False)],
            ['task_id', 'employee_id', 'date', 'timesheet_count:count(id)'],
            ['task_id', 'employee_id', 'date:day'],
            lazy=False,
        )
        timesheet_count_per_dates_per_task_and_employee = defaultdict(lambda: defaultdict(int))
        for res in timesheet_read_group:
            timesheet_date = datetime.strptime(res['date:day'], '%d %b %Y').date()
            timesheet_count_per_dates_per_task_and_employee[(res['task_id'][0], res['employee_id'][0])][timesheet_date] = res['timesheet_count']
        vals_list = []
        for slot in slots:
            work_hours_data = work_data_per_employee_id[slot.employee_id.id]
            timesheet_count_per_dates = timesheet_count_per_dates_per_task_and_employee[(slot.task_id.id, slot.employee_id.id)]
            for day_date, work_hours_count in work_hours_data:
                if timesheet_count_per_dates.get(day_date, 0.0):
                    continue
                if slot.start_datetime.date() <= day_date <= slot.end_datetime.date():
                    vals_list.append(slot.sudo()._prepare_slot_analytic_line(day_date, work_hours_count))

        if not vals_list:
            return self._get_notification_action("warning", _("There are no timesheets to generate or you don't have the right."))
        # Create with sudo as user does not have right for some private project and task of slots
        self.env['account.analytic.line'].sudo().create(vals_list)
        return self._get_notification_action("success", _('The timesheet entries have successfully been generated.'))

    def _prepare_slot_analytic_line(self, day_date, work_hours_count):
        self.ensure_one()
        ratio = self.allocated_percentage / 100.0 or 1
        return {
            'name': '/',
            'project_id': self.project_id.id,
            'task_id': self.task_id.id,
            'account_id': self.project_id.analytic_account_id.id,
            'unit_amount': work_hours_count * ratio,
            'user_id': self.user_id.id,
            'slot_id': self.id,
            'date': day_date,
            'employee_id': self.employee_id.id,
            'company_id': self.task_id.company_id.id or self.project_id.company_id.id,
        }

    def action_open_timesheets(self):
        self.ensure_one()
        action = self.env['ir.actions.act_window']._for_xml_id('hr_timesheet.timesheet_action_all')
        # Remove all references to the original action, to avoid studio and be able to change the action name
        action.pop('id', None)
        action.pop('xml_id', None)
        action.pop('display_name', None)
        action.update({
            'name': _('Timesheets'),
            'domain': self._get_timesheet_domain(),
            'view_mode': 'tree,grid,kanban,pivot,graph,form',
            'views': [
                [self.env.ref('hr_timesheet.timesheet_view_tree_user').id, 'tree'],
                [self.env.ref('timesheet_grid.timesheet_view_grid_by_employee').id, 'grid'],
                [self.env.ref('hr_timesheet.view_kanban_account_analytic_line').id, 'kanban'],
                [self.env.ref('hr_timesheet.view_hr_timesheet_line_pivot').id, 'pivot'],
                [self.env.ref('hr_timesheet.view_hr_timesheet_line_graph_all').id, 'graph'],
                [self.env.ref('timesheet_grid.timesheet_view_form').id, 'form'],
            ],
        })
        action['context'] = {
            'default_date': self.start_datetime.date()\
                if self.start_datetime < fields.Datetime.now() else fields.Date.today(),
            'default_employee_id': self.employee_id.id,
            'default_task_id': self.task_id.id,
            'default_project_id': self.project_id.id,
            'grid_anchor': self.start_datetime.date(),
        }
        if self.duration < 24:
            action['context']['default_unit_amount'] = self.allocated_hours
        return action
