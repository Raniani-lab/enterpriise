# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo import models, fields


class ReportProjectTaskUser(models.Model):
    _inherit = 'report.project.task.user'

    planned_date_begin = fields.Datetime("Start date", readonly=True)
    planned_date_end = fields.Datetime("End date", readonly=True)

    def _select(self):
        return super(ReportProjectTaskUser, self)._select() + """,
            t.planned_date_begin as planned_date_begin,
            t.planned_date_end as planned_date_end
        """

    def _group_by(self):
        return super(ReportProjectTaskUser, self)._group_by() + """,
            t.planned_date_begin,
            t.planned_date_end
        """
