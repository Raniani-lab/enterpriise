# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, Command, fields, models, _
from odoo.exceptions import UserError


class FsmStockTracking(models.TransientModel):
    _name = 'fsm.stock.tracking'
    _description = 'Track Stock'

    task_id = fields.Many2one('project.task')
    fsm_done = fields.Boolean(related='task_id.fsm_done')
    product_id = fields.Many2one('product.product')
    tracking = fields.Selection(related='product_id.tracking')

    tracking_line_ids = fields.One2many('fsm.stock.tracking.line', 'wizard_tracking_line')
    tracking_validated_line_ids = fields.One2many('fsm.stock.tracking.line', 'wizard_tracking_line_validated')
    company_id = fields.Many2one('res.company', 'Company')
    default_warehouse_id = fields.Many2one('stock.warehouse', 'Your default warehouse',
                                           compute="_compute_default_warehouse_id")
    is_same_warehouse = fields.Boolean('Same warehouse', compute="_compute_is_same_warehouse")

    @api.depends('tracking_line_ids.is_same_warehouse')
    def _compute_is_same_warehouse(self):
        for tracking in self:
            tracking.is_same_warehouse = all(tracking.tracking_line_ids.mapped('is_same_warehouse'))

    def _compute_default_warehouse_id(self):
        self.default_warehouse_id = self.env.user._get_default_warehouse_id()

    def generate_lot(self):
        self.ensure_one()
        if self.fsm_done:
            return

        if self.tracking_line_ids.filtered(lambda l: not l.lot_id):
            raise UserError(_('Each line needs a Lot/Serial Number'))

        SaleOrderLine = self.env['sale.order.line'].sudo()

        sale_lines_remove = SaleOrderLine.search([
            ('order_id', '=', self.task_id.sale_order_id.id),
            ('product_id', '=', self.product_id.id),
            ('id', 'not in', self.tracking_line_ids.sale_order_line_id.ids),
            ('task_id', '=', self.task_id.id)
        ])

        for line in self.tracking_line_ids:
            qty = line.quantity if self.tracking == 'lot' else 1
            if line.sale_order_line_id:
                line.sale_order_line_id.write(
                    {
                        'fsm_lot_id': line.lot_id,
                        'product_uom_qty': qty + line.sale_order_line_id.qty_delivered,
                    })
            elif qty:
                vals = {
                    'order_id': self.task_id.sale_order_id.id,
                    'product_id': self.product_id.id,
                    'product_uom_qty': qty,
                    'task_id': self.task_id.id,
                    'fsm_lot_id': line.lot_id.id,
                }
                SaleOrderLine.with_context(industry_fsm_stock_tracking=True).create(vals)

        if self.task_id.sale_order_id.state == 'draft':
            sale_lines_remove.unlink()
        else:
            for sl in sale_lines_remove:
                sl.product_uom_qty = sl.qty_delivered
                if sl.qty_delivered == 0 and sl.fsm_lot_id:
                    editable_moves = sl.move_ids.filtered(lambda m: m.state not in ['done', 'cancel'])
                    editable_moves.move_line_ids.unlink()
                    editable_moves.lot_ids -= sl.fsm_lot_id
                    sl.fsm_lot_id = False


class FsmStockTrackingLine(models.TransientModel):
    _name = 'fsm.stock.tracking.line'
    _description = 'Lines for FSM Stock Tracking'

    def _default_warehouse_id(self):
        return [Command.set([self.env.user._get_default_warehouse_id().id])]

    lot_id = fields.Many2one('stock.lot', string='Lot/Serial Number', domain="[('product_id', '=', product_id)]", check_company=True)
    quantity = fields.Float(required=True, default=1)
    product_id = fields.Many2one('product.product')
    sale_order_line_id = fields.Many2one('sale.order.line')
    company_id = fields.Many2one('res.company', 'Company')
    wizard_tracking_line = fields.Many2one('fsm.stock.tracking', string="Tracking Line")
    wizard_tracking_line_validated = fields.Many2one('fsm.stock.tracking', string="Validated Tracking Line")
    is_same_warehouse = fields.Boolean('Same warehouse', compute="_compute_warehouse", default=True)
    warehouse_id = fields.Many2one("stock.warehouse", compute="_compute_warehouse", default=_default_warehouse_id)

    @api.depends_context('uid')
    def _compute_warehouse(self):
        default_warehouse = self.env.user._get_default_warehouse_id()
        for line in self:
            if not isinstance(line.id, models.NewId):
                so_lines_warehouses = line.sale_order_line_id.move_ids.warehouse_id
                if len(so_lines_warehouses) > 1:
                    # If there is more than one we ensure not taking the default warehouse in order to avoid unwanted
                    # moves as this would mean we already have several move_ids (which would only occur through the use
                    # of other apps than FSM (inventory app for instance)). This should indeed not be possible through
                    # the use of the FSM app only.
                    line.warehouse_id = so_lines_warehouses.filtered(lambda w: w.id != default_warehouse.id)[0]
                else:
                    line.warehouse_id = so_lines_warehouses or default_warehouse
            else:
                line.warehouse_id = default_warehouse
            line.is_same_warehouse = not line.warehouse_id or (line.warehouse_id == default_warehouse)
