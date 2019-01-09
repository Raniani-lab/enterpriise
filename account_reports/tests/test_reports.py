# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date
import calendar
from unittest.mock import patch

from odoo.tests import common
from odoo import fields


class TestAccountReports(common.TransactionCase):

    def test_05_apply_date_filter(self):
        # Greatly dependent on: account_reports.py:902 in _apply_date_filter
        def patched_today():
            return fields.Date.to_date('2018-12-11')

        with patch.object(fields.Date, 'today', patched_today):
            today = fields.Date.today()
            fiscal_date_to = self.env.user.company_id.compute_fiscalyear_dates(today)['date_to']
            fiscal_date_to_str = fields.Date.to_string(fiscal_date_to)

            options = {
                'date': {
                    'date': fiscal_date_to_str,
                    'filter': 'last_month',
                    'string': 'string',
                }
            }
            self.env['account.report']._apply_date_filter(options)

            target_day = calendar.monthrange(fiscal_date_to.year, fiscal_date_to.month - 1)[1]

            # New date in option should really be the month before
            expected_date = date(year=fiscal_date_to.year, month=fiscal_date_to.month - 1, day=target_day)
            expected_date = fields.Date.to_string(expected_date)

            self.assertEqual(options['date']['date'], expected_date)
