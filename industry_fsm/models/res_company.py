# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, _


class ResCompany(models.Model):
    _name = 'res.company'
    _inherit = 'res.company'

    def _get_field_service_project_values(self):
        project_name = _("Field Service")
        type_ids = [
            (4, self.env.ref('industry_fsm.planning_project_stage_0').id),
            (4, self.env.ref('industry_fsm.planning_project_stage_1').id)]
        return [{
            'name': project_name,
            'is_fsm': True,
            'allow_timesheets': True,
            'type_ids': type_ids,
            'company_id': company.id
        } for company in self]

    @api.model_create_multi
    def create(self, vals_list):
        companies = super().create(vals_list)
        self.env['project.project'].sudo().create(companies._get_field_service_project_values())
        return companies
