# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Project(models.Model):
    _inherit = "project.project"

    allow_planning = fields.Boolean('Allow Planning', default=False)


class Task(models.Model):
    _inherit = "project.task"

    allow_planning = fields.Boolean(related="project_id.allow_planning")
    planned_date_begin = fields.Datetime("Start date")
    planned_date_end = fields.Datetime("End date")
