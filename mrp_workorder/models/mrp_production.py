# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _
from odoo.exceptions import UserError


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    check_ids = fields.One2many('quality.check', 'production_id', string="Checks")

    @api.depends('workorder_ids.check_ids')
    def _compute_state(self):
        super()._compute_state()
        for production in self:
            if production.state == 'to_close' and any(x.quality_state == 'none' for x in production.workorder_ids.check_ids):
                production.state = 'progress'

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

    def _button_mark_done_sanity_checks(self):
        if any(x.quality_state == 'none' for x in self.workorder_ids.check_ids):
            raise UserError(_('You still need to do the quality checks!'))
        return super()._button_mark_done_sanity_checks()
