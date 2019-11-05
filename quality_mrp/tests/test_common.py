# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestQualityMrpCommon(common.TransactionCase):

    def setUp(self):
        super(TestQualityMrpCommon, self).setUp()

    # <record id="quality_point1" model="quality.point">
    #     <field name="product_id" ref="product.product_product_27"/>
    #     <field name="product_tmpl_id" ref="product.product_product_27_product_template"/>
    #     <field name="picking_type_id" ref="stock.picking_type_in"/>
    #     <field name="note">Quality Control For Customized Laptop's Parts By Manufacturing Department.</field>
    # </record>
    #     self.product_id = self.ref('product.product_product_27')
        self.product_uom_id = self.ref('uom.product_uom_unit')
        self.product = self.env['product.product'].create({
            'name': 'Drawer',
            'type': 'product',
            'uom_id': self.product_uom_id,
            'uom_po_id': self.product_uom_id,
            'tracking': 'lot',
        })
        self.product_id = self.product.id
        self.product_tmpl_id = self.product.product_tmpl_id.id
        self.picking_type_id = self.env.ref('stock.warehouse0').manu_type_id.id
        # self.bom_id = self.ref('mrp.mrp_bom_laptop_cust')
        # <record id="mrp_bom_laptop_cust" model="mrp.bom">
        #     <field name="product_tmpl_id" ref="product.product_product_27_product_template"/>
        #     <field name="product_uom_id" ref="uom.product_uom_unit"/>
        #     <field name="sequence">1</field>
        #     <field name="code">PRIM-ASSEM</field>
        # </record>
        # <record id="mrp_bom_laptop_cust_line_1" model="mrp.bom.line">
        #     <field name="product_id" ref="product_product_drawer_drawer"/>
        #     <field name="product_qty">1</field>
        #     <field name="product_uom_id" ref="uom.product_uom_unit"/>
        #     <field name="sequence">1</field>
        #     <field name="bom_id" ref="mrp_bom_laptop_cust"/>
        # </record>
        # <record id="mrp_bom_laptop_cust_line_2" model="mrp.bom.line">
        #     <field name="product_id" ref="product_product_drawer_case"/>
        #     <field name="product_qty">1</field>
        #     <field name="product_uom_id" ref="uom.product_uom_unit"/>
        #     <field name="sequence">2</field>
        #     <field name="bom_id" ref="mrp_bom_laptop_cust"/>
        # </record>

        # <record id="product_product_drawer_drawer" model="product.product">
        #     <field name="name">Drawer Black</field>
        #     <field name="categ_id" ref="product.product_category_5"/>
        #     <field name="tracking">lot</field>
        #     <field name="standard_price">2000.0</field>
        #     <field name="list_price">2250.0</field>
        #     <field name="type">product</field>
        #     <field name="weight">0.01</field>
        #     <field name="uom_id" ref="uom.product_uom_unit"/>
        #     <field name="uom_po_id" ref="uom.product_uom_unit"/>
        #     <field name="description">Drawer on casters for great usability.</field>
        #     <field name="default_code">FURN_2100</field>
        #     <field name="barcode">601647855646</field>
        #     <field name="image_1920" type="base64" file="mrp/static/img/product_product_drawer_black.png"/>
        # </record>
        # <record id="product_product_drawer_case" model="product.product">
        #     <field name="name">Drawer Case Black</field>
        #     <field name="categ_id" ref="product.product_category_5"/>
        #     <field name="tracking">lot</field>
        #     <field name="standard_price">800</field>
        #     <field name="list_price">850</field>
        #     <field name="type">product</field>
        #     <field name="weight">0.01</field>
        #     <field name="uom_id" ref="uom.product_uom_unit"/>
        #     <field name="uom_po_id" ref="uom.product_uom_unit"/>
        #     <field name="default_code">FURN_5623</field>
        #     <field name="barcode">601647855647</field>
        #     <field name="image_1920" type="base64" file="mrp/static/img/product_product_drawer_case_black.png"/>
        # </record>

        product_product_drawer_drawer = self.env['product.product'].create({
            'name': 'Drawer Black',
            'tracking': 'lot'
        })
        product_product_drawer_case = self.env['product.product'].create({
            'name': 'Drawer Case Black',
            'tracking': 'lot'
        })
        self.bom = self.env['mrp.bom'].create({
            'product_tmpl_id': self.product_tmpl_id,
            'product_uom_id': self.product_uom_id,
            'bom_line_ids': [
                (0, 0, {
                    'product_id': product_product_drawer_drawer.id,
                    'product_qty': 1,
                    'product_uom_id': self.product_uom_id,
                    'sequence': 1,
                }), (0, 0, {
                    'product_id': product_product_drawer_case.id,
                    'product_qty': 1,
                    'product_uom_id': self.product_uom_id,
                    'sequence': 1,
                })
            ]
        })
        self.bom_id = self.bom.id

        # <record id="product.product_product_27" model="product.product">
        #     <field name="tracking">lot</field>
        # </record>

        self.lot_product_27_0 = self.env['stock.production.lot'].create({
            'name': '0000000000030',
            'product_id': self.product_id,
            'company_id': self.env.company.id,
        })
        lot_product_product_drawer_drawer_0 = self.env['stock.production.lot'].create({
            'name': '0000000010001',
            'product_id': product_product_drawer_drawer.id,
            'company_id': self.env.company.id,
        })
        lot_product_product_drawer_case_0 = self.env['stock.production.lot'].create({
            'name': '0000000020045',
            'product_id': product_product_drawer_case.id,
            'company_id': self.env.company.id,
        })
        # <record id="lot_product_27_0" model="stock.production.lot">
        #     <field name="name">0000000000030</field>
        #     <field name="product_id" ref="product.product_product_27"/>
        #     <field name="company_id" ref="base.main_company"/>
        # </record>

        # <record id="lot_product_product_drawer_drawer_0" model="stock.production.lot">
        #     <field name="name">0000000010001</field>
        #     <field name="product_id" ref="product_product_drawer_drawer"/>
        #     <field name="company_id" ref="base.main_company"/>
        # </record>

        # <record id="lot_product_product_drawer_case_0" model="stock.production.lot">
        #     <field name="name">0000000020045</field>
        #     <field name="product_id" ref="product_product_drawer_case"/>
        #     <field name="company_id" ref="base.main_company"/>
        # </record>