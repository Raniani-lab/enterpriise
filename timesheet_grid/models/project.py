# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class Project(models.Model):
    _inherit = "project.project"

    def write(self, values):
        result = super(Project, self).write(values)
        if 'allow_timesheets' in values and not values['allow_timesheets']:
            self.env['timer.timer'].search([
                ('res_model', '=', "project.task"),
                ('res_id', 'in', self.with_context(active_test=False).task_ids.ids)
            ]).unlink()
        return result
