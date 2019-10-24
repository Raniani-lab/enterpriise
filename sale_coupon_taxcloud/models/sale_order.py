# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .taxcloud_request import TaxCloudRequest
from odoo import api, models, fields


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    @api.model
    def _get_TaxCloudRequest(self, api_id, api_key):
        return TaxCloudRequest(api_id, api_key)

    def _get_reward_values_discount(self, program):
        res = list(super(SaleOrder, self)._get_reward_values_discount(program))
        [vals.update(coupon_program_id=program.id) for vals in res]
        return res

    def _get_reward_values_product(self, program):
        res = super(SaleOrder, self)._get_reward_values_product(program)
        res.update(coupon_program_id=program.id)
        return res

    def recompute_coupon_lines(self):
        """Before we apply the discounts, we clean up any preset tax
           that might already since it may mess up the discount computation.
        """
        taxcloud_orders = self.filtered('fiscal_position_id.is_taxcloud')
        taxcloud_orders.mapped('order_line').write({'tax_id': [(5,)]})
        return super(SaleOrder, self).recompute_coupon_lines()

class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    coupon_program_id = fields.Many2one('sale.coupon.program',
        string='Discount Program', readonly=True,
        help='The coupon program that created this line.',
    )
    price_taxcloud = fields.Float('Taxcloud Price', default=0,
                                  help='Technical fields to hold prices for TaxCloud.')

    def _get_taxcloud_price(self):
        self.ensure_one()
        return self.price_taxcloud

    def _prepare_invoice_line(self):
        res = super(SaleOrderLine, self)._prepare_invoice_line()
        res.update({'coupon_program_id': self.coupon_program_id.id})
        return res


class SaleCouponApplyCode(models.TransientModel):
    _inherit = 'sale.coupon.apply.code'

    def apply_coupon(self, order, coupon_code):
        if order.fiscal_position_id.is_taxcloud:
            order.mapped('order_line').write({'tax_id': [(5,)]})
        return super(SaleCouponApplyCode, self).apply_coupon(order, coupon_code)
