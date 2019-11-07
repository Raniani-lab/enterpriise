from odoo.addons.account.tests.common import AccountTestCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestBankStatementReconciliation(AccountTestCommon):

    @classmethod
    def setUpClass(cls):
        super(TestBankStatementReconciliation, cls).setUpClass()
        cls.reconciliation_widget = cls.env['account.reconciliation.widget']
        cls.bs_model = cls.env['account.bank.statement']
        cls.partner = cls.env['res.partner'].create({'name': 'test'})

    def test_reconciliation_proposition(self):
        move = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner.id,
            'invoice_line_ids': [(0, 0, {
                'quantity': 1,
                'price_unit': 100,
                'name': 'test invoice',
            })],
        })
        move.post()
        rcv_mv_line = move.line_ids.filtered(lambda line: line.account_id.user_type_id.type in ('receivable', 'payable'))

        journal = self.bs_model.with_context(journal_type='bank')._default_journal()
        st_line = self.bs_model.create({
            'journal_id': journal.id,
            'line_ids': [(0, 0, {
                'name': '_',
                'partner_id': self.partner.id,
                'amount': 100,
            })],
        }).line_ids

        # exact amount match
        rec_prop = self.reconciliation_widget.get_bank_statement_line_data(st_line.ids)['lines']
        prop = rec_prop[0]['reconciliation_proposition']

        self.assertEqual(len(prop), 1)
        self.assertEqual(prop[0]['id'], rcv_mv_line.id)
