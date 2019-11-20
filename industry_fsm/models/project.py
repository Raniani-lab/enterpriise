# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta, datetime
import pytz

from odoo import fields, models, api, _
from odoo.osv import expression


# YTI TODO: Split file into 2
class Project(models.Model):
    _inherit = "project.project"

    is_fsm = fields.Boolean("Field Service", default=False, help="Display tasks in the Field Service module and allow planning with start/end dates.")

    @api.onchange('allow_timesheets')
    def _onchange_allow_timesheets(self):
        if self.allow_timesheets:
            self.allow_timesheet_timer = True
        else:
            self.allow_timesheet_timer = False


class Task(models.Model):
    _inherit = "project.task"

    @api.model
    def default_get(self, fields_list):
        result = super(Task, self).default_get(fields_list)
        user_tz = pytz.timezone(self.env.context.get('tz') or 'UTC')
        date_begin = result.get('planned_date_begin')
        if date_begin:
            date_begin = pytz.utc.localize(date_begin).astimezone(user_tz)
            date_begin = date_begin.replace(hour=9, minute=0, second=0)
            date_begin = date_begin.astimezone(pytz.utc).replace(tzinfo=None)
            result['planned_date_begin'] = date_begin
        date_end = result.get('planned_date_end')
        if date_end:
            date_end = pytz.utc.localize(date_end).astimezone(user_tz)
            date_end = date_end.replace(hour=17, minute=0, second=0)
            date_end = date_end.astimezone(pytz.utc).replace(tzinfo=None)
            result['planned_date_end'] = date_end
        if 'project_id' in fields_list and not result.get('project_id') and self._context.get('fsm_mode'):
            fsm_project = self.env['project.project'].search([('is_fsm', '=', True)], order='sequence', limit=1)
            result['project_id'] = fsm_project.id
        return result

    is_fsm = fields.Boolean(related='project_id.is_fsm', search='_search_is_fsm')
    planning_overlap = fields.Integer(compute='_compute_planning_overlap')
    fsm_done = fields.Boolean("Task Done", compute='_compute_fsm_done', readonly=False, store=True)
    user_id = fields.Many2one(group_expand='_read_group_user_ids')
    display_fsm_dates = fields.Boolean(compute='_compute_display_fsm_dates')

    # determines if planned_date_begin and planned_date_end used for the gantt
    # view should be visible on the task form view
    @api.depends('is_fsm')
    def _compute_display_fsm_dates(self):
        has_group_no_one = self.env.user.user_has_groups('base.group_no_one')
        for task in self:
            if task.is_fsm:
                task.display_fsm_dates = True
            elif has_group_no_one:
                task.display_fsm_dates = True
            else:
                task.display_fsm_dates = False

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
                ('user_id', '!=', False)
            ])
            search_domain = ['|', '|', ('id', 'in', users.ids), ('groups_id', 'in', self.env.ref('industry_fsm.group_fsm_user').id), ('id', 'in', recently_created_tasks.mapped('user_id.id'))]
            return users.search(search_domain, order=order)
        return users

    @api.depends('planned_date_begin', 'planned_date_end', 'user_id')
    def _compute_planning_overlap(self):
        if self.ids:
            query = """
                SELECT
                    T1.id, COUNT(T2.id)
                FROM
                    (
                        SELECT
                            T.id as id,
                            T.user_id as user_id,
                            T.project_id,
                            T.planned_date_begin as planned_date_begin,
                            T.planned_date_end as planned_date_end,
                            T.active as active
                        FROM project_task T
                        LEFT OUTER JOIN project_project P ON P.id = T.project_id
                        WHERE T.id IN %s
                            AND T.active = 't'
                            AND P.is_fsm = 't'
                            AND T.planned_date_begin IS NOT NULL
                            AND T.planned_date_end IS NOT NULL
                            AND T.project_id IS NOT NULL
                    ) T1
                INNER JOIN project_task T2
                    ON T1.id != T2.id
                        AND T2.active = 't'
                        AND T1.user_id = T2.user_id
                        AND T2.planned_date_begin IS NOT NULL
                        AND T2.planned_date_end IS NOT NULL
                        AND T2.project_id IS NOT NULL
                        AND (T1.planned_date_begin::TIMESTAMP, T1.planned_date_end::TIMESTAMP)
                            OVERLAPS (T2.planned_date_begin::TIMESTAMP, T2.planned_date_end::TIMESTAMP)
                GROUP BY T1.id
            """
            self.env.cr.execute(query, (tuple(self.ids),))
            raw_data = self.env.cr.dictfetchall()
            overlap_mapping = dict(map(lambda d: d.values(), raw_data))
            for task in self:
                task.planning_overlap = overlap_mapping.get(task.id, 0)
        else:
            self.planning_overlap = False

    def _compute_fsm_done(self):
        for task in self:
            closed_stage = task.project_id.type_ids.filtered('is_closed')
            if closed_stage:
                task.fsm_done = task.stage_id in closed_stage

    @api.onchange('project_id')
    def _onchange_project_id_fsm(self):
        if self.env.context.get('fsm_mode'):
            return {'domain': {'project_id': [('is_fsm', '=', True)]}}

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
        for task in self:
            # determine closed stage for task
            closed_stage = task.project_id.type_ids.filtered(lambda stage: stage.is_closed)
            if not closed_stage and len(task.project_id.type_ids) > 1:  # project without stage (or with only one)
                closed_stage = task.project_id.type_ids[-1]

            values = {'fsm_done': True}
            if closed_stage:
                values['stage_id'] = closed_stage.id

            task.write(values)

    def action_fsm_view_overlapping_tasks(self):
        fsm_task_form_view = self.env.ref('project.view_task_form2')
        fsm_task_list_view = self.env.ref('industry_fsm.project_task_view_list_fsm')
        fsm_task_kanban_view = self.env.ref('industry_fsm.project_task_view_kanban_fsm')
        domain = self._get_fsm_overlap_domain()[self.id]
        return {
            'type': 'ir.actions.act_window',
            'name': _('Overlapping Tasks'),
            'res_model': 'project.task',
            'domain': domain,
            'views': [(fsm_task_list_view.id, 'tree'), (fsm_task_kanban_view.id, 'kanban'), (fsm_task_form_view.id, 'form')],
            'context': {
                'fsm_mode': True,
                'task_nameget_with_hours': False,
            }
        }

    def _get_fsm_overlap_domain(self):
        domain_mapping = {}
        for task in self:
            domain_mapping[task.id] = [
                '&',
                    '&',
                        '&',
                            ('is_fsm', '=', True),
                            ('user_id', '=', task.user_id.id),
                        '&',
                            ('planned_date_begin', '<', task.planned_date_end),
                            ('planned_date_end', '>', task.planned_date_begin),
                    ('project_id', '!=', False)
            ]
            current_id = task._origin.id
            if current_id:
                domain_mapping[task.id] = expression.AND([domain_mapping[task.id], [('id', '!=', current_id)]])
        return domain_mapping
