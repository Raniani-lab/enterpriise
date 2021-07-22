# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def action_confirm(self):
        res = super().action_confirm()
        for sla in self.mapped('order_line.product_template_id.sla_id'):
            order_lines = self.order_line.filtered(lambda x: x.product_template_id.sla_id == sla)
            sla.write({
                'sale_line_ids': [Command.link(l.id) for l in order_lines],
            })
        return res
