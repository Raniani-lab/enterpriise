# -*- coding: utf-8 -*-

import math
import time

from dateutil.relativedelta import relativedelta
from odoo import fields
from odoo.exceptions import UserError, MissingError
from odoo.tests.common import Form
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from unittest.mock import patch


def today():
    # 31'st of december is a particular date because entries are configured
    # to be autoposted on that day. The test values dont take it into account
    # so we just mock the date and run the 31'st as if it was the 30'th
    today = fields.Date.today()
    if today.month == 12 and today.day == 31:
        today += relativedelta(day=30)
    return today


class TestAccountAsset(TestAccountReportsCommon):

    @classmethod
    @patch('odoo.fields.Date.today', return_value=today())
    def setUpClass(cls, today_mock):
        super(TestAccountAsset, cls).setUpClass()
        today = fields.Date.today()
        cls.truck = cls.env['account.asset'].create({
            'account_asset_id': cls.company_data['default_account_expense'].id,
            'account_depreciation_id': cls.company_data['default_account_expense'].id,
            'account_depreciation_expense_id': cls.company_data['default_account_assets'].id,
            'journal_id': cls.company_data['default_journal_misc'].id,
            'asset_type': 'purchase',
            'name': 'truck',
            'acquisition_date': today + relativedelta(years=-6, month=1, day=1),
            'original_value': 10000,
            'salvage_value': 2500,
            'method_number': 10,
            'method_period': '12',
            'method': 'linear',
        })
        cls.truck.validate()
        cls.env['account.move']._autopost_draft_entries()
        cls.assert_counterpart_account_id = cls.company_data['default_account_revenue'].id,

    def update_form_values(self, asset_form):
        for i in range(len(asset_form.depreciation_move_ids)):
            with asset_form.depreciation_move_ids.edit(i) as line_edit:
                line_edit.asset_remaining_value

    def test_00_account_asset(self):
        """Test the lifecycle of an asset"""
        self.env.context = {**self.env.context, **{'asset_type': 'purchase'}}

        account_asset_model_fixedassets_test0 = self.env['account.asset'].create({
            'account_depreciation_id': self.company_data['default_account_assets'].id,
            'account_depreciation_expense_id': self.company_data['default_account_expense'].id,
            'account_asset_id': self.company_data['default_account_assets'].id,
            'journal_id': self.company_data['default_journal_purchase'].id,
            'name': 'Hardware - 3 Years',
            'method_number': 3,
            'method_period': '12',
            'state': 'model',
        })

        account_asset_vehicles_test0 = self.env['account.asset'].create({
            'salvage_value': 2000.0,
            'state': 'open',
            'method_period': '12',
            'method_number': 5,
            'name': "CEO's Car",
            'original_value': 12000.0,
            'model_id': account_asset_model_fixedassets_test0.id,
        })

        CEO_car = account_asset_vehicles_test0
        # In order to get the fields from the model, I need to trigger the onchange method.
        CEO_car._onchange_model_id()

        # In order to test the process of Account Asset, I perform a action to confirm Account Asset.
        CEO_car.validate()

        # I check Asset is now in Open state.
        self.assertEqual(account_asset_vehicles_test0.state, 'open',
                         'Asset should be in Open state')

        # I compute depreciation lines for asset of CEOs Car.
        self.assertEqual(CEO_car.method_number, len(CEO_car.depreciation_move_ids),
                         'Depreciation lines not created correctly')

        # Check that auto_post is set on the entries, in the future, and we cannot post them.
        self.assertTrue(all(CEO_car.depreciation_move_ids.mapped('auto_post')))
        with self.assertRaises(UserError):
            CEO_car.depreciation_move_ids.action_post()

        # I Check that After creating all the moves of depreciation lines the state "Running".
        CEO_car.depreciation_move_ids.write({'auto_post': False})
        CEO_car.depreciation_move_ids.action_post()
        self.assertEqual(account_asset_vehicles_test0.state, 'open',
                         'State of asset should be runing')

        closing_invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'invoice_line_ids': [(0, 0, {
                'debit': 100,
            })]
        })

        with self.assertRaises(UserError, msg="You shouldn't be able to close if there are posted entries in the future"):
            CEO_car.set_to_close(closing_invoice.invoice_line_ids)

    def test_01_account_asset(self):
        """ Test if an an asset is created when an invoice is validated with an
        item on an account for generating entries.
        """
        self.env.context = {**self.env.context, **{'asset_type': 'purchase'}}
        account_asset_model_sale_test0 = self.env['account.asset'].create({
            'account_depreciation_id': self.company_data['default_account_assets'].id,
            'account_depreciation_expense_id': self.company_data['default_account_revenue'].id,
            'journal_id': self.company_data['default_journal_sale'].id,
            'name': 'Maintenance Contract - 3 Years',
            'method_number': 3,
            'method_period': '12',
            'prorata': True,
            'prorata_date': time.strftime('%Y-01-01'),
            'asset_type': 'sale',
            'state': 'model',
        })

        # The account needs a default model for the invoice to validate the revenue
        self.company_data['default_account_assets'].create_asset = 'validate'
        self.company_data['default_account_assets'].asset_model = account_asset_model_sale_test0

        invoice = self.env['account.move'].with_context(asset_type='purchase').create({
            'move_type': 'in_invoice',
            'partner_id': self.env['res.partner'].create({'name': 'Res Partner 12'}).id,
            'invoice_line_ids': [(0, 0, {
                'name': 'Insurance claim',
                'account_id': self.company_data['default_account_assets'].id,
                'price_unit': 450,
                'quantity': 1,
            })],
        })
        invoice.action_post()

        recognition = invoice.asset_ids
        self.assertEqual(len(recognition), 1, 'One and only one recognition should have been created from invoice.')

        # I confirm revenue recognition.
        recognition.validate()
        self.assertTrue(recognition.state == 'open',
                        'Recognition should be in Open state')
        first_invoice_line = invoice.invoice_line_ids[0]
        self.assertEqual(recognition.original_value, first_invoice_line.price_subtotal,
                         'Recognition value is not same as invoice line.')

        recognition.depreciation_move_ids.write({'auto_post': False})
        recognition.depreciation_move_ids.action_post()

        # I check data in move line and installment line.
        first_installment_line = recognition.depreciation_move_ids.sorted(lambda r: r.id)[0]
        self.assertAlmostEqual(first_installment_line.asset_remaining_value, recognition.original_value - first_installment_line.amount_total,
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
        asset_form = Form(self.env['account.asset'].with_context(asset_type='purchase'))
        asset_form.name = "Test Asset"
        asset_form.original_value = 10000
        asset_form.account_depreciation_id = self.company_data['default_account_assets']
        asset_form.account_depreciation_expense_id = self.company_data['default_account_expense']
        asset_form.journal_id = self.company_data['default_journal_misc']
        asset = asset_form.save()
        asset.validate()

        # Test that the depreciations are created upon validation of the asset according to the default values
        self.assertEqual(len(asset.depreciation_move_ids), 5)
        for move in asset.depreciation_move_ids:
            self.assertEqual(move.amount_total, 2000)

        # Test that we cannot validate an asset with non zero remaining value of the last depreciation line
        asset_form = Form(asset)
        with self.assertRaises(UserError):
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

        move_ids = self.env['account.move'].create([{
            'ref': 'line1',
            'line_ids': [
                (0, 0, {
                    'account_id': self.company_data['default_account_expense'].id,
                    'debit': 300,
                    'name': 'Furniture',
                }),
                (0, 0, {
                    'account_id': self.company_data['default_account_assets'].id,
                    'credit': 300,
                }),
            ]
        }, {
            'ref': 'line2',
            'line_ids': [
                (0, 0, {
                    'account_id': self.company_data['default_account_expense'].id,
                    'debit': 600,
                    'name': 'Furniture too',
                }),
                (0, 0, {
                    'account_id': self.company_data['default_account_assets'].id,
                    'credit': 600,
                }),
            ]
        },
        ])
        move_ids.action_post()
        move_line_ids = move_ids.mapped('line_ids').filtered(lambda x: x.debit)

        asset = self.env['account.asset'].new({'original_move_line_ids': [(6, 0, move_line_ids.ids)]})
        asset_form = Form(self.env['account.asset'].with_context(default_original_move_line_ids=move_line_ids.ids, asset_type='purchase'))
        asset_form._values['original_move_line_ids'] = [(6, 0, move_line_ids.ids)]
        asset_form._perform_onchange(['original_move_line_ids'])
        asset_form.account_depreciation_expense_id = self.company_data['default_account_expense']

        asset = asset_form.save()
        self.assertEqual(asset.value_residual, 900.0)
        self.assertIn(asset.name, ['Furniture', 'Furniture too'])
        self.assertEqual(asset.journal_id.type, 'general')
        self.assertEqual(asset.asset_type, 'purchase')
        self.assertEqual(asset.account_asset_id, self.company_data['default_account_expense'])
        self.assertEqual(asset.account_depreciation_id, self.company_data['default_account_expense'])
        self.assertEqual(asset.account_depreciation_expense_id, self.company_data['default_account_expense'])

    def test_asset_modify_depreciation(self):
        """Test the modification of depreciation parameters"""
        self.env['asset.modify'].create({
            'asset_id': self.truck.id,
            'name': 'Test reason',
            'method_number': 10.0,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()

        # I check the proper depreciation lines created.
        self.assertEqual(10, len(self.truck.depreciation_move_ids.filtered(lambda x: x.state == 'draft')))

    def test_asset_modify_value_00(self):
        """Test the values of the asset and value increase 'assets' after a
        modification of residual and/or salvage values.
        Increase the residual value, increase the salvage value"""
        self.assertEqual(self.truck.value_residual, 3000)
        self.assertEqual(self.truck.salvage_value, 2500)

        self.env['asset.modify'].create({
            'name': 'New beautiful sticker :D',
            'asset_id': self.truck.id,
            'value_residual': 4000,
            'salvage_value': 3000,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual, 3000)
        self.assertEqual(self.truck.salvage_value, 2500)
        self.assertEqual(self.truck.children_ids.value_residual, 1000)
        self.assertEqual(self.truck.children_ids.salvage_value, 500)

    @patch('odoo.fields.Date.today', return_value=today())
    def test_asset_modify_value_01(self, today_mock):
        "Decrease the residual value, decrease the salvage value"
        self.env['asset.modify'].create({
            'name': "Accident :'(",
            'date': fields.Date.today(),
            'asset_id': self.truck.id,
            'value_residual': 1000,
            'salvage_value': 2000,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual, 1000)
        self.assertEqual(self.truck.salvage_value, 2000)
        self.assertEqual(self.truck.children_ids.value_residual, 0)
        self.assertEqual(self.truck.children_ids.salvage_value, 0)
        self.assertEqual(max(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'posted'), key=lambda m: m.date).amount_total, 2500)

    def test_asset_modify_value_02(self):
        "Decrease the residual value, increase the salvage value; same book value"
        self.env['asset.modify'].create({
            'name': "Don't wanna depreciate all of it",
            'asset_id': self.truck.id,
            'value_residual': 1000,
            'salvage_value': 4500,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual, 1000)
        self.assertEqual(self.truck.salvage_value, 4500)
        self.assertEqual(self.truck.children_ids.value_residual, 0)
        self.assertEqual(self.truck.children_ids.salvage_value, 0)

    def test_asset_modify_value_03(self):
        "Decrease the residual value, increase the salvage value; increase of book value"
        self.env['asset.modify'].create({
            'name': "Some aliens did something to my truck",
            'asset_id': self.truck.id,
            'value_residual': 1000,
            'salvage_value': 6000,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual, 1000)
        self.assertEqual(self.truck.salvage_value, 4500)
        self.assertEqual(self.truck.children_ids.value_residual, 0)
        self.assertEqual(self.truck.children_ids.salvage_value, 1500)

    def test_asset_modify_value_04(self):
        "Increase the residual value, decrease the salvage value; increase of book value"
        self.env['asset.modify'].create({
            'name': 'GODZILA IS REAL!',
            'asset_id': self.truck.id,
            'value_residual': 4000,
            'salvage_value': 2000,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual, 3500)
        self.assertEqual(self.truck.salvage_value, 2000)
        self.assertEqual(self.truck.children_ids.value_residual, 500)
        self.assertEqual(self.truck.children_ids.salvage_value, 0)

    @patch('odoo.fields.Date.today', return_value=today())
    def test_asset_modify_report(self, today_mock):
        """Test the asset value modification flows"""
        #           PY      +   -  Final    PY     +    - Final Bookvalue
        #   -6       0  10000   0  10000     0   750    0   750      9250
        #   -5   10000      0   0  10000   750   750    0  1500      8500
        #   -4   10000      0   0  10000  1500   750    0  2250      7750
        #   -3   10000      0   0  10000  2250   750    0  3000      7000
        #   -2   10000      0   0  10000  3000   750    0  3750      6250
        #   -1   10000      0   0  10000  3750   750    0  4500      5500
        #    0   10000      0   0  10000  4500   750    0  5250      4750  <-- today
        #    1   10000      0   0  10000  5250   750    0  6000      4000
        #    2   10000      0   0  10000  6000   750    0  6750      3250
        #    3   10000      0   0  10000  6750   750    0  7500      2500

        today = fields.Date.today()

        report = self.env['account.assets.report']
        # TEST REPORT
        # look at all period, with unposted entries
        options = self._init_options(report, today + relativedelta(years=-6, month=1, day=1), today + relativedelta(years=+4, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': True}})
        self.assertListEqual([    0.0, 10000.0,     0.0, 10000.0,     0.0,  7500.0,     0.0,  7500.0,  2500.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])

        # look at all period, without unposted entries
        options = self._init_options(report, today + relativedelta(years=-6, month=1, day=1), today + relativedelta(years=+4, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': False}})
        self.assertListEqual([    0.0, 10000.0,     0.0, 10000.0,     0.0,  4500.0,     0.0,  4500.0,  5500.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])

        # look only at this period
        options = self._init_options(report, today + relativedelta(years=0, month=1, day=1), today + relativedelta(years=0, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': True}})
        self.assertListEqual([10000.0,     0.0,     0.0, 10000.0,  4500.0,   750.0,     0.0,  5250.0,  4750.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])

        # test value increase
        #           PY     +   -  Final    PY     +    - Final Bookvalue
        #   -6       0 10000   0  10000         750    0   750      9250
        #   -5   10000     0   0  10000   750   750    0  1500      8500
        #   -4   10000     0   0  10000  1500   750    0  2250      7750
        #   -3   10000     0   0  10000  2250   750    0  3000      7000
        #   -2   10000     0   0  10000  3000   750    0  3750      6250
        #   -1   10000     0   0  10000  3750   750    0  4500      5500
        #    0   10000  1500   0  11500  4500  1000    0  5500      6000  <--  today
        #    1   11500     0   0  11500  5500  1000    0  6500      5000
        #    2   11500     0   0  11500  6500  1000    0  7500      4000
        #    3   11500     0   0  11500  7500  1000    0  8500      3000
        self.assertEqual(self.truck.value_residual, 3000)
        self.assertEqual(self.truck.salvage_value, 2500)
        self.env['asset.modify'].create({
            'name': 'New beautiful sticker :D',
            'asset_id': self.truck.id,
            'value_residual': 4000,
            'salvage_value': 3000,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual + sum(self.truck.children_ids.mapped('value_residual')), 4000)
        self.assertEqual(self.truck.salvage_value + sum(self.truck.children_ids.mapped('salvage_value')), 3000)

        # look at all period, with unposted entries
        options = self._init_options(report, today + relativedelta(years=-6, month=1, day=1), today + relativedelta(years=+4, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': True}})
        self.assertListEqual([    0.0, 11500.0,     0.0, 11500.0,     0.0,  8500.0,     0.0,  8500.0,  3000.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])
        self.assertEqual('10.00 %', lines[0]['columns'][3]['name'], 'Depreciation Rate = 10%')

        # look only at this period
        options = self._init_options(report, today + relativedelta(years=0, month=1, day=1), today + relativedelta(years=0, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': True}})
        self.assertListEqual([10000.0,  1500.0,     0.0, 11500.0,  4500.0,  1000.0,     0.0,  5500.0,  6000.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])

        # test value decrease
        self.env['asset.modify'].create({
            'name': "Huge scratch on beautiful sticker :'( It is ruined",
            'date': fields.Date.today(),
            'asset_id': self.truck.children_ids.id,
            'value_residual': 0,
            'salvage_value': 500,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.env['asset.modify'].create({
            'name': "Huge scratch on beautiful sticker :'( It went through...",
            'date': fields.Date.today(),
            'asset_id': self.truck.id,
            'value_residual': 1000,
            'salvage_value': 2500,
            "account_asset_counterpart_id": self.assert_counterpart_account_id,
        }).modify()
        self.assertEqual(self.truck.value_residual + sum(self.truck.children_ids.mapped('value_residual')), 1000)
        self.assertEqual(self.truck.salvage_value + sum(self.truck.children_ids.mapped('salvage_value')), 3000)

        # look at all period, with unposted entries
        options = self._init_options(report, today + relativedelta(years=-6, month=1, day=1), today + relativedelta(years=+4, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': True}})
        self.assertListEqual([    0.0, 11500.0,     0.0, 11500.0,     0.0,  8500.0,     0.0,  8500.0,  3000.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])

        # look only at this period
        options = self._init_options(report, today + relativedelta(years=0, month=1, day=1), today + relativedelta(years=0, month=12, day=31))
        lines = report._get_lines({**options, **{'unfold_all': False, 'all_entries': True}})
        self.assertListEqual([10000.0,  1500.0,     0.0, 11500.0,  4500.0,  3250.0,     0.0,  7750.0,  3750.0],
                             [x['no_format_name'] for x in lines[0]['columns'][4:]])

    def test_asset_reverse_depreciation(self):
        """Test the reversal of a depreciation move"""

        self.assertEqual(sum(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'posted').mapped('amount_total')), 4500)
        self.assertEqual(sum(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'draft').mapped('amount_total')), 3000)
        self.assertEqual(max(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'posted'), key=lambda m: m.date).asset_remaining_value, 3000)

        move_to_reverse = self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'posted').sorted(lambda m: m.date)[-1]
        move_to_reverse._reverse_moves()

        # Check that we removed the depreciation in the table for the reversed move
        max_date_posted_before = max(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'posted' and m.date < move_to_reverse.date), key=lambda m: m.date)
        self.assertEqual(move_to_reverse.asset_remaining_value, max_date_posted_before.asset_remaining_value)
        self.assertEqual(move_to_reverse.asset_depreciated_value, max_date_posted_before.asset_depreciated_value)

        # Check that the depreciation has been reported on the next move
        min_date_draft = min(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'draft' and m.date > move_to_reverse.date), key=lambda m: m.date)
        self.assertEqual(move_to_reverse.asset_remaining_value - min_date_draft.amount_total, min_date_draft.asset_remaining_value)
        self.assertEqual(move_to_reverse.asset_depreciated_value + min_date_draft.amount_total, min_date_draft.asset_depreciated_value)

        # The amount is still there, it only has been reversed. But it has been added on the next draft move to complete the depreciation table
        self.assertEqual(sum(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'posted').mapped('amount_total')), 4500)
        self.assertEqual(sum(self.truck.depreciation_move_ids.filtered(lambda m: m.state == 'draft').mapped('amount_total')), 3750)

        # Check that the table shows fully depreciated at the end
        self.assertEqual(max(self.truck.depreciation_move_ids, key=lambda m: m.date).asset_remaining_value, 0)
        self.assertEqual(max(self.truck.depreciation_move_ids, key=lambda m: m.date).asset_depreciated_value, 7500)

    def test_asset_reverse_original_move(self):
        """Test the reversal of a move that generated an asset"""

        move_id = self.env['account.move'].create({
            'ref': 'line1',
            'line_ids': [
                (0, 0, {
                    'account_id': self.company_data['default_account_expense'].id,
                    'debit': 300,
                    'name': 'Furniture',
                }),
                (0, 0, {
                    'account_id': self.company_data['default_account_assets'].id,
                    'credit': 300,
                }),
            ]
        })
        move_id.action_post()
        move_line_id = move_id.mapped('line_ids').filtered(lambda x: x.debit)

        asset_form = Form(self.env['account.asset'].with_context(asset_type='purchase'))
        asset_form._values['original_move_line_ids'] = [(6, 0, move_line_id.ids)]
        asset_form._perform_onchange(['original_move_line_ids'])
        asset_form.account_depreciation_expense_id = self.company_data['default_account_expense']

        asset = asset_form.save()

        self.assertTrue(asset.name, 'An asset should have been created')
        move_id._reverse_moves()
        with self.assertRaises(MissingError, msg='The asset should have been deleted'):
            asset.name

    def test_asset_multiple_assets_from_one_move_line_00(self):
        """ Test the creation of a as many assets as the value of
        the quantity property of a move line. """

        account = self.env['account.account'].create({
            "name": "test account",
            "code": "TEST",
            "user_type_id": self.env.ref('account.data_account_type_non_current_assets').id,
            "create_asset": "draft",
            "asset_type": "purchase",
            "multiple_assets_per_line": True,
        })
        move = self.env['account.move'].create({
            "partner_id": self.env['res.partner'].create({'name': 'Johny'}).id,
            "ref": "line1",
            "move_type": "in_invoice",
            "line_ids": [
                (0, 0, {
                    "account_id": account.id,
                    "debit": 800.0,
                    "name": "stuff",
                    "quantity": 2,
                    "product_uom_id": self.env.ref('uom.product_uom_unit').id,
                }),
                (0, 0, {
                    'account_id': self.company_data['default_account_assets'].id,
                    'credit': 800.0,
                }),
            ]
        })
        move.action_post()
        assets = move.asset_ids
        assets = sorted(assets, key=lambda i: i['original_value'], reverse=True)
        self.assertEqual(len(assets), 2, '3 assets should have been created')
        self.assertEqual(assets[0].original_value, 400.0)
        self.assertEqual(assets[1].original_value, 400.0)

    def test_asset_multiple_assets_from_one_move_line_01(self):
        """ Test the creation of a as many assets as the value of
        the quantity property of a move line. """

        account = self.env['account.account'].create({
            "name": "test account",
            "code": "TEST",
            "user_type_id": self.env.ref('account.data_account_type_non_current_assets').id,
            "create_asset": "draft",
            "asset_type": "purchase",
            "multiple_assets_per_line": True,
        })
        move = self.env['account.move'].create({
            "partner_id": self.env['res.partner'].create({'name': 'Johny'}).id,
            "ref": "line1",
            "move_type": "in_invoice",
            "line_ids": [
                (0, 0, {
                    "account_id": account.id,
                    "debit": 1000.0,
                    "name": "stuff",
                    "quantity": 3.0,
                    "product_uom_id": self.env.ref('uom.product_uom_categ_unit').id,
                }),
                (0, 0, {
                    'account_id': self.company_data['default_account_assets'].id,
                    'credit': 1000.0,
                }),
            ]
        })
        move.action_post()
        self.assertEqual(sum(asset.original_value for asset in move.asset_ids), move.line_ids[0].debit)

    def test_asset_credit_note(self):
        """Test the generated entries created from an in_refund invoice with deferred expense."""
        account_asset_model_fixedassets_test0 = self.env['account.asset'].create({
            'account_depreciation_id': self.company_data['default_account_assets'].id,
            'account_depreciation_expense_id': self.company_data['default_account_expense'].id,
            'account_asset_id': self.company_data['default_account_assets'].id,
            'journal_id': self.company_data['default_journal_purchase'].id,
            'name': 'Hardware - 3 Years',
            'method_number': 3,
            'method_period': '12',
            'state': 'model',
        })

        self.company_data['default_account_assets'].create_asset = "validate"
        self.company_data['default_account_assets'].asset_model = account_asset_model_fixedassets_test0

        invoice = self.env['account.move'].create({
            'move_type': 'in_refund',
            'partner_id': self.ref("base.res_partner_12"),
            'invoice_line_ids': [(0, 0, {
                'name': 'Refund Insurance claim',
                'account_id': self.company_data['default_account_assets'].id,
                'price_unit': 450,
                'quantity': 1,
            })],
        })
        invoice.action_post()
        depreciation_lines = self.env['account.move.line'].search([
            ('account_id', '=', account_asset_model_fixedassets_test0.account_depreciation_id.id),
            ('move_id.asset_id', '=', invoice.asset_ids.id),
            ('debit', '=', 150),
        ])
        self.assertEqual(
            len(depreciation_lines), 3,
            'Three entries with a debit of 150 must be created on the Deferred Expense Account'
        )
