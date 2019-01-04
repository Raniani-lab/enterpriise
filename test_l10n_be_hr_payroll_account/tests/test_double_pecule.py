# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo.tests import common


class TestDoublePecule(common.TransactionCase):
    def setUp(self):
        super(TestDoublePecule, self).setUp()

        self.employee = self.env['hr.employee'].create({
            'name': 'employee',
        })

        self.contract = self.env['hr.contract'].create({
            'name': 'Contract',
            'wage': 2500.0,
            'employee_id': self.employee.id,
            'state': 'open',
            'internet': False,
            'mobile': False,
        })

    def check_payslip(self, name, payslip, values):
        for code, value in values.items():
            self.assertEqual(payslip.line_ids.filtered(lambda line: line.code == code).total, value, '%s for %s should be of %.2f' % (code, name, value))

    def test_double_holiday_pay(self):
        structure = self.env.ref('l10n_be_hr_payroll.hr_payroll_salary_structure_double_holiday_pay')

        payslip = self.env['hr.payslip'].create({
            'struct_id': structure.id,
            'name': 'Double Holiday Pay for %s' % self.employee.name,
            'employee_id': self.employee.id,
            'date_from': datetime(2019, 1, 1),
            'date_to': datetime(2019, 1, 31),
            'contract_id': self.contract.id,
        })

        payslip.compute_sheet()

        self.check_payslip('double holiday pay', payslip, {
            'BASIC': 2500.0,
            'D.P': 2300.0,
            'SALARY': 2125.0,
            'ONSS': -277.74,
            'P.P': -833.79,
            'NET': 1284.04,
        })

    def test_end_of_year_bonus(self):
        structure = self.env.ref('l10n_be_hr_payroll.hr_payroll_salary_structure_end_of_year_bonus')

        payslip = self.env['hr.payslip'].create({
            'struct_id': structure.id,
            'name': 'End of Year Bonus for %s' % self.employee.name,
            'employee_id': self.employee.id,
            'date_from': datetime(2019, 1, 1),
            'date_to': datetime(2019, 1, 31),
            'contract_id': self.contract.id,
        })

        payslip.compute_sheet()

        self.check_payslip('end of year bonus', payslip, {
            'BASIC': 2500.0,
            'SALARY': 2500.0,
            'ONSS': -326.75,
            'GROSS': 2173.25,
            'P.P': -943.41,
            'M.ONSS': -22.01,
            'NET': 1207.83,
        })
