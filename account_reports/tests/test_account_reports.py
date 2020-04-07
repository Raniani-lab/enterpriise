# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests import tagged
from odoo.tests.common import Form
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, date_utils
from unittest.mock import patch
import datetime
import logging

from odoo.addons.account_reports.tests.common import TestAccountReportsCommon

_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountReports(TestAccountReportsCommon):

    # -------------------------------------------------------------------------
    # TESTS: Multicurrency Revaluation Report
    # -------------------------------------------------------------------------
    def test_multi_currency_revaluation_report(self):
        report = self.env['account.multicurrency.revaluation.report']

        self.eur_to_usd.name = '2015-01-10'
        # 1 USD = 2.0 EUR at this date
        # 1 USD = 1.0 EUR before this date

        # Create invoice and payment in foreign currency
        self_eur = report.with_context(default_currency_id=self.env.ref('base.EUR').id)
        invoice = self._create_invoice(self_eur.env, 1000, self.partner_a, 'out_invoice', '2015-01-01')
        self._create_payment(self_eur.env, fields.Date.from_string('2015-01-15'), invoice, amount=1035)

        # Create invoice and payment in company currency. These should not appear in the report.
        self_usd = report.with_context(default_currency_id=self.env.ref('base.USD').id)
        invoice = self._create_invoice(self_usd.env, 1000, self.partner_a, 'out_invoice', '2015-01-01')
        self._create_payment(self_usd.env, fields.Date.from_string('2015-01-15'), invoice, amount=1035)

        # Check values before payment and before rate change
        options = self._init_options(report, fields.Date.from_string('2015-01-01'), fields.Date.from_string('2015-01-01'))
        self.assertLinesValues(report._get_lines(options),
            [     0,                                     1,            2,            3,           4],
            [
                ('Accounts to adjust',                  '',           '',           '',          ''),
                ('EUR (1 USD = 1.0 EUR)',     '1,150.00 €', '$ 1,150.00', '$ 1,150.00',    '$ 0.00'),
                ('121000 Account Receivable', '1,150.00 €', '$ 1,150.00', '$ 1,150.00',    '$ 0.00'),
            ],
        )

        # Check values before payment and after rate change
        options = self._init_options(report, fields.Date.from_string('2015-01-10'), fields.Date.from_string('2015-01-10'))
        self.assertLinesValues(report._get_lines(options),
            [     0,                                     1,            2,            3,           4],
            [
                ('Accounts to adjust',                  '',           '',           '',          ''),
                ('EUR (1 USD = 2.0 EUR)',     '1,150.00 €', '$ 1,150.00',   '$ 575.00', '$ -575.00'),
                ('121000 Account Receivable', '1,150.00 €', '$ 1,150.00',   '$ 575.00', '$ -575.00'),
            ],
        )

        # Check values after payment and after rate change
        options = self._init_options(report, fields.Date.from_string('2015-01-31'), fields.Date.from_string('2015-01-31'))
        self.assertLinesValues(report._get_lines(options),
            [     0,                                     1,            2,            3,           4],
            [
                ('Accounts to adjust',                  '',           '',           '',          ''),
                ('EUR (1 USD = 2.0 EUR)',       '115.00 €',   '$ 632.50',    '$ 57.50', '$ -575.00'),
                ('121000 Account Receivable',   '115.00 €',   '$ 632.50',    '$ 57.50', '$ -575.00'),
            ],
        )
