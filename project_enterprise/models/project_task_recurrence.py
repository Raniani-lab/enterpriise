# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ProjectTaskRecurrence(models.Model):
    _inherit = 'project.task.recurrence'

    def _new_task_values(self, task_from, to_template=False):
        values = super()._new_task_values(task_from, to_template=to_template)
        values['planned_date_begin'] = self._get_postponed_date(task_from, 'planned_date_begin', to_template=to_template)
        values['planned_date_end'] = self._get_postponed_date(task_from, 'planned_date_end', to_template=to_template)
        return values
