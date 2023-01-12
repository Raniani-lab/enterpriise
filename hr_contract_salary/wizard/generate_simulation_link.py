# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import api, fields, models

from werkzeug.urls import url_encode


class GenerateSimulationLink(models.TransientModel):
    _name = 'generate.simulation.link'
    _description = 'Generate Simulation Link'

    contract_id = fields.Many2one(
        'hr.contract', string="Offer Template", required=True,
        domain="['|', ('employee_id', '=', False), ('employee_id', '=', employee_id)]")
    employee_contract_id = fields.Many2one('hr.contract')
    employee_id = fields.Many2one('hr.employee', related='employee_contract_id.employee_id')
    final_yearly_costs = fields.Monetary(string="Yearly Cost", required=True)
    currency_id = fields.Many2one(related='contract_id.currency_id')
    applicant_id = fields.Many2one('hr.applicant')
    job_title = fields.Char("Job Title")
    company_id = fields.Many2one(related="contract_id.company_id")
    employee_job_id = fields.Many2one(
        'hr.job', string="Job Position",
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    department_id = fields.Many2one(
        'hr.department', string="Department",
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]")
    contract_start_date = fields.Date("Contract Start Date", default=fields.Date.context_today)

    email_to = fields.Char('Email To', compute='_compute_email_to', store=True, readonly=False)
    url = fields.Char('Offer link', compute='_compute_url')
    display_warning_message = fields.Boolean(compute='_compute_warning_message', compute_sudo=True)

    @api.depends('employee_id.address_home_id.email', 'applicant_id.email_from')
    def _compute_email_to(self):
        for wizard in self:
            if wizard.employee_id:
                wizard.email_to = wizard.employee_id.address_home_id.email
            elif wizard.applicant_id:
                wizard.email_to = wizard.applicant_id.email_from

    def _get_url_triggers(self):
        return ['applicant_id', 'final_yearly_costs', 'employee_contract_id', 'job_title', 'employee_job_id', 'department_id', 'contract_start_date']

    @api.depends(lambda self: [key for key in self._fields.keys()])
    def _compute_url(self):
        for wizard in self:
            url = wizard.contract_id.get_base_url() + '/salary_package/simulation/contract/%s?' % (wizard.contract_id.id)
            params = {}
            for trigger in self._get_url_triggers():
                if wizard[trigger]:
                    params[trigger] = wizard[trigger].id if isinstance(wizard[trigger], models.BaseModel) else wizard[trigger]
            if wizard.applicant_id:
                params['token'] = wizard.applicant_id.access_token
            if wizard.contract_start_date:
                params['contract_start_date'] = wizard.contract_start_date
            if params:
                url = url + url_encode(params)
            wizard.url = url

    @api.onchange('contract_id')
    def _onchange_contract_id(self):
        self.final_yearly_costs = self.contract_id.final_yearly_costs

    @api.depends('employee_job_id')
    def _compute_warning_message(self):
        for wizard in self:
            current_job = wizard.employee_contract_id.job_id
            new_job = wizard.employee_job_id

            if (not current_job or current_job.id != new_job.id) and not new_job.default_contract_id:
                wizard.display_warning_message = True
            else:
                wizard.display_warning_message = False

    @api.onchange('applicant_id', 'employee_contract_id')
    def _onchange_job_selection(self):
        self.employee_job_id = self.employee_contract_id.job_id or self.applicant_id.job_id

    @api.onchange('employee_job_id')
    def _onchange_employee_job_id(self):
        self.job_title = self.employee_job_id.name
        if self.employee_job_id.department_id:
            self.department_id = self.employee_job_id.department_id

        if self.employee_contract_id and (self.employee_job_id == self.employee_contract_id.job_id or not self.employee_job_id.default_contract_id):
            self.contract_id = self.employee_contract_id
        else:
            self.contract_id = self.employee_job_id.default_contract_id

    def name_get(self):
        return [(w.id, w.employee_id.name or w.applicant_id.partner_name) for w in self]

    def send_offer(self):
        if self.applicant_id and (not self.applicant_id.access_token or self.applicant_id.access_token_end_date < fields.Date.today()):
            self.applicant_id.access_token = uuid.uuid4().hex
            self.applicant_id.access_token_end_date = self.env['hr.applicant']._get_access_token_end_date()
        try:
            template_id = self.env.ref('hr_contract_salary.mail_template_send_offer').id
        except ValueError:
            template_id = False
        try:
            template_applicant_id = self.env.ref('hr_contract_salary.mail_template_send_offer_applicant').id
        except ValueError:
            template_applicant_id = False
        partner_to = False
        email_to = False
        if self.employee_id:
            email_to = self.employee_id.work_email
        elif self.applicant_id:
            partner_to = self.applicant_id.partner_id
            if not partner_to:
                partner_to = self.env['res.partner'].create({
                    'is_company': False,
                    'name': self.applicant_id.partner_name,
                    'email': self.applicant_id.email_from,
                    'phone': self.applicant_id.partner_phone,
                    'mobile': self.applicant_id.partner_mobile
                })
                self.applicant_id.partner_id = partner_to

        if self.applicant_id:
            default_model = 'hr.applicant'
            default_res_id = self.applicant_id.id
            default_use_template = bool(template_applicant_id)
            default_template_id = template_applicant_id
        elif self.employee_contract_id:
            default_model = 'hr.contract'
            default_res_id = self.employee_contract_id.id
            default_use_template = bool(template_id)
            default_template_id = template_id
        else:
            default_model = 'hr.contract'
            default_res_id = self.contract_id.id
            default_use_template = bool(template_id)
            default_template_id = template_id

        ctx = {
            'default_model': default_model,
            'default_res_id': default_res_id,
            'default_use_template': default_use_template,
            'default_template_id': default_template_id,
            'default_composition_mode': 'comment',
            'salary_package_url': self.url,
            'default_email_layout_xmlid': "mail.mail_notification_light",
            'partner_to': partner_to and partner_to.id or False,
            'email_to': email_to or False,
            'mail_post_autofollow': False,
        }
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'mail.compose.message',
            'views': [[False, 'form']],
            'target': 'new',
            'context': ctx,
        }
