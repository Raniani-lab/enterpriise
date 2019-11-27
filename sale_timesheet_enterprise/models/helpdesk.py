# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class HelpdeskTeam(models.Model):
    _inherit = 'helpdesk.team'

    def _create_project(self, name, allow_billable, other):
        fsm_time_product = self.env.ref('sale_timesheet_enterprise.fsm_time_product', raise_if_not_found=False) or self.env['product.product']
        timesheet_product_id = fsm_time_product.id if allow_billable else False
        new_values = dict(other, allow_billable=allow_billable, timesheet_product_id=timesheet_product_id, allow_material=False)
        return super(HelpdeskTeam, self)._create_project(name, allow_billable, new_values)
