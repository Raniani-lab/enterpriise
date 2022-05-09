# Part of Odoo. See LICENSE file for full copyright and licensing details

from datetime import datetime
from odoo.addons.industry_fsm_sale.tests.common import TestFsmFlowCommon
from odoo.exceptions import UserError


# This test class has to be tested at install since the flow is modified in industry_fsm_stock
# where the SO gets confirmed as soon as a product is added in an FSM task which causes the
# tests of this class to fail
class TestFsmFlowSale(TestFsmFlowCommon):

    # If the test has to be run at install, it cannot inherit indirectly from accounttestinvoicingcommon.
    # So we have to setup the test data again here.
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.account_revenue = cls.env['account.account'].create([{'code': '1014040', 'name': 'A', 'user_type_id': cls.env.ref('account.data_account_type_revenue').id}])
        cls.account_expense = cls.env['account.account'].create([{'code': '101600', 'name': 'C', 'user_type_id': cls.env.ref('account.data_account_type_expenses').id}])
        cls.tax_sale_a = cls.env['account.tax'].create({
            'name': "tax_sale_a",
            'amount_type': 'percent',
            'type_tax_use': 'sale',
            'amount': 10.0,
        })
        cls.tax_purchase_a = cls.env['account.tax'].create({
            'name': "tax_purchase_a",
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'amount': 10.0,
        })
        cls.product_a = cls.env['product.product'].create({
            'name': 'product_a',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'lst_price': 1000.0,
            'standard_price': 800.0,
            'property_account_income_id': cls.account_revenue.id,
            'property_account_expense_id': cls.account_expense.id,
            'taxes_id': [(6, 0, cls.tax_sale_a.ids)],
            'supplier_taxes_id': [(6, 0, cls.tax_purchase_a.ids)],
        })

    def test_fsm_flow(self):
        """
        Test Cases:
        ==========
        1) Add task and Assert no products added
        2) Add and remove different quantities of products:
            - Service (order/delivered)
            - Consumable (order/delivered)
            And assert after each operation on product count
        3) Set product quantity after confirming SO
        """
        self.assertFalse(self.task.material_line_product_count, "No product should be linked to a new task")
        with self.assertRaises(UserError, msg='Should not be able to get to material without customer set'):
            self.task.action_fsm_view_material()
        self.task.write({'partner_id': self.partner_1.id})
        self.assertFalse(self.task.task_to_invoice, "Nothing should be invoiceable on task")
        self.task.with_user(self.project_user).action_fsm_view_material()

        expected_product_count = 1
        self.service_product_delivered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        expected_product_count -= 1
        self.service_product_delivered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_remove_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        expected_product_count += 1
        self.service_product_delivered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        expected_product_count += 1
        self.consu_product_delivered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        expected_product_count += 1
        self.consu_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        expected_product_count -= 1
        self.consu_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_remove_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        expected_product_count += 1
        self.service_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).fsm_add_quantity()
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        quantity_to_add = 5
        expected_product_count += quantity_to_add
        self.consu_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).set_fsm_quantity(quantity_to_add)
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        # timesheet
        values = {
            'task_id': self.task.id,
            'project_id': self.task.project_id.id,
            'date': datetime.now(),
            'name': 'test timesheet',
            'user_id': self.env.uid,
            'unit_amount': 0.25,
        }
        self.env['account.analytic.line'].create(values)
        self.assertEqual(self.task.material_line_product_count, expected_product_count, "Timesheet should not appear in material")

        # validation and SO
        self.assertFalse(self.task.fsm_done, "Task should not be validated")
        self.assertEqual(self.task.sale_order_id.state, 'draft', "Sale order should not be confirmed")
        self.assertEqual(len(self.task.sale_order_id.order_line), 4)

        order_line = self.task.sale_order_id.order_line.filtered(lambda l: l.name == self.service_product_ordered.name)
        self.assertEqual(order_line.product_uom_qty, 1)
        self.task.with_user(self.project_user).action_fsm_validate()
        self.assertTrue(self.task.fsm_done, "Task should be validated")
        self.assertEqual(self.task.sale_order_id.state, 'sale', "Sale order should be confirmed")

        # Add product quantity after confirming the SO
        self.service_product_ordered.with_user(self.project_user).with_context({'fsm_task_id': self.task.id}).set_fsm_quantity(9)
        self.assertEqual(order_line.product_uom_qty, 9)
        expected_product_count += 8
        self.assertEqual(self.task.material_line_product_count, expected_product_count, f"{expected_product_count} product should be linked to the task")

        # invoice
        self.assertTrue(self.task.task_to_invoice, "Task should be invoiceable")
        invoice_ctx = self.task.action_create_invoice()['context']
        invoice_wizard = self.env['sale.advance.payment.inv'].with_context(invoice_ctx).create({})
        invoice_wizard.create_invoices()
        self.assertFalse(self.task.task_to_invoice, "Task should not be invoiceable")

        # quotation
        self.assertEqual(self.task.quotation_count, 0, "0 quotation should be linked to the task since we don't create a quotation via the Create Quotation button.")
        quotation_context = self.task.action_fsm_create_quotation()['context']
        quotation = self.env['sale.order'].with_context(quotation_context).create({})
        self.assertEqual(quotation.task_id, self.task)
        self.task._compute_quotation_count()  # it means we return to the form view of the task, So the compute will be trigger again.
        self.assertEqual(self.task.quotation_count, 1, '1 quotation should be linked to the task since we create a quotation via the Create Quotation button.')
        self.assertEqual(self.task.action_fsm_view_quotations()['res_id'], quotation.id, "Created quotation id should be in the action")

    def test_change_product_selection(self):
        self.task.write({'partner_id': self.partner_1.id})
        product = self.service_product_ordered.with_context({'fsm_task_id': self.task.id})
        product.set_fsm_quantity(5)

        so = self.task.sale_order_id
        sol01 = so.order_line[-1]
        sol01.sequence = 10
        self.assertEqual(sol01.product_uom_qty, 5)

        # Manually add a line for the same product
        sol02 = self.env['sale.order.line'].create({
            'order_id': so.id,
            'product_id': product.id,
            'product_uom_qty': 3,
            'sequence': 20,
            'task_id': self.task.id
        })
        product.sudo()._compute_fsm_quantity()
        self.assertEqual(sol02.product_uom_qty, 3)
        self.assertEqual(product.fsm_quantity, 8)

        product.set_fsm_quantity(2)
        product.sudo()._compute_fsm_quantity()
        self.assertEqual(product.fsm_quantity, 2)
        self.assertEqual(sol01.product_uom_qty, 0)
        self.assertEqual(sol02.product_uom_qty, 2)

    def test_fsm_sale_pricelist(self):
        self.assertFalse(self.task.material_line_product_count, "No product should be linked to a new task")
        self.assertFalse(self.task.material_line_total_price)
        product = self.product_a.with_context({"fsm_task_id": self.task.id})
        self.task.write({'partner_id': self.partner_1.id})
        pricelist = self.env['product.pricelist'].create({
            'name': 'Sale pricelist',
            'discount_policy': 'with_discount',
            'item_ids': [(0, 0, {
                'compute_price': 'formula',
                'base': 'list_price',  # based on public price
                'price_discount': 10,
                'min_quantity': 2,
                'product_id': product.id,
                'applied_on': '0_product_variant',
            })]
        })
        self.assertFalse(self.task.sale_order_id)
        self.task._fsm_ensure_sale_order()
        self.assertTrue(self.task.sale_order_id)
        self.assertEqual(self.task.sale_order_id.state, 'draft')
        self.task.sale_order_id.action_confirm()
        self.assertEqual(self.task.sale_order_id.state, 'sale')
        self.task.sale_order_id.pricelist_id = pricelist

        self.assertEqual(product.fsm_quantity, 0)
        expected_product_count = 1
        product.fsm_add_quantity()
        self.assertEqual(product.fsm_quantity, expected_product_count)
        self.assertEqual(self.task.material_line_product_count, expected_product_count)

        order_line = self.task.sale_order_id.order_line.filtered(lambda l: l.product_id == product)
        self.assertEqual(order_line.price_subtotal, order_line.untaxed_amount_to_invoice)
        self.assertEqual(order_line.product_uom_qty, expected_product_count)
        self.assertEqual(order_line.price_unit, product.list_price)

        product.fsm_add_quantity()
        expected_product_count += 1
        self.assertEqual(product.fsm_quantity, expected_product_count)
        self.assertEqual(order_line.product_uom_qty, expected_product_count)
        self.assertEqual(order_line.price_subtotal, order_line.untaxed_amount_to_invoice)
        self.assertEqual(self.task.material_line_product_count, expected_product_count)
