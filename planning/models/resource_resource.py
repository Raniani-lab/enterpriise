# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict
from random import randint

from odoo import api, fields, models

from odoo.addons.resource.models.resource import Intervals

class ResourceResource(models.Model):
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

    # -----------------------------------------
    # Business Methods
    # -----------------------------------------

    def _get_calendars_validity_within_period(self, start, end, default_company=None):
        """
            Returns a dict of dict with resource's id as first key and resource's calendar as secondary key
            The value is the validity interval of the calendar for the given resource.

            Here the validity interval for each calendar is the whole interval but it's meant to be overriden in further modules
            handling resource's employee contracts.
        """
        assert start.tzinfo and end.tzinfo
        calendars_within_period_per_resource = defaultdict(lambda: defaultdict(Intervals))  # keys are [resource id:integer][calendar:self.env['resource.calendar']]
        default_calendar = default_company and default_company.resource_calendar_id or self.env.company.resource_calendar_id
        if not self:
            # if no resource, add the company resource calendar.
            calendars_within_period_per_resource[False][default_calendar] = Intervals([(start, end, self.env['resource.calendar.attendance'])])
        for resource in self:
            calendar = resource.calendar_id or resource.company_id.resource_calendar_id or default_calendar
            calendars_within_period_per_resource[resource.id][calendar] = Intervals([(start, end, self.env['resource.calendar.attendance'])])
        return calendars_within_period_per_resource
