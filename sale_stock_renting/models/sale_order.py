# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def write(self, vals):
        res = super().write(vals)
        if any(k in vals for k in ('rental_start_date', 'rental_return_date')) and self.env.user.has_group('sale_stock_renting.group_rental_stock_picking'):
            for order in self.filtered(lambda s: s.state == 'sale'):
                order.message_post(body=_("A new rental period will not propagate to stock pickings. You may need to manually change that."), message_type='notification')
        return res

    def action_open_pickup(self):
        if any(s.is_rental for s in self.picking_ids.filtered(lambda p: p.state not in ('done', 'cancel')).move_ids.sale_line_id):
            ready_picking = self.picking_ids.filtered(lambda p: p.state == 'assigned' and p.picking_type_code == 'outgoing')
            if ready_picking:
                return self._get_action_view_picking(ready_picking)
            return self._get_action_view_picking(self.picking_ids)
        return super().action_open_pickup()

    def action_open_return(self):
        if any(s.is_rental for s in self.picking_ids.filtered(lambda p: p.state not in ('done', 'cancel')).move_ids.sale_line_id):
            ready_picking = self.picking_ids.filtered(lambda p: p.state == 'assigned' and p.picking_type_code == 'incoming')
            if ready_picking:
                return self._get_action_view_picking(ready_picking)
            return self._get_action_view_picking(self.picking_ids)
        return super().action_open_return()
