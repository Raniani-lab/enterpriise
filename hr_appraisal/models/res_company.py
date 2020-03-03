# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    def _get_default_appraisal_body_html(self):
        # hardcoded link: FP and PO request.
        return """
        <p>An appraisal was requested.</p>
        <p>Please schedule an appraisal date together.</p>
        <p>Hereunder, you will find the link towards the Performance appraisal form:<br/>
        https://docs.google.com/document/d/15xewrZLDQYBNoWObUEfO3RXelaOQf7AoCsBuoxQs06U/edit<br/>
        The employee copies the document and completes his part, then shares the document with the manager with edit rights in order for him to complete his part.
        </p>
        <br/>
        Thank you!<br/>
        The HR department
        """

    appraisal_send_reminder = fields.Boolean(string='Send Automatic Appraisals Reminder', default=True)
    appraisal_reminder = fields.One2many('hr.appraisal.reminder', 'company_id', string='Appraisal Reminder',
        copy=True, groups="base.group_system")
    appraisal_by_manager = fields.Boolean(string='Manager', default=False)
    appraisal_by_employee = fields.Boolean(string='Employee', default=False)
    appraisal_by_collaborators = fields.Boolean(string='Collaborators', default=False)
    appraisal_by_colleagues = fields.Boolean(string='Colleagues', default=False)
    appraisal_by_manager_body_html = fields.Html('Manager Mail Content', default=_get_default_appraisal_body_html)
    appraisal_by_employee_body_html = fields.Html('Employee Mail Content', default=_get_default_appraisal_body_html)
    appraisal_by_collaborators_body_html = fields.Html('Collaborator Mail Content', default=_get_default_appraisal_body_html)
    appraisal_by_colleagues_body_html = fields.Html('Colleague Mail Content', default=_get_default_appraisal_body_html)
