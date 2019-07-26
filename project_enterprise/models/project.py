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
    partner_email = fields.Char(related='partner_id.email', string='Customer Email', readonly=False)
    partner_phone = fields.Char(related='partner_id.phone', readonly=False)
    partner_mobile = fields.Char(related='partner_id.mobile', readonly=False)
    partner_zip = fields.Char(related='partner_id.zip', readonly=False)
    partner_street = fields.Char(related='partner_id.street', readonly=False)

    _sql_constraints = [
        ('planned_dates_check', "CHECK ((planned_date_begin <= planned_date_end))", "The planned start date must be anterior to the planned end date."),
    ]
