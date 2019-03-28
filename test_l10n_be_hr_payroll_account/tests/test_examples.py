# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from collections import OrderedDict

from odoo.tests import common, tagged


@tagged('examples')
class TestExamples(common.SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(TestExamples, cls).setUpClass()

        cls.Payslip = cls.env['hr.payslip']
        cls.journal_id = cls.env['account.journal'].search([], limit=1).id

    def case_test(self, line_values, employee_values, payslip_values=None, contract_values=None):
        """
            Line_values is a dict with key = line.code and value = line.value
            Employee_values is either a dict to pass to create or an xmlid
            Payslip_values is a dict to pass to create
            Contract_values is a dict to pass to create
        """
        # Setup the employee
        if isinstance(employee_values, dict):
            employee = self.env['hr.employee'].create(employee_values)
        else:
            employee = self.env.ref(employee_values)

        # Setup the contract, use the above employee
        if isinstance(contract_values, dict):
            contract_values = dict(contract_values,
                                   employee_id=employee.id)
            contract_id = self.env['hr.contract'].create(contract_values)
            contract_id.write({'state': 'open'})

        # Generate the poubelles
        if 'date_from' in payslip_values and 'date_to' in payslip_values:
            work_entries = employee.generate_work_entry(payslip_values['date_from'], payslip_values['date_to'])
            work_entries.action_validate()

        # Setup the payslip
        payslip_values = dict(payslip_values or {},
                              journal_id=self.journal_id,
                              contract_id=employee.contract_id)

        payslip_id = self.Payslip.new(self.Payslip.default_get(self.Payslip.fields_get()))
        payslip_id.update(payslip_values)

        payslip_id.employee_id = employee.id
        payslip_id.onchange_employee()
        payslip_id._onchange_struct_id()
        values = payslip_id._convert_to_write(payslip_id._cache)
        payslip_id = self.Payslip.create(values)

        # Compute the payslip
        payslip_id.compute_sheet()

        # Check that all is right
        for code, value in line_values.items():
            self.assertEqual(payslip_id.get_salary_line_total(code), value,
                             'Line %s for employee %s failed' % (code, employee.name))

        # Confirm the payslip
        payslip_id.action_payslip_done()

    def test_cdi_laurie_poiret(self):
        values = OrderedDict([
            ('BASIC', 2650.00),
            ('ATN.INT', 5.00),
            ('ATN.MOB', 12.0),
            ('SALARY', 2667.00),
            ('ONSS', -348.58),
            ('ATN.CAR', 154.71),
            ('GROSS', 2473.14),
            ('P.P', -533.87),
            ('ATN.CAR.2', -154.71),
            ('ATN.INT.2', -5.00),
            ('ATN.MOB.2', -12.00),
            ('M.ONSS', -23.66),
            ('MEAL_V_EMP', -20.71),
            ('REP.FEES', 150.00),
            ('NET', 1873.19),
        ])
        payslip = {
            'date_from': datetime.date.today().replace(year=2018, month=2, day=1),
            'date_to': datetime.date.today().replace(year=2018, month=2, day=28),
        }
        contract = self.env.ref('hr_contract_salary.hr_contract_cdi_laurie_poiret')
        # Set the start date to January 2018 to take into account on payslip
        contract.date_start = contract.date_start.replace(year=2018, month=1, day=1)
        self.case_test(values, 'hr_contract_salary.hr_employee_laurie_poiret', payslip_values=payslip)

    def test_example(self):
        values = OrderedDict([
            ('BASIC', 2500.0),
        ])
        employee = {
            'name': 'Roger',
        }
        contract = {
            'name': 'Contract For Roger',
            'date_start': datetime.date(2019, 1, 1),
            'wage': 2500,
        }
        payslip = {
            'struct_id': self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary'),
        }
        self.case_test(values, employee, payslip_values=payslip, contract_values=contract)
