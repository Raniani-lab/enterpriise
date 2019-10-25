# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ApprovalProductLine(models.Model):
    _inherit = 'approval.product.line'

    def _domain_product_id(self):
        """ Filters on product to get only the ones who are available on
        purchase in the case the approval request type is purchase. """
        # TODO: How to manage this when active model isn't approval.category ?
        if 'default_category_id' in self.env.context:
            category_id = self.env.context.get('default_category_id')
        elif self.env.context.get('active_model') == 'approval.category':
            category_id = self.env.context.get('active_id')
        else:
            return []
        category = self.env['approval.category'].browse(category_id)
        if category.approval_type == 'purchase':
            return [('purchase_ok', '=', True)]

    po_uom_qty = fields.Float(
        "Purchase UoM Quantity", compute='_compute_po_uom_qty',
        help="The quantity converted into the UoM used by the product in Purchase Order.")
    purchase_order_line_id = fields.Many2one('purchase.order.line')
    product_id = fields.Many2one(domain=lambda self: self._domain_product_id())

    @api.depends('approval_request_id.approval_type', 'product_uom_id', 'quantity')
    def _compute_po_uom_qty(self):
        for line in self:
            approval_type = line.approval_request_id.approval_type
            if approval_type == 'purchase' and line.product_id and line.quantity:
                uom = line.product_uom_id or line.product_id.uom_id
                line.po_uom_qty = uom._compute_quantity(
                    line.quantity,
                    line.product_id.uom_po_id
                )
            else:
                line.po_uom_qty = 0.0

    def _get_seller_id(self):
        self.ensure_one()
        res = self.env['product.supplierinfo']
        if self.product_id and self.po_uom_qty:
            res = self.product_id.with_company(self.company_id)._select_seller(
                quantity=self.po_uom_qty,
                uom_id=self.product_id.uom_po_id,
            )
        return res

    def _check_products_vendor(self):
        """ Raise an error if at least one product requires a seller. """
        product_lines_without_seller = self.filtered(lambda line: not line._get_seller_id())
        if product_lines_without_seller:
            product_names = product_lines_without_seller.product_id.mapped('display_name')
            raise UserError(
                _('Please set a vendor on product(s) %s.') % ', '.join(product_names)
            )

    def _get_purchase_orders_domain(self, vendor):
        """ Return a domain to get purchase order(s) where this product line could fit in.

        :return: list of tuple.
        """
        self.ensure_one()
        domain = [
            ('company_id', '=', self.company_id.id),
            ('partner_id', '=', vendor.id),
            ('state', '=', 'draft'),
        ]
        return domain

    def _get_purchase_order_values(self, vendor):
        """ Get some values used to create a purchase order.
        Called in approval.request `action_create_purchase_orders`.

        :param vendor: a res.partner record
        :return: dict of values
        """
        self.ensure_one()
        vals = {
            'origin': self.approval_request_id.name,
            'partner_id': vendor.id,
            'company_id': self.company_id.id,
        }
        return vals

    def _prepare_purchase_order_line(self, company, po):
        """ Convert an `approval.product.line` into a `purchase.order.line`

        :param company: record `res.company`
        :param po: record `purchase.order`

        :return: dict with parameters to create a new `purchase.order.line`.
        """
        self.ensure_one()
        seller = self._get_seller_id()
        partner = seller.name

        taxes = self.product_id.supplier_taxes_id
        fpos = po.fiscal_position_id
        taxes_id = fpos.map_tax(taxes, self.product_id, seller.name) if fpos else taxes
        if taxes_id:
            taxes_id = taxes_id.filtered(lambda x: x.company_id.id == company.id)

        price_unit = 0.0
        if seller:
            price_unit = self.env['account.tax']._fix_tax_included_price_company(
                seller.price, self.product_id.supplier_taxes_id, taxes_id, company
            )
        if price_unit and seller and po.currency_id and seller.currency_id != po.currency_id:
            price_unit = seller.currency_id._convert(
                price_unit, po.currency_id, po.company_id, po.date_order or fields.Date.today())

        # Gets the description to use it as 'name' in the purchase order line.
        # If no description, uses the product's name and description instead.
        name = self.description
        if not name:
            product_lang = self.product_id.with_context(
                lang=partner.lang,
                partner_id=partner.id,
            )
            name = product_lang.display_name
            if product_lang.description_purchase:
                name += '\n' + product_lang.description_purchase

        date_planned = self.env['purchase.order.line']._get_date_planned(seller, po=po)

        return {
            'name': name,
            'product_qty': self.po_uom_qty,
            'product_id': self.product_id.id,
            'product_uom': self.product_id.uom_po_id.id,
            'price_unit': price_unit,
            'date_planned': date_planned,
            'taxes_id': [(6, 0, taxes_id.ids)],
            'order_id': po.id,
        }
