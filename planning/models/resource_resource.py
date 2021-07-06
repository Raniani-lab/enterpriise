# Part of Odoo. See LICENSE file for full copyright and licensing details.
from random import randint

from odoo import api, fields, models


class ResourceResource(models.BaseModel):
    _inherit = 'resource.resource'

    def _default_color(self):
        return randint(1, 11)

    color = fields.Integer(default=_default_color)
    employee_id = fields.One2many('hr.employee', 'resource_id', domain="[('company_id', '=', company_id)]")
    avatar_128 = fields.Image(related='employee_id.avatar_128')

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
            self.env['hr.employee'].sudo().create(create_vals)
        return resources
