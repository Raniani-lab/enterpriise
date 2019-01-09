# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from odoo import tests


class TestUi(tests.HttpCase):

    def test_payslip(self):
        contract = self.env.ref('hr_contract_salary.hr_contract_cdi_laurie_poiret')
        # Set the start date to January 2018 to take into account on payslip
        contract.date_start = contract.date_start.replace(year=2018, month=1, day=1)

        # Create a payslip for Laurie Poiret from the 1rst to the 28th of February 2018
        Payslip = self.env['hr.payslip']
        payslip = Payslip.new(Payslip.default_get(Payslip.fields_get()))
        payslip.date_from = datetime.date.today().replace(year=2018, month=2, day=1)
        payslip.date_to = datetime.date.today().replace(year=2018, month=2, day=28)
        payslip.employee_id = self.env.ref('hr_contract_salary.hr_employee_laurie_poiret').id
        payslip.onchange_employee()
        payslip.onchange_contract()
        payslip.journal_id = self.env['account.journal'].search([], limit=1).id
        values = payslip._convert_to_write(payslip._cache)
        payslip = Payslip.create(values)

        # Check that there is one worked days line of 20 days
        self.assertEqual(len(payslip.worked_days_line_ids), 1)
        self.assertEqual(payslip.worked_days_line_ids.number_of_days, 20)

        # Compute the payslip lines
        payslip.compute_sheet()

        # Check the amounts on payslip
        self.assertEqual(len(payslip.line_ids), 15)
        self.assertEqual(payslip.get_salary_line_total('BASIC'), 2650.00)
        self.assertEqual(payslip.get_salary_line_total('ATN.INT'), 5.00)
        self.assertEqual(payslip.get_salary_line_total('ATN.MOB'), 12.0)
        self.assertEqual(payslip.get_salary_line_total('SALARY'), 2667.00)
        self.assertEqual(payslip.get_salary_line_total('ONSS'), -348.58)
        self.assertEqual(payslip.get_salary_line_total('ATN.CAR'), 152.00)
        self.assertEqual(payslip.get_salary_line_total('GROSS'), 2470.42)
        self.assertEqual(payslip.get_salary_line_total('P.P'), -533.87)
        self.assertEqual(payslip.get_salary_line_total('ATN.CAR.2'), -152.00)
        self.assertEqual(payslip.get_salary_line_total('ATN.INT.2'), -5.00)
        self.assertEqual(payslip.get_salary_line_total('ATN.MOB.2'), -12.00)
        self.assertEqual(payslip.get_salary_line_total('M.ONSS'), -23.66)
        self.assertEqual(payslip.get_salary_line_total('MEAL_V_EMP'), -21.80)
        self.assertEqual(payslip.get_salary_line_total('REP.FEES'), 150.00)
        self.assertEqual(payslip.get_salary_line_total('NET'), 1872.1)

        # Confirm the payslip
        payslip.action_payslip_done()
