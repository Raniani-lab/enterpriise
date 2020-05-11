# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    check_ids = fields.One2many('quality.check', 'production_id', string="Checks")

    def button_plan(self):
        res = super(MrpProduction, self).button_plan()
        orders_to_plan = self.filtered(lambda order: not order.is_planned)
        for order in orders_to_plan:
            workorder_to_plan = order.workorder_ids.filtered(lambda wo: not (wo.date_planned_start or wo.date_planned_finished))
            if not workorder_to_plan.mapped('check_ids'):
                workorder_to_plan._create_checks()
        return res
