# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    check_ids = fields.One2many('quality.check', 'production_id', string="Checks")

    def action_confirm(self):
        res = super().action_confirm()
        self.workorder_ids._create_checks()
        return res

    def action_assign(self):
        res = super().action_assign()
        for production in self:
            for workorder in production.workorder_ids:
                for check in workorder.check_ids:
                    if check.test_type not in ('register_consumed_materials', 'register_byproducts'):
                        continue
                    if check.move_line_id:
                        continue
                    check.write(workorder._defaults_from_move(check.move_id))
        return res

    def _generate_backorder_productions(self, close_mo=True):
        backorders = super()._generate_backorder_productions(close_mo=close_mo)
        for wo in backorders.workorder_ids:
            if wo.component_id:
                wo._update_component_quantity()
        return backorders
