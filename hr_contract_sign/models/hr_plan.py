# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrPlan(models.Model):
    _inherit = 'hr.plan'

    plan_signature_request_ids = fields.Many2many(
        'hr.plan.signature.request',
        string='Signature Requests',
        domain="[('company_id', '=', company_id)]")

    @api.depends('plan_signature_request_ids')
    def _compute_steps_count(self):
        super()._compute_steps_count()
        for plan in self:
            plan.steps_count += len(plan.plan_signature_request_ids)
