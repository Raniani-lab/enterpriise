# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta, datetime, time
import pytz

from odoo import Command, fields, models, api, _


# YTI TODO: Split file into 2
class Project(models.Model):
    _inherit = "project.project"

    is_fsm = fields.Boolean("Field Service", default=False, help="Display tasks in the Field Service module and allow planning with start/end dates.")
    allow_subtasks = fields.Boolean(
        compute="_compute_allow_subtasks", store=True, readonly=False)
    allow_task_dependencies = fields.Boolean(compute='_compute_allow_task_dependencies', store=True, readonly=False)
    allow_worksheets = fields.Boolean(
        "Worksheets", compute="_compute_allow_worksheets", store=True, readonly=False,
        help="Enables customizable worksheets on tasks.")

    @api.depends("is_fsm")
    def _compute_allow_subtasks(self):
        has_group = self.env.user.has_group("project.group_subtask_project")
        for project in self:
            project.allow_subtasks = has_group and not project.is_fsm

    @api.depends('is_fsm')
    def _compute_allow_task_dependencies(self):
        has_group = self.user_has_groups('project.group_project_task_dependencies')
        for project in self:
            project.allow_task_dependencies = has_group and not project.is_fsm

    def _compute_allow_worksheets(self):
        for project in self:
            if not project._origin:
                project.allow_worksheets = project.is_fsm

    @api.model
    def default_get(self, fields_list):
        defaults = super().default_get(fields_list)
        if 'allow_subtasks' in fields_list:
            defaults['allow_subtasks'] = defaults.get('allow_subtasks', False) and not defaults.get('is_fsm')
        if 'allow_task_dependencies' in fields_list:
            defaults['allow_task_dependencies'] = defaults.get('allow_task_dependencies', False) and not defaults.get('is_fsm')
        return defaults


class Task(models.Model):
    _inherit = "project.task"

    @api.model
    def default_get(self, fields_list):
        result = super(Task, self).default_get(fields_list)
        is_fsm_mode = self._context.get('fsm_mode')
        if 'project_id' in fields_list and not result.get('project_id') and is_fsm_mode:
            company_id = self.env.context.get('default_company_id') or self.env.company.id
            fsm_project = self.env['project.project'].search([('is_fsm', '=', True), ('company_id', '=', company_id)], order='sequence', limit=1)
            result['project_id'] = fsm_project.id

        date_begin = result.get('planned_date_begin')
        date_end = result.get('planned_date_end')
        if is_fsm_mode and (date_begin or date_end):
            if not date_begin:
                date_begin = date_end.replace(hour=0, minute=0, second=1)
            if not date_end:
                date_end = date_begin.replace(hour=23, minute=59, second=59)
            date_diff = date_end - date_begin
            if date_diff.days > 0:
                # force today if default is more than 24 hours (for eg. "Add" button in gantt view)
                today = fields.Date.context_today(self)
                date_begin = datetime.combine(today, time(0, 0, 0))
                date_end = datetime.combine(today, time(23, 59, 59))
            if date_diff.seconds / 3600 > 23.5:
                # if the interval between both dates are more than 23 hours and 30 minutes
                # then we changes those dates to fit with the working schedule of the assigned user or the current company
                # because we assume here, the planned dates are not the ones chosen by the current user.
                user_tz = pytz.timezone(self.env.context.get('tz') or 'UTC')
                date_begin = pytz.utc.localize(date_begin).astimezone(user_tz)
                date_end = pytz.utc.localize(date_end).astimezone(user_tz)
                user_ids_list = [res[2] for res in result.get('user_ids', []) if len(res) == 3 and res[0] == Command.SET]  # user_ids = [(Command.SET, 0, <user_ids>)]
                user_ids = user_ids_list[-1] if user_ids_list else []
                users = self.env['res.users'].sudo().browse(user_ids)
                user = len(users) == 1 and users
                if user and user.employee_id:  # then the default start/end hours correspond to what is configured on the employee calendar
                    resource_calendar = user.resource_calendar_id
                else:  # Otherwise, the default start/end hours correspond to what is configured on the company calendar
                    company = self.env['res.company'].sudo().browse(result.get('company_id')) if result.get(
                        'company_id') else self.env.user.company_id
                    resource_calendar = company.resource_calendar_id
                if resource_calendar:
                    resources_work_intervals = resource_calendar._work_intervals_batch(date_begin, date_end)
                    work_intervals = [(start, stop) for start, stop, meta in resources_work_intervals[False]]
                    if work_intervals:
                        planned_date_begin = work_intervals[0][0].astimezone(pytz.utc).replace(tzinfo=None)
                        planned_date_end = work_intervals[-1][1].astimezone(pytz.utc).replace(tzinfo=None)
                        result['planned_date_begin'] = planned_date_begin
                        result['planned_date_end'] = planned_date_end
                else:
                    result['planned_date_begin'] = date_begin.replace(hour=9, minute=0, second=1).astimezone(pytz.utc).replace(tzinfo=None)
                    result['planned_date_end'] = date_end.astimezone(pytz.utc).replace(tzinfo=None)
        return result

    allow_worksheets = fields.Boolean(related='project_id.allow_worksheets')
    is_fsm = fields.Boolean(related='project_id.is_fsm', search='_search_is_fsm')
    fsm_done = fields.Boolean("Task Done", compute='_compute_fsm_done', readonly=False, store=True, copy=False)
    user_ids = fields.Many2many(group_expand='_read_group_user_ids')
    # Use to count conditions between : time, worksheet and materials
    # If 2 over 3 are enabled for the project, the required count = 2
    # If 1 over 3 is met (enabled + encoded), the satisfied count = 2
    display_enabled_conditions_count = fields.Integer(compute='_compute_display_conditions_count')
    display_satisfied_conditions_count = fields.Integer(compute='_compute_display_conditions_count')
    display_mark_as_done_primary = fields.Boolean(compute='_compute_mark_as_done_buttons')
    display_mark_as_done_secondary = fields.Boolean(compute='_compute_mark_as_done_buttons')
    display_sign_report_primary = fields.Boolean(compute='_compute_display_sign_report_buttons')
    display_sign_report_secondary = fields.Boolean(compute='_compute_display_sign_report_buttons')
    display_send_report_primary = fields.Boolean(compute='_compute_display_send_report_buttons')
    display_send_report_secondary = fields.Boolean(compute='_compute_display_send_report_buttons')
    has_complete_partner_address = fields.Boolean(compute='_compute_has_complete_partner_address')
    worksheet_signature = fields.Binary('Signature', help='Signature received through the portal.', copy=False, attachment=True)
    worksheet_signed_by = fields.Char('Signed By', help='Name of the person that signed the task.', copy=False)
    fsm_is_sent = fields.Boolean('Is Worksheet sent', readonly=True)
    comment = fields.Html(string='Comments', copy=False)

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS | {'allow_worksheets',
                                              'is_fsm',
                                              'planned_date_begin',
                                              'planned_date_end',
                                              'fsm_done',
                                              'partner_phone',
                                              'partner_city',
                                              'worksheet_signature',  # [XBO] TODO: remove me in master
                                              'has_complete_partner_address'}

    @api.depends(
        'fsm_done', 'is_fsm', 'timer_start',
        'display_enabled_conditions_count', 'display_satisfied_conditions_count')
    def _compute_mark_as_done_buttons(self):
        for task in self:
            primary, secondary = True, True
            if task.fsm_done or not task.is_fsm or task.timer_start:
                primary, secondary = False, False
            else:
                if task.display_enabled_conditions_count == task.display_satisfied_conditions_count:
                    secondary = False
                else:
                    primary = False
            task.update({
                'display_mark_as_done_primary': primary,
                'display_mark_as_done_secondary': secondary,
            })

    @api.depends('allow_worksheets', 'project_id.allow_timesheets', 'total_hours_spent', 'comment')
    def _compute_display_conditions_count(self):
        for task in self:
            enabled = 1 if task.project_id.allow_timesheets else 0
            satisfied = 1 if enabled and task.total_hours_spent else 0
            enabled += 1 if task.allow_worksheets else 0
            satisfied += 1 if task.allow_worksheets and task.comment else 0
            task.update({
                'display_enabled_conditions_count': enabled,
                'display_satisfied_conditions_count': satisfied
            })

    @api.depends('fsm_done', 'display_timesheet_timer', 'timer_start', 'total_hours_spent')
    def _compute_display_timer_buttons(self):
        fsm_done_tasks = self.filtered(lambda task: task.fsm_done)
        fsm_done_tasks.update({
            'display_timer_start_primary': False,
            'display_timer_start_secondary': False,
            'display_timer_stop': False,
            'display_timer_pause': False,
            'display_timer_resume': False,
        })
        super(Task, self - fsm_done_tasks)._compute_display_timer_buttons()

    def _hide_sign_button(self):
        self.ensure_one()
        return not self.allow_worksheets or self.timer_start or self.worksheet_signature \
            or not self.display_satisfied_conditions_count

    @api.depends(
        'allow_worksheets', 'timer_start', 'worksheet_signature',
        'display_satisfied_conditions_count', 'display_enabled_conditions_count')
    def _compute_display_sign_report_buttons(self):
        for task in self:
            sign_p, sign_s = True, True
            if task._hide_sign_button():
                sign_p, sign_s = False, False
            else:
                if task.display_enabled_conditions_count == task.display_satisfied_conditions_count:
                    sign_s = False
                else:
                    sign_p = False
            task.update({
                'display_sign_report_primary': sign_p,
                'display_sign_report_secondary': sign_s,
            })

    def _hide_send_report_button(self):
        self.ensure_one()
        return not self.allow_worksheets or self.timer_start or not self.display_satisfied_conditions_count \
            or self.fsm_is_sent

    @api.depends(
        'allow_worksheets', 'timer_start',
        'display_satisfied_conditions_count', 'display_enabled_conditions_count',
        'fsm_is_sent')
    def _compute_display_send_report_buttons(self):
        for task in self:
            send_p, send_s = True, True
            if task._hide_send_report_button():
                send_p, send_s = False, False
            else:
                if task.display_enabled_conditions_count == task.display_satisfied_conditions_count:
                    send_s = False
                else:
                    send_p = False
            task.update({
                'display_send_report_primary': send_p,
                'display_send_report_secondary': send_s,
            })

    @api.depends('partner_id')
    def _compute_has_complete_partner_address(self):
        for task in self:
            task.has_complete_partner_address = task.partner_id.city and task.partner_id.country_id

    @api.model
    def _search_is_fsm(self, operator, value):
        query = """
            SELECT p.id
            FROM project_project P
            WHERE P.active = 't' AND P.is_fsm
        """
        operator_new = operator == "=" and "inselect" or "not inselect"
        return [('project_id', operator_new, (query, ()))]

    @api.model
    def _read_group_user_ids(self, users, domain, order):
        if self.env.context.get('fsm_mode'):
            recently_created_tasks = self.env['project.task'].search([
                ('create_date', '>', datetime.now() - timedelta(days=30)),
                ('is_fsm', '=', True),
                ('user_ids', '!=', False)
            ])
            search_domain = ['|', '|', ('id', 'in', users.ids), ('groups_id', 'in', self.env.ref('industry_fsm.group_fsm_user').id), ('id', 'in', recently_created_tasks.mapped('user_ids.id'))]
            return users.search(search_domain, order=order)
        return users

    def _compute_fsm_done(self):
        for task in self:
            closed_stage = task.project_id.type_ids.filtered('is_closed')
            if closed_stage:
                task.fsm_done = task.stage_id in closed_stage

    def action_fsm_worksheet(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'project.task',
            'res_id': self.id,
            'view_mode': 'form',
            'context': {'form_view_initial_mode': 'edit', 'task_worksheet_comment': True},
            'views': [[self.env.ref('industry_fsm.fsm_form_view_comment').id, 'form']],
        }

    def action_view_timesheets(self):
        kanban_view = self.env.ref('hr_timesheet.view_kanban_account_analytic_line')
        form_view = self.env.ref('industry_fsm.timesheet_view_form')
        tree_view = self.env.ref('industry_fsm.timesheet_view_tree_user_inherit')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Time'),
            'res_model': 'account.analytic.line',
            'view_mode': 'list,form,kanban',
            'views': [(tree_view.id, 'list'), (kanban_view.id, 'kanban'), (form_view.id, 'form')],
            'domain': [('task_id', '=', self.id), ('project_id', '!=', False)],
            'context': {
                'fsm_mode': True,
                'default_project_id': self.project_id.id,
                'default_task_id': self.id,
            }
        }

    def action_fsm_validate(self):
        """ Moves Task to next stage.
            If allow billable on task, timesheet product set on project and user has privileges :
            Create SO confirmed with time and material.
        """
        self._stop_all_timers_and_create_timesheets()
        closed_stage_by_project = {
            project.id:
                project.type_ids.filtered(lambda stage: stage.is_closed)[:1] or project.type_ids[-1:]
            for project in self.project_id
        }
        for task in self:
            # determine closed stage for task
            closed_stage = closed_stage_by_project.get(self.project_id.id)
            values = {'fsm_done': True}
            if closed_stage:
                values['stage_id'] = closed_stage.id

            task.write(values)

    def _stop_all_timers_and_create_timesheets(self):
        ConfigParameter = self.env['ir.config_parameter'].sudo()
        Timesheet = self.env['account.analytic.line']

        running_timer_ids = self.env['timer.timer'].sudo().search([('res_model', '=', 'project.task'), ('res_id', 'in', self.ids)])
        if not running_timer_ids:
            return Timesheet

        task_dict = {task.id: task for task in self}
        minimum_duration = int(ConfigParameter.get_param('hr_timesheet.timesheet_min_duration', 0))
        rounding = int(ConfigParameter.get_param('hr_timesheet.timesheet_rounding', 0))
        timesheets = []
        for timer in running_timer_ids:
            minutes_spent = timer._get_minutes_spent()
            time_spent = self._timer_rounding(minutes_spent, minimum_duration, rounding) / 60
            task = task_dict[timer.res_id]
            timesheets.append({
                'task_id': task.id,
                'project_id': task.project_id.id,
                'user_id': timer.user_id.id,
                'unit_amount': time_spent,
            })
        running_timer_ids.unlink()
        return Timesheet.create(timesheets)

    def action_fsm_navigate(self):
        if not self.partner_id.partner_latitude and not self.partner_id.partner_longitude:
            self.partner_id.geo_localize()
        # YTI TODO: The url should be set with single method everywhere in the codebase
        url = "https://www.google.com/maps/dir/?api=1&destination=%s,%s" % (self.partner_id.partner_latitude, self.partner_id.partner_longitude)
        return {
            'type': 'ir.actions.act_url',
            'url': url,
            'target': 'new'
        }

    def action_preview_worksheet(self):
        self.ensure_one()
        source = 'fsm' if self._context.get('fsm_mode', False) else 'project'
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url': self.get_portal_url(suffix='/worksheet/%s' % source)
        }

    def action_send_report(self):
        tasks_with_report = self.filtered(lambda task: task._is_fsm_report_available())
        if not tasks_with_report:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'message': _("There are no reports to send."),
                    'sticky': False,
                    'type': 'danger',
                }
            }

        template_id = self.env.ref('industry_fsm.mail_template_data_task_report').id
        return {
            'name': _("Send report"),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'mail.compose.message',
            'views': [(False, 'form')],
            'view_id': False,
            'target': 'new',
            'context': {
                'default_composition_mode': 'mass_mail' if len(tasks_with_report.ids) > 1 else 'comment',
                'default_model': 'project.task',
                'default_res_id': tasks_with_report.ids[0],
                'default_use_template': bool(template_id),
                'default_template_id': template_id,
                'fsm_mark_as_sent': True,
                'active_ids': tasks_with_report.ids,
            },
        }

    def _get_report_base_filename(self):
        self.ensure_one()
        return 'Worksheet %s - %s' % (self.name, self.partner_id.name)

    def _is_fsm_report_available(self):
        self.ensure_one()
        return self.comment or self.timesheet_ids

    def has_to_be_signed(self):
        self.ensure_one()
        return self.allow_worksheets and not self.worksheet_signature

    @api.model
    def fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        toolbar = not self._context.get('task_worksheet_comment') and toolbar
        res = super().fields_view_get(view_id, view_type, toolbar, submenu)
        return res

    # ---------------------------------------------------------
    # Business Methods
    # ---------------------------------------------------------

    def _message_post_after_hook(self, message, *args, **kwargs):
        if self.env.context.get('fsm_mark_as_sent') and not self.fsm_is_sent:
            self.fsm_is_sent = True

    @api.model
    def get_unusual_days(self, date_from, date_to=None):
        return self.env.user.employee_id._get_unusual_days(date_from, date_to)
