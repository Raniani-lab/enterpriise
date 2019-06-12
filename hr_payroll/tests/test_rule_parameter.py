# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest.mock import patch
from datetime import date

from odoo.fields import Date
from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase


class TestRuleParameter(TransactionCase):

    def setUp(self):
        super().setUp()
        self.rule_parameter = self.env['hr.rule.parameter'].create({
            'name': 'Test Parameter',
            'code': 'test_param',
        })

        values = []
        for year in [2016, 2017, 2018, 2020]:
            values.append({
                'rule_parameter_id': self.rule_parameter.id,
                'parameter_value': str(year),
                'date_from': date(year, 1, 1)
            })
        self.env['hr.rule.parameter.value'].create(values)

    @patch.object(Date, 'today', lambda: date(2019, 10, 10))
    def test_get_last_version(self):
        value = self.env['hr.rule.parameter']._get_parameter_from_code('test_param')
        self.assertEqual(value, 2018, "It should get last valid value")

    def test_get_middle_version(self):
        value = self.env['hr.rule.parameter']._get_parameter_from_code('test_param', date=date(2017, 5, 5))
        self.assertEqual(value, 2017, "It should get the 2017 version")

    def test_get_unexisting_version(self):
        with self.assertRaises(UserError):
            value = self.env['hr.rule.parameter']._get_parameter_from_code('test_param', date=date(2014, 5, 5))

    def test_wrong_code(self):
        with self.assertRaises(UserError):
            value = self.env['hr.rule.parameter']._get_parameter_from_code('wrong_code')
