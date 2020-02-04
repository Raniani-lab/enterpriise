# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .common import TestAccountBudgetCommon
from unittest.mock import patch

from odoo.fields import Datetime, Date
from odoo.tests import tagged
from datetime import datetime, timedelta
import logging


_logger = logging.getLogger(__name__)
# ---------------------------------------------------------
# Tests
# ---------------------------------------------------------
@tagged('post_install', '-at_install')
class TestTheoreticalAmount(TestAccountBudgetCommon):
    
    @classmethod
    def setUpClass(cls):
        super(TestTheoreticalAmount, cls).setUpClass()
        #create the budgetary position
        user_type_id = cls.env.ref('account.data_account_type_revenue').id
        tag_id = cls.env.ref('account.account_tag_operating').id
        account_rev = cls.env['account.account'].create({
            'code': 'Y2020',
            'name': 'Budget - Test Revenue Account',
            'user_type_id': user_type_id,
            'tag_ids': [(4, tag_id, 0)]
        })
        buget_post = cls.env['account.budget.post'].create({
            'name': 'Sales',
            'account_ids': [(4, account_rev.id, 0)],
        })
        #create the budget and budget lines
        first_january = Datetime.now().replace(day=1, month=1)
        cls.last_day_of_budget = first_january + timedelta(days=364)  # will be 30th of December or 31th in case of leap year

        date_from = first_january.date()
        date_to = cls.last_day_of_budget.date()

        crossovered_budget = cls.env['crossovered.budget'].create({
            'name': 'test budget name',
            'date_from': date_from,
            'date_to': date_to,
        })
        crossovered_budget_line_obj = cls.env['crossovered.budget.lines']
        cls.line = crossovered_budget_line_obj.create({
            'crossovered_budget_id': crossovered_budget.id,
            'general_budget_id': buget_post.id,
            'date_from': date_from,
            'date_to': date_to,
            'planned_amount': -364,
        })
        cls.paid_date_line = crossovered_budget_line_obj.create({
            'crossovered_budget_id': crossovered_budget.id,
            'general_budget_id': buget_post.id,
            'date_from': date_from,
            'date_to': date_to,
            'planned_amount': -364,
            'paid_date':  Date.today().replace(day=9, month=9),
        })

    def setUp(self):
        super(TestTheoreticalAmount, self).setUp()

        self.patcher = patch('odoo.addons.account_budget.models.account_budget.fields.Date', wraps=Date)
        self.mock_date = self.patcher.start()

    def test_theoritical_amount_without_paid_date(self):
        test_list = [
            (str(datetime.now().year) + '-01-01', 0),
            (str(datetime.now().year) + '-01-02', -1),
            (str(datetime.now().year) + '-01-03', -2),
            (str(datetime.now().year) + '-01-11', -10),
            (str(datetime.now().year) + '-02-20', -50),
            (str(self.last_day_of_budget.date()), -364),
        ]
        for date, expected_amount in test_list:
            _logger.info("Checking theoritical amount for the date: " + date)
            self.mock_date.today.return_value = Date.from_string(date)
            self.assertAlmostEqual(self.line.theoritical_amount, expected_amount)
            #invalidate the cache of the budget lines to recompute the theoritical amount at next iteration
            self.line.invalidate_cache()

    def test_theoritical_amount_with_paid_date(self):
        test_list = [
            (str(datetime.now().year) + '-01-01', 0),
            (str(datetime.now().year) + '-01-02', 0),
            (str(datetime.now().year) + '-09-08', 0),
            (str(datetime.now().year) + '-09-09', 0),
            (str(datetime.now().year) + '-09-10', -364),
            (str(self.last_day_of_budget.date()), -364),
        ]
        for date, expected_amount in test_list:
            _logger.info("Checking theoritical amount for the date: " + date)
            self.mock_date.today.return_value = Date.from_string(date)
            self.assertAlmostEqual(self.paid_date_line.theoritical_amount, expected_amount)
            #invalidate the cache of the budget lines to recompute the theoritical amount at next iteration
            self.paid_date_line.invalidate_cache()

    def tearDown(self):
        self.patcher.stop()
        super(TestTheoreticalAmount, self).tearDown()
