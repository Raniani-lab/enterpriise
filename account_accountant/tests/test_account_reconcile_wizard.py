from odoo import Command, fields
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.exceptions import UserError
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestAccountReconcileWizard(AccountTestInvoicingCommon):
    """ Tests the account reconciliation and its wizard. """

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.receivable_account = cls.company_data['default_account_receivable']
        cls.payable_account = cls.company_data['default_account_payable']
        cls.revenue_account = cls.company_data['default_account_revenue']
        cls.payable_account_2 = cls.env['account.account'].create({
            'name': 'Payable Account 2',
            'account_type': 'liability_current',
            'code': 'PAY2.TEST',
            'reconcile': True
        })
        cls.write_off_account = cls.env['account.account'].create({
            'name': 'Write-Off Account',
            'account_type': 'liability_current',
            'code': 'WO.TEST',
            'reconcile': False
        })

        cls.misc_journal = cls.company_data['default_journal_misc']
        cls.test_date = fields.Date.from_string('2016-01-01')
        cls.company_currency = cls.company_data['currency']
        cls.foreign_currency = cls.currency_data['currency']

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------
    def assertWizardReconcileValues(self, selected_lines, input_values, wo_expected_values, expected_transfer_values=None):
        wizard = self.env['account.reconcile.wizard'].with_context(
            active_model='account.move.line',
            active_ids=selected_lines.ids,
        ).new(input_values)
        if expected_transfer_values:
            transfer_move = wizard.create_transfer()
            self.assertRecordValues(transfer_move.line_ids.sorted('balance'), expected_transfer_values)
        write_off_move = wizard.create_write_off()
        self.assertRecordValues(write_off_move.line_ids.sorted('balance'), wo_expected_values)
        wizard.reconcile()
        self.assertTrue(selected_lines.full_reconcile_id)
        self.assertRecordValues(
            selected_lines,
            [{'amount_residual': 0.0, 'amount_residual_currency': 0.0, 'reconciled': True}] * len(selected_lines),
        )

    # -------------------------------------------------------------------------
    # TESTS
    # -------------------------------------------------------------------------
    def test_wizard_should_not_open(self):
        """ Test that when we reconcile two lines that belong to the same account and have a 0 balance should
        reconcile silently and not open the write-off wizard.
        """
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-1000.0, -1000.0, self.company_currency, '2016-01-01')
        (line_1 + line_2).action_reconcile()
        self.assertRecordValues(
            line_1 + line_2,
            [{'amount_residual': 0.0, 'amount_residual_currency': 0.0, 'reconciled': True}] * 2
        )

    def test_wizard_should_open(self):
        """ Test that when a write-off is required (because of transfer or non-zero balance) the wizard opens. """
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-01-01')
        line_3 = self.create_line_for_reconciliation(-500.0, -1500.0, self.foreign_currency, '2016-01-01')
        line_4 = self.create_line_for_reconciliation(-900.0, -900.0, self.company_currency, '2016-01-01', account_1=self.payable_account)
        for batch, sub_test_name in (
                (line_1 + line_2, 'Batch with non-zero balance in company currency'),
                (line_1 + line_3, 'Batch with non-zero balance in foreign currency'),
                (line_1 + line_4, 'Batch with different accounts'),
        ):
            with self.subTest(sub_test_name=sub_test_name):
                returned_action = batch.action_reconcile()
                self.assertEqual(returned_action.get('res_model'), 'account.reconcile.wizard')

    def test_reconcile_silently_same_account(self):
        """ When balance is 0 we can silently reconcile items. """
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-1000.0, -1000.0, self.company_currency, '2016-01-01')
        lines = (line_1 + line_2)
        lines.action_reconcile()
        self.assertTrue(lines.full_reconcile_id)
        self.assertRecordValues(
            lines,
            [{'amount_residual': 0.0, 'amount_residual_currency': 0.0, 'reconciled': True}] * len(lines),
        )

    def test_reconcile_silently_transfer(self):
        """ When balance is 0, and we need a transfer, we do the transfer+reconcile silently. """
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-1000.0, -1000.0, self.company_currency, '2016-01-01', account_1=self.payable_account)
        lines = (line_1 + line_2)
        lines.action_reconcile()
        self.assertTrue(lines.full_reconcile_id)
        self.assertRecordValues(
            lines,
            [{'amount_residual': 0.0, 'amount_residual_currency': 0.0, 'reconciled': True}] * len(lines),
        )

    def test_write_off_same_currency(self):
        """ Reconciliation of two lines with no transfer/foreign currencies/taxes/reco models."""
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-01-01')
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': self.test_date,
        }
        write_off_expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off', 'balance': -500.0},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label', 'balance': 500.0},
        ]
        self.assertWizardReconcileValues(line_1 + line_2, wizard_input_values, write_off_expected_values)

    def test_write_off_one_foreign_currency(self):
        """ Reconciliation of two lines with one of the two using foreign currency should reconcile in foreign currency."""
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -1500.0, self.foreign_currency, '2016-01-01')
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': self.test_date,
        }
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -500.0, 'amount_currency': -1500.0, 'currency_id': self.foreign_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 500.0, 'amount_currency': 1500.0, 'currency_id': self.foreign_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2, wizard_input_values, expected_values)

    def test_write_off_mixed_foreign_currencies(self):
        """ Write off with multiple currencies should reconcile in company currency."""
        foreign_currency_2 = self.setup_multi_currency_data(default_values={
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        }, rate2016=6.0, rate2017=4.0)['currency']
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -1500.0, self.foreign_currency, '2016-01-01')
        line_3 = self.create_line_for_reconciliation(-400.0, -2400.0, foreign_currency_2, '2016-01-01')
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': self.test_date,
        }
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -100.0, 'amount_currency': -100.0, 'currency_id': self.company_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 100.0, 'amount_currency': 100.0, 'currency_id': self.company_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2 + line_3, wizard_input_values, expected_values)

    def test_write_off_one_foreign_currency_change_rate(self):
        """ Tests that write-off use the correct rate from/at wizard's date. """
        choco_currency = self.setup_multi_currency_data(default_values={
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        }, rate2016=1/2, rate2017=1/3)['currency']
        new_date = fields.Date.from_string('2017-02-01')
        line_1 = self.create_line_for_reconciliation(-2000.0, -2000.0, self.company_currency, '2017-01-01')  # conversion in 2017 => -666.67🍫
        line_2 = self.create_line_for_reconciliation(2000.0, 1000.0, choco_currency, '2016-01-01')
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': new_date,
        }
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -1000.0, 'amount_currency': -333.333, 'currency_id': choco_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 1000.0, 'amount_currency': 333.333, 'currency_id': choco_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2, wizard_input_values, expected_values)

    def test_write_off_mixed_foreign_currencies_change_rate(self):
        """ Tests that write-off use the correct rate from/at wizard's date. """
        foreign_currency_2 = self.setup_multi_currency_data(default_values={
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        }, rate2016=6.0, rate2017=4.0)['currency']
        new_date = fields.Date.from_string('2017-02-01')
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -1500.0, self.foreign_currency, '2016-01-01')
        line_3 = self.create_line_for_reconciliation(-400.0, -2400.0, foreign_currency_2, '2016-01-01')
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': new_date,
        }
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -100.0, 'amount_currency': -100.0, 'currency_id': self.company_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 100.0, 'amount_currency': 100.0, 'currency_id': self.company_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2 + line_3, wizard_input_values, expected_values)

    def test_write_off_with_transfer_account_same_currency(self):
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(100.0, 100.0, self.company_currency, '2016-01-01', account_1=self.payable_account)
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': self.test_date,
        }
        expected_transfer_values = [
            {'account_id': self.payable_account.id, 'name': f'Transfer to {self.receivable_account.display_name}',
             'balance': -100.0, 'amount_currency': -100.0, 'currency_id': self.company_currency.id},
            {'account_id': self.receivable_account.id, 'name': f'Transfer from {self.payable_account.display_name}',
             'balance': 100.0, 'amount_currency': 100.0, 'currency_id': self.company_currency.id},
        ]
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -1100.0, 'amount_currency': -1100.0, 'currency_id': self.company_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 1100.0, 'amount_currency': 1100.0, 'currency_id': self.company_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2, wizard_input_values, expected_values, expected_transfer_values=expected_transfer_values)

    def test_write_off_with_transfer_account_one_foreign_currency(self):
        line_1 = self.create_line_for_reconciliation(1100.0, 1100.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(100.0, 300.0, self.foreign_currency, '2016-01-01', account_1=self.payable_account)
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': self.test_date,
        }
        expected_transfer_values = [
            {'account_id': self.payable_account.id, 'name': f'Transfer to {self.receivable_account.display_name}',
             'balance': -100.0, 'amount_currency': -300.0, 'currency_id': self.foreign_currency.id},
            {'account_id': self.receivable_account.id, 'name': f'Transfer from {self.payable_account.display_name}',
             'balance': 100.0, 'amount_currency': 300.0, 'currency_id': self.foreign_currency.id},
        ]
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -1200.0, 'amount_currency': -3600.0, 'currency_id': self.foreign_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 1200.0, 'amount_currency': 3600.0, 'currency_id': self.foreign_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2, wizard_input_values, expected_values, expected_transfer_values=expected_transfer_values)

    def test_write_off_with_complex_transfer(self):
        partner_1 = self.env['res.partner'].create({'name': 'Test Partner 1'})
        partner_2 = self.env['res.partner'].create({'name': 'Test Partner 2'})
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01', partner=partner_2)
        line_2 = self.create_line_for_reconciliation(-100.0, -300.0, self.foreign_currency, '2016-01-01', account_1=self.payable_account, partner=partner_1)
        line_3 = self.create_line_for_reconciliation(-200.0, -200.0, self.company_currency, '2016-01-01', account_1=self.payable_account, partner=partner_2)
        line_4 = self.create_line_for_reconciliation(-200.0, -600.0, self.foreign_currency, '2016-01-01', account_1=self.payable_account, partner=partner_2)
        line_5 = self.create_line_for_reconciliation(-200.0, -600.0, self.foreign_currency, '2016-01-01', account_1=self.payable_account, partner=partner_2)
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'allow_partials': False,
            'date': self.test_date,
        }
        expected_transfer_values = [
            {'account_id': self.receivable_account.id, 'name': f'Transfer from {self.payable_account.display_name}',
             'balance': -400.0, 'amount_currency': -1200.0, 'currency_id': self.foreign_currency.id, 'partner_id': partner_2.id},
            {'account_id': self.receivable_account.id, 'name': f'Transfer from {self.payable_account.display_name}',
             'balance': -200.0, 'amount_currency': -200.0, 'currency_id': self.company_currency.id, 'partner_id': partner_2.id},
            {'account_id': self.receivable_account.id, 'name': f'Transfer from {self.payable_account.display_name}',
             'balance': -100.0, 'amount_currency': -300.0, 'currency_id': self.foreign_currency.id, 'partner_id': partner_1.id},
            {'account_id': self.payable_account.id, 'name': f'Transfer to {self.receivable_account.display_name}',
             'balance': 100.0, 'amount_currency': 300.0, 'currency_id': self.foreign_currency.id, 'partner_id': partner_1.id},
            {'account_id': self.payable_account.id, 'name': f'Transfer to {self.receivable_account.display_name}',
             'balance': 200.0, 'amount_currency': 200.0, 'currency_id': self.company_currency.id, 'partner_id': partner_2.id},
            {'account_id': self.payable_account.id, 'name': f'Transfer to {self.receivable_account.display_name}',
             'balance': 400.0, 'amount_currency': 1200.0, 'currency_id': self.foreign_currency.id, 'partner_id': partner_2.id},
        ]
        expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off',
             'balance': -300.0, 'amount_currency': -900.0, 'currency_id': self.foreign_currency.id},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label',
             'balance': 300.0, 'amount_currency': 900.0, 'currency_id': self.foreign_currency.id},
        ]
        self.assertWizardReconcileValues(line_1 + line_2 + line_3 + line_4 + line_5, wizard_input_values, expected_values, expected_transfer_values=expected_transfer_values)

    def test_write_off_with_tax(self):
        """ Tests write-off with a tax set on the wizard. """
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-01-01')
        tax_recover_account_id = self.env['account.account'].create({
            'name': 'Tax Account Test',
            'account_type': 'liability_current',
            'code': 'TAX.TEST',
            'reconcile': False
        })
        base_tag = self.env['account.account.tag'].create({
            'applicability': 'taxes',
            'name': 'base_tax_tag',
            'country_id': self.company_data['company'].country_id.id,
        })
        tax_tag = self.env['account.account.tag'].create({
            'applicability': 'taxes',
            'name': 'tax_tax_tag',
            'country_id': self.company_data['company'].country_id.id,
        })
        tax_id = self.env['account.tax'].create({
            'name': 'tax_test',
            'amount_type': 'percent',
            'amount': 25.0,
            'type_tax_use': 'sale',
            'company_id': self.company_data['company'].id,
            'invoice_repartition_line_ids': [
                Command.create({'factor_percent': 100, 'repartition_type': 'base', 'tag_ids': [Command.set(base_tag.ids)]}),
                Command.create({'factor_percent': 100, 'account_id': tax_recover_account_id.id, 'tag_ids': [Command.set(tax_tag.ids)]}),
            ],
            'refund_repartition_line_ids': [
                Command.create({'factor_percent': 100, 'repartition_type': 'base', 'tag_ids': [Command.set(base_tag.ids)]}),
                Command.create({'factor_percent': 100, 'account_id': tax_recover_account_id.id, 'tag_ids': [Command.set(tax_tag.ids)]}),
            ],
        })
        wizard_input_values = {
            'journal_id': self.misc_journal.id,
            'account_id': self.write_off_account.id,
            'label': 'Write-Off Test Label',
            'tax_id': tax_id.id,
            'allow_partials': False,
            'date': self.test_date,
        }
        write_off_expected_values = [
            {'account_id': self.receivable_account.id, 'name': 'Write-Off', 'balance': -500.0},
            {'account_id': tax_recover_account_id.id, 'name': f'{tax_id.name}', 'balance': 100.0, 'tax_tag_ids': 'tax_tax_tag'},
            {'account_id': self.write_off_account.id, 'name': 'Write-Off Test Label', 'balance': 400.0, 'tax_tag_ids': 'base_tax_tag'},
        ]
        self.assertWizardReconcileValues(line_1 + line_2, wizard_input_values, write_off_expected_values)

    def test_reconcile_partials_allowed(self):
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-01-01')
        lines = line_1 + line_2
        wizard_input_values = {
            'allow_partials': True,
        }
        wizard = self.env['account.reconcile.wizard'].with_context(
            active_model='account.move.line',
            active_ids=lines.ids,
        ).new(wizard_input_values)
        wizard.reconcile()
        self.assertTrue(len(lines.matched_debit_ids) > 0 or len(lines.matched_credit_ids) > 0)

    def test_raise_lock_date_violation(self):
        """ If a write-off violates the lock date we display a banner and change the date afterwards. """
        company_id = self.company_data['company']
        company_id.fiscalyear_lock_date = fields.Date.from_string('2016-12-01')
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-06-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-06-01')
        wizard = self.env['account.reconcile.wizard'].with_context(
            active_model='account.move.line',
            active_ids=(line_1 + line_2).ids,
        ).new({'date': self.test_date})
        self.assertTrue(bool(wizard.lock_date_violated_warning_message))

    def test_raise_reconcile_too_many_accounts(self):
        """ If you try to reconcile lines from more than 2 accounts, it should raise an error. """
        line_1 = self.create_line_for_reconciliation(1000.0, 1000.0, self.company_currency, '2016-01-01')
        line_2 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-01-01', account_1=self.payable_account)
        line_3 = self.create_line_for_reconciliation(-500.0, -500.0, self.company_currency, '2016-01-01', account_1=self.payable_account_2)
        with self.assertRaises(UserError):
            (line_1 + line_2 + line_3).action_reconcile()
