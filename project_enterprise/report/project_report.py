# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo import api, fields, models


class ReportProjectTaskUser(models.Model):
    _inherit = 'report.project.task.user'

    allocated_hours = fields.Float("Allocated Hours", readonly=True)
    planned_date_begin = fields.Datetime("Start date", readonly=True)
    planned_date_end = fields.Datetime("End date", readonly=True)

    def _select(self):
        return super()._select() + """,
            t.planned_date_begin,
            t.planned_date_end,
            t.allocated_hours
        """

    def _group_by(self):
        return super()._group_by() + """,
            t.planned_date_begin,
            t.planned_date_end
        """
