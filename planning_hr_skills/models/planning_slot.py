# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.addons.resource.models.utils import filter_domain_leaf
from odoo.osv import expression

class PlanningSlot(models.Model):
    _inherit = 'planning.slot'

    employee_skill_ids = fields.One2many(related='employee_id.employee_skill_ids', string='Skills')

    @api.model
    def _read_group_resource_id(self, resources, domain, order):
        """
        overriding
        _read_group_resource_id adds 'resource_ids' in the domain corresponding to 'employee_skill_ids' fields already in the domain
        """
        # 1. Check if the domain contains employee_skill_ids and create a new domain to search hr.skill records
        skill_search_domain = []
        # fields to remove from the domain to only have employee_skill_ids
        employee_id_in_domain = False

        for leaf in domain:
            if not isinstance(leaf, (tuple, list)) or len(leaf) != 3:
                skill_search_domain.append(leaf)
            elif leaf[0] == 'employee_skill_ids':
                employee_id_in_domain = True
                skill_search_domain.append(('name', leaf[1], leaf[2]))
            elif leaf[0] == 'name':
                skill_search_domain.append(('dummy', leaf[1], leaf[2]))
            else:
                skill_search_domain.append(leaf)

        if not employee_id_in_domain:
            return super()._read_group_resource_id(resources, domain, order)
        skill_search_domain = filter_domain_leaf(skill_search_domain, lambda field: field == 'name')

        # 2. Get matching employee_ids for every employee_skill_id found in the initial domain
        skill_ids = self.env['hr.skill']._search(skill_search_domain)
        employee_skill_read_group = self.env['hr.employee.skill']._read_group(
            [('skill_id', 'in', skill_ids)],
            ['employees:array_agg(employee_id)'],
            [],
        )
        matching_employee_ids = employee_skill_read_group[0]['employees'] if employee_skill_read_group else []

        # 3. Looking for corresponding resources
        matching_resource_ids = self.env['resource.resource']._search([('employee_id', 'in', matching_employee_ids)])

        filtered_domain = expression.AND([
            [('resource_id', 'in', matching_resource_ids)],
            domain,
        ])
        return super()._read_group_resource_id(resources, filtered_domain, order)
