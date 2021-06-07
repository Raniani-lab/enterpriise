# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.tools import html2plaintext, is_html_empty


class HrAppraisalGoal(models.Model):
    _name = "hr.appraisal.goal"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = "Appraisal Goal"

    name = fields.Char(required=True)
    employee_id = fields.Many2one('hr.employee', string="Owner",
        default=lambda self: self.env.user.employee_id, required=True)
    manager_id = fields.Many2one('hr.employee', string="Challenged By", required=True)
    progression = fields.Selection(selection=[
        ('0', '0 %'),
        ('25', '25 %'),
        ('50', '50 %'),
        ('75', '75 %'),
        ('100', '100 %')
    ], string="Progression", default="0", required=True)
    description = fields.Html()
    deadline = fields.Date()
    is_manager = fields.Boolean(compute='_compute_is_manager')
    text_description = fields.Text(compute="_compute_text_description")

    def _compute_is_manager(self):
        appraisal_user = self.env.user.has_group('hr_appraisal.group_hr_appraisal_user')
        self.update({'is_manager': appraisal_user})

    def action_confirm(self):
        self.write({'progression': '100'})

    def _compute_text_description(self):
        for rec in self:
            if not is_html_empty(rec.description):
                plaintext = html2plaintext(rec.description)
                if len(plaintext) >= 80:
                    rec.text_description = plaintext[0:77] + '...'
                else:
                    rec.text_description = plaintext
            else:
                rec.text_description = ""
