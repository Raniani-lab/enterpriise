# -*- coding: utf-8 -*-
# pylint: disable=C0326
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon

from odoo.tests import tagged
from odoo import fields, Command


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestBilanComptable(TestAccountReportsCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_fr.l10n_fr_pcg_chart_template'):
        super().setUpClass(chart_template_ref)

    def _build_generic_id_from_financial_line(self, financial_rep_ln_xmlid):
        report_line = self.env.ref(financial_rep_ln_xmlid)
        return '-account.financial.html.report.line-%s' % report_line.id

    def test_bilan_comptable_bank_actif_passif(self):
        report = self.env.ref('l10n_fr_reports.account_financial_report_l10n_fr_bilan')
        options = self._init_options(report, fields.Date.from_string('2019-01-01'), fields.Date.from_string('2019-12-31'))
        options['sorted_groupby_keys'] = [[0]]

        bank_journal = self.company_data['default_journal_bank']
        bank_account = bank_journal.default_account_id
        bank_account.code = '512004'

        # Create a move to bring the bank_journal to a positive value.
        move_2019_1 = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2019-01-01',
            'journal_id': bank_journal.id,
            'line_ids': [
                Command.create({
                    'debit': 100.0,
                    'credit': 0.0,
                    'name': '2019_1_1',
                    'account_id': bank_account.id,
                }),
                Command.create({
                    'debit': 0.0,
                    'credit': 100.0,
                    'name': '2019_1_2',
                    'account_id': self.company_data['default_account_revenue'].id,
                }),
            ],
        })
        move_2019_1.action_post()
        move_2019_1.line_ids.flush_recordset()

        # Check that it appears in the "Actif" section of the report.
        line_id = self._build_generic_id_from_financial_line('l10n_fr_reports.account_financial_report_line_03_5_4_fr_bilan_actif')
        options['unfolded_lines'] = [line_id]
        lines = report._get_lines(options, line_id=line_id)
        self.assertLinesValues(
            lines,
            #   Name                        Balance
            [   0,                          1],
            [
                ('Disponibilités',          100.0),
            ],
        )

        # Create a second move to bring the bank_journal to a negative value.
        move_2019_2 = self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2019-01-01',
            'journal_id': bank_journal.id,
            'line_ids': [
                Command.create({
                    'debit': 300.0,
                    'credit': 0.0,
                    'name': '2019_1_1',
                    'account_id': self.company_data['default_account_expense'].id,
                }),
                Command.create({
                    'debit': 0.0,
                    'credit': 300.0,
                    'name': '2019_1_2',
                    'account_id': bank_account.id,
                }),
            ],
        })
        move_2019_2.action_post()
        move_2019_2.line_ids.flush_recordset()

        # Check to make sure that it now appears in the "Passif" section of the report.
        line_id = self._build_generic_id_from_financial_line('l10n_fr_reports.account_financial_report_line_03_3_3_fr_bilan_passif')
        options['unfolded_lines'] = [line_id]
        lines = report._get_lines(options, line_id=line_id)
        self.assertLinesValues(
            lines,
            #   Name                                                            Balance
            [   0,                                                              1],
            [
                ('Emprunts et dettes auprès des établissements de crédit',      200.0),
            ],
        )
