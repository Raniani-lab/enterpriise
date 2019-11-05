# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestQualityCommon(common.TransactionCase):

    def setUp(self):
        super(TestQualityCommon, self).setUp()

        self.product = self.env['product.product'].create({
        	'name': 'Office Chair'
        })
        # <record id="product_delivery_01" model="product.product">
        #     <field name="name">Office Chair</field>
        #     <field name="categ_id" ref="product_category_5"/>
        #     <field name="standard_price">55.0</field>
        #     <field name="list_price">70.0</field>
        #     <field name="type">consu</field>
        #     <field name="weight">0.01</field>
        #     <field name="uom_id" ref="uom.product_uom_unit"/>
        #     <field name="uom_po_id" ref="uom.product_uom_unit"/>
        #     <field name="default_code">FURN_7777</field>
        #     <field name="image_1920" type="base64" file="product/static/img/product_chair.png"/>
        # </record>
        # self.product = self.env.ref('product.product_delivery_01')
        # self.product_tmpl_id = self.ref('product.product_delivery_01_product_template')
        self.product_tmpl_id = self.product.product_tmpl_id.id
        # self.partner_id = self.ref('base.res_partner_4')
        self.partner_id = self.env['res.partner'].create({'name': 'A Test Partner'}).id
        self.picking_type_id = self.ref('stock.picking_type_in')
        self.location_id = self.ref('stock.stock_location_suppliers')
        self.location_dest_id = self.ref('stock.stock_location_stock')
