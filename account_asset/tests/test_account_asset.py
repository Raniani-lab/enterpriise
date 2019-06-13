# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools, fields
from odoo.tests import common
from odoo.modules.module import get_resource_path
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_compare
from odoo.tests.common import Form


from dateutil.relativedelta import relativedelta


class TestAccountAsset(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(self.cr, 'account_asset',
                           get_resource_path(module, *args),
                           {}, 'init', False, 'test', self.registry._assertion_report)

    def update_form_values(self, asset_form):
        for i in range(len(asset_form.depreciation_move_ids)):
            with asset_form.depreciation_move_ids.edit(i) as line_edit:
                line_edit.asset_remaining_value

    def test_00_account_asset(self):
        self.env.context = {**self.env.context, **{'asset_type': 'purchase'}}
        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('account_asset', 'test', 'account_asset_demo_test.xml')

        CEO_car = self.browse_ref("account_asset.account_asset_vehicles_test0")
        # In order to get the fields from the model, I need to trigger the onchange method.
        CEO_car._onchange_model_id()

        # In order to test the process of Account Asset, I perform a action to confirm Account Asset.
        CEO_car.validate()

        # I check Asset is now in Open state.
        self.assertEqual(self.browse_ref("account_asset.account_asset_vehicles_test0").state, 'open',
                         'Asset should be in Open state')

        # I compute depreciation lines for asset of CEOs Car.
        self.assertEqual(CEO_car.method_number, len(CEO_car.depreciation_move_ids),
                         'Depreciation lines not created correctly')

        # Check that auto_post is set on the entries, in the future, and we cannot post them.
        with self.assertRaises(UserError):
            CEO_car.depreciation_move_ids.post()

        # I Check that After creating all the moves of depreciation lines the state "Running".
        CEO_car.depreciation_move_ids.write({'auto_post': False})
        CEO_car.depreciation_move_ids.post()
        self.assertEqual(self.browse_ref("account_asset.account_asset_vehicles_test0").state, 'open',
                         'State of asset should be runing')

        CEO_car.set_to_close(fields.Date.today())
        self.assertEqual(self.browse_ref("account_asset.account_asset_vehicles_test0").state, 'close',
                         'State of asset should be close')

        # WIZARD
        # I create a record to change the duration of asset for calculating depreciation.
        account_asset_office0 = self.browse_ref('account_asset.account_asset_office_test0')
        account_asset_office0._onchange_model_id()
        asset_modify_number_0 = self.env['asset.modify'].create({
            'asset_id': account_asset_office0.id,
            'name': 'Test reason',
            'method_number': 10.0,
            'value_residual': account_asset_office0.value_residual,
        }).with_context(active_id=account_asset_office0.id)
        # I change the duration.
        asset_modify_number_0.modify()

        # I check the proper depreciation lines created.
        self.assertEqual(account_asset_office0.method_number, len(account_asset_office0.depreciation_move_ids))

    def test_01_account_asset(self):
        """ Test if an an asset is created when an invoice is validated with an
        item on an account for generating entries.
        """
        self.env.context = {**self.env.context, **{'asset_type': 'purchase'}}
        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('account_asset', 'test', 'account_deferred_revenue_demo_test.xml')

        # The account needs a default model for the invoice to validate the revenue
        self.browse_ref("account_asset.xfa").create_asset = 'validate'
        self.browse_ref("account_asset.xfa").asset_model = self.ref("account_asset.account_asset_model_sale_test0")

        invoice = self.env['account.move'].with_context(asset_type='purchase').create({
            'type': 'in_invoice',
            'partner_id': self.ref("base.res_partner_12"),
            'invoice_line_ids': [(0, 0, {
                'name': 'Insurance claim',
                'account_id': self.ref("account_asset.xfa"),
                'price_unit': 450,
                'quantity': 1,
            })],
        })
        invoice.post()

        recognition = invoice.asset_ids
        self.assertEqual(len(recognition), 1, 'One and only one recognition sould have been created from invoice.')

        # I confirm revenue recognition.
        recognition.validate()
        self.assertTrue(recognition.state == 'open',
                        'Recognition should be in Open state')
        first_invoice_line = invoice.invoice_line_ids[0]
        self.assertEqual(recognition.value, first_invoice_line.price_subtotal,
                         'Recognition value is not same as invoice line.')

        recognition.depreciation_move_ids.write({'auto_post': False})
        recognition.depreciation_move_ids.post()

        # I check data in move line and installment line.
        first_installment_line = recognition.depreciation_move_ids.sorted(lambda r: r.id)[0]
        self.assertAlmostEqual(first_installment_line.asset_remaining_value, recognition.value - first_installment_line.amount_total,
                               msg='Remaining value is incorrect.')
        self.assertAlmostEqual(first_installment_line.asset_depreciated_value, first_installment_line.amount_total,
                               msg='Depreciated value is incorrect.')

        # I check next installment date.
        last_installment_date = first_installment_line.date
        installment_date = last_installment_date + relativedelta(months=+int(recognition.method_period))
        self.assertEqual(recognition.depreciation_move_ids.sorted(lambda r: r.id)[1].date, installment_date,
                         'Installment date is incorrect.')

    def test_asset_form(self):
        """Test the form view of assets"""
        self._load('account', 'test', 'account_minimal_test.xml')
        asset_form = Form(self.env['account.asset'].with_context(asset_type='purchase'))
        asset_form.name = "Test Asset"
        asset_form.value = 10000
        asset_form.account_depreciation_id = self.env.ref('account_asset.xfa')
        asset_form.account_depreciation_expense_id = self.env.ref('account_asset.a_expense')
        asset_form.journal_id = self.env.ref('account_asset.miscellaneous_journal')
        asset = asset_form.save()
        asset.validate()

        # Test that the depreciations are created upon validation of the asset according to the default values
        self.assertEqual(len(asset.depreciation_move_ids), 5)
        for move in asset.depreciation_move_ids:
            self.assertEqual(move.amount_total, 2000)

        # Test that we cannot validate an asset with non zero remaining value of the last depreciation line
        asset_form = Form(asset)
        with self.assertRaises(ValidationError):
            with self.cr.savepoint():
                with asset_form.depreciation_move_ids.edit(4) as line_edit:
                    line_edit.amount_total = 1000.0
                asset_form.save()

        # ... but we can with a zero remaining value on the last line.
        asset_form = Form(asset)
        with asset_form.depreciation_move_ids.edit(4) as line_edit:
            line_edit.amount_total = 1000.0
        with asset_form.depreciation_move_ids.edit(3) as line_edit:
            line_edit.amount_total = 3000.0
        self.update_form_values(asset_form)
        asset_form.save()

    def test_asset_from_move_line_form(self):
        """Test that the asset is correcly created from a move line"""

        self._load('account', 'test', 'account_minimal_test.xml')

        move_ids = self.env['account.move'].create([{
            'ref': 'line1',
            'line_ids': [
                (0, 0, {
                    'account_id': self.env.ref('account_asset.a_expense').id,
                    'debit': 300,
                    'name': 'Furniture',
                }),
                (0, 0, {
                    'account_id': self.env.ref('account_asset.xfa').id,
                    'credit': 300,
                }),
            ]
        }, {
            'ref': 'line2',
            'line_ids': [
                (0, 0, {
                    'account_id': self.env.ref('account_asset.a_expense').id,
                    'debit': 600,
                    'name': 'Furniture too',
                }),
                (0, 0, {
                    'account_id': self.env.ref('account_asset.xfa').id,
                    'credit': 600,
                }),
            ]
        },
        ])
        move_ids.post()
        move_line_ids = move_ids.mapped('line_ids').filtered(lambda x: x.debit)

        asset = self.env['account.asset'].new({'original_move_line_ids': [(6, 0, move_line_ids.ids)]})
        asset_form = Form(self.env['account.asset'].with_context(default_original_move_line_ids=move_line_ids.ids, asset_type='purchase'))
        asset_form._values['original_move_line_ids'] = [(6, 0, move_line_ids.ids)]
        asset_form._perform_onchange(['original_move_line_ids'])
        asset_form.account_depreciation_expense_id = self.env.ref('account_asset.cas')

        asset = asset_form.save()
        self.assertEqual(asset.value, 900.0)
        self.assertIn(asset.name, ['Furniture', 'Furniture too'])
        self.assertEqual(asset.journal_id.type, 'general')
        self.assertEqual(asset.asset_type, 'purchase')
        self.assertEqual(asset.account_asset_id, self.env.ref('account_asset.a_expense'))
        self.assertEqual(asset.account_depreciation_id, self.env.ref('account_asset.a_expense'))
        self.assertEqual(asset.account_depreciation_expense_id, self.env.ref('account_asset.cas'))
