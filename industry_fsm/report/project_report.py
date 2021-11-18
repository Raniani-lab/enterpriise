# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo import fields, models


class ReportProjectTaskUser(models.Model):
    _name = 'report.project.task.user.fsm'
    _inherit = 'report.project.task.user'
    _description = "FSM Tasks Analysis"

    fsm_done = fields.Boolean('Task Done', readonly=True)
    planning_overlap = fields.Integer('Planning Overlap', readonly=True)

    def _select(self):
        select_to_append = """,
                t.fsm_done as fsm_done,
                COUNT(t2.id) as planning_overlap
        """
        return super()._select() + select_to_append

    def _group_by(self):
        group_by_append = """,
                t.fsm_done
        """
        return super(ReportProjectTaskUser, self)._group_by() + group_by_append

    def _from(self):
        from_to_append = """
                INNER JOIN project_project pp
                    ON pp.id = t.project_id
                    AND pp.is_fsm = 'true'
                LEFT JOIN project_task_user_rel u1
                    ON t.id = u1.task_id
                LEFT JOIN project_task t2
                    ON t.id != t2.id
                    AND t2.active = 't'
                    AND t2.planned_date_begin IS NOT NULL
                    AND t2.planned_date_end IS NOT NULL
                    AND t2.project_id IS NOT NULL
                    AND (t.planned_date_begin::TIMESTAMP, t.planned_date_end::TIMESTAMP)
                        OVERLAPS (t2.planned_date_begin::TIMESTAMP, t2.planned_date_end::TIMESTAMP)
                LEFT JOIN project_task_user_rel u2
                    ON t2.id = u2.task_id
                    AND u2.user_id = u1.user_id
        """
        return super()._from() + from_to_append
