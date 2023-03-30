# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class HrEmployee(models.Model):
    _inherit = "hr.employee"

    salary_simulator_link_end_validity = fields.Date('Salary Simulator Link Validity Date', groups="hr.group_hr_user", copy=False)
