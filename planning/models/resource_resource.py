# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from random import randint

from odoo import api, fields, models

class ResourceResource(models.Model):
    _inherit = 'resource.resource'

    def _default_color(self):
        return randint(1, 11)

    color = fields.Integer(default=_default_color)
    avatar_128 = fields.Image(compute='_compute_avatar_128')
    role_ids = fields.Many2many('planning.role', 'resource_resource_planning_role_rel',
                                'resource_resource_id', 'planning_role_id', 'Roles',
                                compute='_compute_role_ids', store=True, readonly=False)
    default_role_id = fields.Many2one('planning.role', string="Default Role",
        compute='_compute_default_role_id', groups='hr.group_hr_user', store=True, readonly=False,
        help="Role that will be selected by default when creating a shift for this resource.\n"
             "This role will also have precedence over the other roles of the resource when planning shifts.")

    @api.depends('employee_id')
    def _compute_avatar_128(self):
        for resource in self:
            employees = resource.with_context(active_test=False).employee_id
            resource.avatar_128 = employees[0].avatar_128 if employees else False

    @api.depends('role_ids')
    def _compute_default_role_id(self):
        self.env.remove_to_compute(self._fields['role_ids'], self)
        for resource in self:
            if resource.default_role_id not in resource.role_ids:
                resource.default_role_id = resource.role_ids[:1]

    @api.depends('default_role_id')
    def _compute_role_ids(self):
        self.env.remove_to_compute(self._fields['default_role_id'], self)
        resources_wo_default_role_ids = []
        for resource in self:
            if resource.default_role_id:
                resource.role_ids |= resource.default_role_id
            else:
                resources_wo_default_role_ids.append(resource.id)
        self.browse(resources_wo_default_role_ids)._compute_default_role_id()

    def get_formview_id(self, access_uid=None):
        if self.env.context.get('from_planning'):
            return self.env.ref('planning.resource_resource_with_employee_form_view_inherit', raise_if_not_found=False).id
        return super().get_formview_id(access_uid)

    @api.model_create_multi
    def create(self, vals_list):
        resources = super().create(vals_list)
        if self.env.context.get('from_planning'):
            create_vals = []
            for resource in resources.filtered(lambda r: r.resource_type == 'user'):
                create_vals.append({
                    'name': resource.name,
                    'resource_id': resource.id,
                })
            self.env['hr.employee'].sudo().with_context(from_planning=False).create(create_vals)
        return resources

    def name_get(self):
        if not self.env.context.get('show_job_title'):
            return super().name_get()
        return [(
            resource.id,
            resource.employee_id._get_employee_name_with_job_title() if resource.employee_id else resource.name,
        ) for resource in self]
