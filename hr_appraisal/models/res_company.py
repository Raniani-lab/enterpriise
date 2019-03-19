# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    def _get_default_appraisal_body_html(self):
        return """
        <p>Please fill out the appraisal survey you received.<br/><br/>
        Thank you for your participation.</p>"""

    appraisal_send_reminder = fields.Boolean(string='Send Automatic Appraisals Reminder', default=True)
    appraisal_reminder = fields.One2many('hr.appraisal.reminder', 'company_id', string='Appraisal Reminder',
        copy=True, groups="base.group_system")
    appraisal_by_manager = fields.Boolean(string='Manager', default=True)
    appraisal_by_employee = fields.Boolean(string='Employee', default=True)
    appraisal_by_collaborators = fields.Boolean(string='Collaborators', default=False)
    appraisal_by_colleagues = fields.Boolean(string='Colleagues', default=False)
    appraisal_by_manager_body_html = fields.Html('Manager Mail Content', default=_get_default_appraisal_body_html)
    appraisal_by_employee_body_html = fields.Html('Employee Mail Content', default=_get_default_appraisal_body_html)
    appraisal_by_collaborators_body_html = fields.Html('Collaborator Mail Content', default=_get_default_appraisal_body_html)
    appraisal_by_colleagues_body_html = fields.Html('Colleague Mail Content', default=_get_default_appraisal_body_html)
