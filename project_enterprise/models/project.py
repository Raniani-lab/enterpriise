# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectTaskType(models.Model):
    _inherit = 'project.task.type'

    is_closed = fields.Boolean('Is a close stage', help="Tasks in this stage are considered as closed.")


class Project(models.Model):
    _inherit = "project.project"

    allow_planning = fields.Boolean('Allow Planning', default=False, help='Enables planning of Task with a Start and End date.')


class Task(models.Model):
    _inherit = "project.task"

    allow_planning = fields.Boolean(related="project_id.allow_planning")
    planned_date_begin = fields.Datetime("Start date")
    planned_date_end = fields.Datetime("End date")
