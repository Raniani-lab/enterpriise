# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import HttpCase, tagged


@tagged('-at_install', 'post_install')
class TestBarcodeClientAction(HttpCase):
    def test_filter_picking_by_product_gs1(self):
        """ Checks if a product is searched with a complete GS1 barcode, the
        product data is correctly retrieved and the search operates only on the
        product's part of the GS1 barcode. Also, checks a product can still be
        searched by its raw barcode even if GS1 nomenclature is used.
        """
        Product = self.env['product.product']
        product_category_all = self.env.ref('product.product_category_all')
        # Creates three products.
        product1 = Product.create({
            'name': 'product1',
            'barcode': '01304510',
            'categ_id': product_category_all.id,
            'type': 'product',
        })
        product2 = Product.create({
            'name': 'product2',
            'barcode': '73411048',
            'categ_id': product_category_all.id,
            'type': 'product',
        })
        product3 = Product.create({
            'name': 'product3',
            'barcode': '00000073411048',  # Ambiguous with the product2 barcode.
            'categ_id': product_category_all.id,
            'type': 'product',
        })

        # Searches while using the default barcode nomenclature.
        product = Product.search([('barcode', '=', '01304510')])
        self.assertEqual(len(product), 1, "Product should be found when searching by its barcode")
        self.assertEqual(product.id, product1.id)
        product = Product.search([('barcode', '=', '0100000001304510')])
        self.assertEqual(len(product), 0, "Product shouldn't be found with GS1 barcode if GS1 nomenclature is inactive")

        # Searches while using the GS1 barcode nomenclature.
        self.env.company.nomenclature_id = self.env.ref('barcodes_gs1_nomenclature.default_gs1_nomenclature')
        for operator in ['=', 'ilike']:
            product = Product.search([('barcode', operator, '01304510')])
            self.assertEqual(len(product), 1, "Product should still be found when searching by its raw barcode even if GS1 nomenclature is active")
            self.assertEqual(product.id, product1.id)
            product = Product.search([('barcode', operator, '300005\x1D0100000001304510')])
            self.assertEqual(len(product), 1, "Product should be found when scanning a GS1 barcode containing its data")
            self.assertEqual(product.id, product1.id)
            product = Product.search([('barcode', operator, '0100000001304510\x1Dt00.d4r|<')])
            self.assertEqual(len(product), 0, "No products should be found because of invalid GS1 barcode")
            product = Product.search([('barcode', operator, '0100000073411048')])
            self.assertEqual(len(product), 2, "Should found two products because of the ambiguity")
            self.assertEqual(product.ids, [product2.id, product3.id])

        # Checks search for all products except one from a GS1 barcode is workking as expected.
        for operator in ['!=', 'not ilike']:
            products = Product.search([('barcode', operator, '01304510')])
            self.assertFalse(product1 in products)
            self.assertTrue(product2 in products and product3 in products)
            products = Product.search([('barcode', operator, '300005\x1D0100000001304510')])
            self.assertFalse(product1 in products)
            self.assertTrue(product2 in products and product3 in products)
            products = Product.search([('barcode', operator, '00000073411048')])
            self.assertTrue(product1 in products)
            self.assertFalse(product2 in products, "product2 shouldn't be found due to unpadding of the barcode implied in the search")
            self.assertFalse(product3 in products)
            products = Product.search([('barcode', operator, '0100000073411048300005')])
            self.assertTrue(product1 in products)
            self.assertFalse(product2 in products or product3 in products)
