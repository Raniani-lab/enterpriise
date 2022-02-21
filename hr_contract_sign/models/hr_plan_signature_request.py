# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrPlanSignatureRequest(models.Model):
    _name = "hr.plan.signature.request"
    _description = 'HR Plan: Signature Request'
    _rec_name = 'sign_template_id'

    def _get_sign_template_ids(self):
        list_template = []
        for template in self.env['sign.template'].search([]):
            distinct_responsible_count = len(template.sign_item_ids.mapped('responsible_id'))
            if distinct_responsible_count in [1, 2]:
                list_template.append(template.id)
        return list_template

    def _sign_template_domain(self):
        return [('id', 'in', self._get_sign_template_ids())]

    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    sign_template_id = fields.Many2one(
        'sign.template',
        string='Document to sign',
        domain=_sign_template_domain,
        required=True,
        help="""Documents to sign. Only documents with 1 or 2 different responsible are selectable. Documents with 1 responsible will only have to be signed by the employee while documents with 2 different responsible will have to be signed by both the employee and the responsible.""")
    employee_role_id = fields.Many2one(
        "sign.item.role",
        string="Employee Role",
        required=True,
        domain="[('id', 'in', sign_template_responsible_ids)]",
        compute='_compute_employee_role_id',
        store=True,
        readonly=False,
        help="Employee's role on the templates to sign. The same role must be present in all the templates")
    sign_template_responsible_ids = fields.Many2many(
        'sign.item.role',
        compute='_compute_responsible_ids')
    responsible_signer = fields.Selection([
        ('hr_responsible', 'HR Responsible'),
        ('coach', 'Coach'),
        ('manager', 'Manager'),
        ('other', 'Other'),
    ], string="Responsible", default='hr_responsible', required=True)
    responsible_id = fields.Many2one(
        'res.users', 'Specific Signer')

    @api.depends('sign_template_responsible_ids')
    def _compute_employee_role_id(self):
        employee_role = self.env.ref('sign.sign_item_role_employee')
        for plan_type in self:
            if len(plan_type.sign_template_responsible_ids) == 1:
                plan_type.employee_role_id = plan_type.sign_template_responsible_ids._origin
            elif len(plan_type.sign_template_responsible_ids) == 2 and employee_role in plan_type.sign_template_responsible_ids._origin:
                plan_type.employee_role_id = employee_role
            else:
                plan_type.employee_role_id = False

    @api.depends('sign_template_id')
    def _compute_responsible_ids(self):
        for plan_type in self:
            plan_type.sign_template_responsible_ids = plan_type.sign_template_id.sign_item_ids.responsible_id
