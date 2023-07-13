# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.models import Model
from odoo.tools import float_is_zero


class PosOrder(Model):
    _inherit = 'pos.order'

    def _process_saved_order(self, draft):
        order_id = super()._process_saved_order(draft)
        if self.use_self_order_online_payment and self.state in ('paid', 'done', 'invoiced') and self.payment_ids.filtered('online_account_payment_id'):
            pd_order_lines_summary = self.env['pos_preparation_display.orderline'].sudo()._read_group(
                domain=[('preparation_display_order_id.pos_order_id', '=', self.id)],
                groupby=['product_id', 'internal_note'],
                aggregates=['product_quantity:sum']
            )

            order_lines_summary = self.env['pos.order.line'].sudo()._read_group(
                domain=[('order_id', '=', self.id)],
                groupby=['product_id', 'customer_note'],
                aggregates=['qty:sum']
            )

            pd_orderlines = []
            for product, internal_note, qty in order_lines_summary:
                cur_qty = 0
                for i, (pd_product, pd_internal_note, pd_qty) in enumerate(pd_order_lines_summary):
                    if product == pd_product and internal_note == pd_internal_note:
                        cur_qty = pd_qty
                        pd_order_lines_summary.pop(i)
                        break

                diff_qty = qty - cur_qty
                if not float_is_zero(diff_qty, precision_rounding=self.currency_id.rounding):
                    pd_orderlines.append({
                        'todo': True,
                        'internal_note': internal_note,
                        'product_id': product.id,
                        'product_quantity': diff_qty,
                        'product_category_ids': product.pos_categ_ids.ids,
                    })

            for product, internal_note, qty in pd_order_lines_summary:
                pd_orderlines.append({
                    'todo': True,
                    'internal_note': internal_note,
                    'product_id': product.id,
                    'product_quantity': -qty,
                    'product_category_ids': product.pos_categ_ids.ids,
                })

            pd_order = {
                'preparation_display_order_line_ids': pd_orderlines,
                'displayed': True,
                'pos_order_id': self.id,
                'pos_table_id': self.table_id.id,
            }
            self.env['pos_preparation_display.order'].sudo().process_order(pd_order)
        return order_id
