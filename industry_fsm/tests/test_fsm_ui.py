# Part of Odoo. See LICENSE file for full copyright and licensing details.
# -*- coding: utf-8 -*-

import odoo.tests


@odoo.tests.tagged('post_install', '-at_install')
class TestUi(odoo.tests.HttpCase):
    def test_ui(self):

        self.env['product.product'].create({
            'name': 'Bolt - Test',
            'standard_price': 0.5,
            'list_price': 0.5,
            'type': 'consu',
        })
        self.env['res.partner'].create({'name': 'Leroy Philippe', 'email': 'leroy.philou@example.com'})
        # <record id="product_product_computer_desk_bolt" model="product.product">
        #     <field name="name">Bolt</field>
        #     <field name="categ_id" ref="product.product_category_consumable"/>
        #     <field name="standard_price">0.5</field>
        #     <field name="list_price">0.5</field>
        #     <field name="type">consu</field>
        #     <field name="weight">0.01</field>
        #     <field name="uom_id" ref="uom.product_uom_unit"/>
        #     <field name="uom_po_id" ref="uom.product_uom_unit"/>
        #     <field name="description">Stainless steel screw full (dia - 5mm, Length - 10mm)</field>
        #     <field name="default_code">CONS_89957</field>
        #     <field name="image_1920" type="base64" file="mrp/static/img/product_product_computer_desk_bolt.png"/>
        # </record>

        self.start_tour("/web", 'industry_fsm_tour', login="admin")
