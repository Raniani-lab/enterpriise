# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo import api, fields, models


class ReportProjectTaskUser(models.Model):
    _name = 'report.project.task.user.fsm'
    _inherit = 'report.project.task.user'
    _description = "FSM Tasks Analysis"

    fsm_done = fields.Boolean('Task Done', readonly=True)
    planning_overlap = fields.Integer('Planning Overlap', readonly=True, compute='_compute_planning_overlap', search='_search_planning_overlap')

    def _select(self):
        select_to_append = """,
                t.fsm_done as fsm_done
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
        """
        return super()._from() + from_to_append

    def _compute_planning_overlap(self):
        overlap_mapping = self.task_id._get_planning_overlap_per_task()
        if not overlap_mapping:
            self.planning_overlap = False
            return
        for task_analysis in self:
            task_analysis.planning_overlap = overlap_mapping.get(task_analysis.id, 0)

    @api.model
    def _search_planning_overlap(self, operator, value):
        return self.env['project.task']._search_planning_overlap(operator, value)
