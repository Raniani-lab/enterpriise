# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectTaskType(models.Model):
    _inherit = 'project.task.type'

    is_closed = fields.Boolean('Is a close stage', help="Tasks in this stage are considered as closed.")


class Task(models.Model):
    _inherit = "project.task"

    planned_date_begin = fields.Datetime("Start date")
    planned_date_end = fields.Datetime("End date")

    _sql_constraints = [
        ('planned_dates_check', "CHECK ((planned_date_begin <= planned_date_end))", "The planned start date must be anterior to the planned end date."),
    ]
