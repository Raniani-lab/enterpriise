# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from collections import OrderedDict
from pytz import timezone

from odoo.tests import common, tagged


@tagged('examples')
class TestExamples(common.SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(TestExamples, cls).setUpClass()

        cls.Payslip = cls.env['hr.payslip']
        cls.journal_id = cls.env['account.journal'].search([], limit=1).id

        cls.leave_type_bank_holidays = cls.env['hr.leave.type'].create({
            'name': 'Bank Holiday',
            'request_unit': 'hour',
            'allocation_type': 'no',
            'validity_start': datetime.date(2015, 1, 1),
            'company_id': cls.env.ref('l10n_be_hr_payroll.res_company_be').id,
            'work_entry_type_id': cls.env.ref('hr_payroll.work_entry_type_leave').id,
        })
        cls.leave_type_unpaid = cls.env['hr.leave.type'].create({
            'name': 'Unpaid',
            'request_unit': 'hour',
            'allocation_type': 'no',
            'validity_start': datetime.date(2015, 1, 1),
            'company_id': cls.env.ref('l10n_be_hr_payroll.res_company_be').id,
            'work_entry_type_id': cls.env.ref('hr_payroll.work_entry_type_unpaid_leave').id,
        })

    def case_test(self, line_values, employee_values, payslip_values=None, contract_values=None, holidays_values=None, car_values=None, car_contract_values=None):
        """
            Line_values is a dict with key = line.code and value = line.value
            Employee_values is either a dict to pass to create or an xmlid
            Payslip_values is a dict to pass to create
            Contract_values is a dict to pass to create
        """
        if holidays_values is None:
            holidays_values = []

        # Setup the employee

        if isinstance(employee_values, dict):
            employee = self.env['hr.employee'].create(employee_values)
        else:
            employee = self.env.ref(employee_values)
            # Reset work entry generation
            self.env['hr.work.entry'].search([('employee_id', '=', employee.id)]).unlink()
            employee.contract_id.date_generated_from = datetime.datetime.now()
            employee.contract_id.date_generated_to = datetime.datetime.now()

        # Setup the car, if specified
        if car_values is not None:
            car = self.env['fleet.vehicle'].create(car_values)
            contract_values.update({
                'transport_mode_car': True,
                'car_id': car.id,
            })

        if car_contract_values is not None:
            car.log_contracts.write(car_contract_values)

        # Setup the contract, use the above employee
        if isinstance(contract_values, dict):
            contract_values = dict(contract_values,
                                   employee_id=employee.id)
            contract_id = self.env['hr.contract'].create(contract_values)
            contract_id.write({'state': 'open'})

        # Setup the holidays, use the above employee and contract
        holidays = self.env['hr.leave']
        for holiday_values in holidays_values:
            if isinstance(holiday_values, dict):
                holiday_values.update({
                    'employee_id': employee.id,
                    'request_unit_hours': True,
                })
                holiday = self.env['hr.leave'].new(holiday_values)
                holiday._onchange_request_unit_hours()
                holidays |= self.env['hr.leave'].create(holiday._convert_to_write(holiday._cache))
        holidays.action_validate()
        self.env['hr.work.entry'].search([('leave_id', 'in', holidays.ids)]).action_validate()

        # Generate the poubelles
        if 'date_from' in payslip_values and 'date_to' in payslip_values:
            work_entries = employee.contract_id._generate_work_entries(payslip_values['date_from'], payslip_values['date_to'])
            work_entries.action_validate()
            we_error = work_entries.filtered(lambda r: r.display_warning)
            we_error.write({'state': 'cancelled'})
            (work_entries - we_error).action_validate()

        # Setup the payslip
        payslip_values = dict(payslip_values or {},
                              contract_id=employee.contract_id)

        payslip_id = self.Payslip.new(self.Payslip.default_get(self.Payslip.fields_get()))
        payslip_id.update(payslip_values)

        payslip_id.employee_id = employee.id
        payslip_id._onchange_employee()
        values = payslip_id._convert_to_write(payslip_id._cache)
        payslip_id = self.Payslip.create(values)
        payslip_id.struct_id.journal_id = self.journal_id

        # Compute the payslip
        payslip_id.compute_sheet()

        # Check that all is right
        error = False
        result = ""
        for code, value in line_values.items():
            payslip_value = payslip_id.get_salary_line_total(code)
            if payslip_id.get_salary_line_total(code) != value:
                error = True
                result += "Code: %s, Expected: %s, Reality: %s\n" % (code, value, payslip_value)
        self.assertEqual(error, False, 'The payslip values are incorrect for the following codes:\n' + result)

        # Confirm the payslip
        payslip_id.action_payslip_done()

    def test_cdi_laurie_poiret(self):
        values = OrderedDict([
            ('BASIC', 2650.00),
            ('ATN.INT', 5.00),
            ('ATN.MOB', 4.00),
            ('SALARY', 2659.00),
            ('ONSS', -347.53),
            ('ATN.CAR', 149.29),
            ('GROSS', 2460.75),
            ('P.P', -533.87),
            ('ATN.CAR.2', -149.29),
            ('ATN.INT.2', -5.00),
            ('ATN.MOB.2', -4.00),
            ('M.ONSS', -23.66),
            ('MEAL_V_EMP', -21.80),
            ('REP.FEES', 150.00),
            ('NET', 1873.14),
        ])
        payslip = {
            'date_from': datetime.date(2019, 2, 1),
            'date_to': datetime.date(2019, 2, 28),
            'struct_id': self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary'),
        }
        contract = self.env.ref('hr_contract_salary.hr_contract_cdi_laurie_poiret')
        # Set the start date to January 2019 to take into account on payslip
        contract.date_start = datetime.date(2019, 1, 1)
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

    # 4 hours unpaid, 2 days leave, no atn and no car
    # Note: The IP is not the same as in the reference payslip, as it
    # was incorrectly computed by SDWorx during 2018

    def test_without_car_without_atn(self):
        values = OrderedDict([
            ('BASIC', 3656.7),
            ('ATN.INT', 0.00),
            ('ATN.MOB', 0.0),
            ('SALARY', 3656.7),
            ('ONSS', -477.93),
            ('ATN.CAR', 0),
            ('GROSSIP', 3178.77),
            ('IP.PART', -914.18),
            ('GROSS', 2264.6),
            ('P.P', -476.6),
            ('ATN.CAR.2', 0),
            ('ATN.INT.2', 0),
            ('ATN.MOB.2', 0),
            ('M.ONSS', -34.73),
            ('MEAL_V_EMP', -21.80),
            ('REP.FEES', 150.00),
            ('IP', 914.18),
            ('IP.DED', -68.56),
            ('NET', 2727.08),
        ])
        employee = {
            'name': 'Roger2',
        }
        contract = {
            'name': 'Contract For Roger',
            'date_start': datetime.date(2018, 1, 1),
            'wage': 3746.33,
            'meal_voucher_amount': 7.45,
            'representation_fees': 150,
            'internet': 0,
            'mobile': 0,
            'ip_wage_rate': 25,
            'ip': True,
            'resource_calendar_id': self.ref('resource.resource_calendar_std_38h'),
        }
        payslip = {
            'date_from': datetime.date.today().replace(year=2018, month=11, day=1),
            'date_to': datetime.date.today().replace(year=2018, month=11, day=30),
            'struct_id': self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary'),
        }
        holidays_values = [{
            'name': 'Unpaid Leave 4 hours',
            'holiday_status_id': self.leave_type_unpaid.id,
            'request_date_from': datetime.date(2018, 11, 6),
            'request_date_to': datetime.date(2018, 11, 6),
            'request_hour_from': '7',
            'request_hour_to': '12',
        }, {
            'name': 'Bank Holiday',
            'holiday_status_id': self.leave_type_bank_holidays.id,
            'request_date_from': datetime.date(2018, 11, 9),
            'request_date_to': datetime.date(2018, 11, 9),
            'request_hour_from': '7',
            'request_hour_to': '18',
        }]
        self.case_test(values, employee, payslip_values=payslip, contract_values=contract, holidays_values=holidays_values)

    # 2 unpaid days + 2 bank holidays + IP + Mobile + 1 child + extra leaves
    # IP should be correct as we are in 2019,
    def test_with_car_with_atn_with_child(self):
        values = OrderedDict([
            ('BASIC', 3217.75),
            ('ATN.INT', 5.00),
            ('ATN.MOB', 0.0),
            ('SALARY', 3222.75),
            ('ONSS', -421.21),
            ('ATN.CAR', 109.92),
            ('GROSSIP', 2911.46),
            ('IP.PART', -804.44),
            ('GROSS', 2107.02),
            ('P.P', -350.53),
            ('ATN.CAR.2', -109.92),
            ('ATN.INT.2', -5.00),
            ('ATN.MOB.2', 0),
            ('M.ONSS', -29.90),
            ('MEAL_V_EMP', -20.71),
            ('REP.FEES', 150.00),
            ('IP', 804.44),
            ('IP.DED', -60.33),
            ('NET', 2485.06),
        ])
        address = self.env['res.partner'].create({
            'name': 'Roger',
        })
        employee = {
            'name': 'Roger3',
            'address_home_id': address.id,
            'marital': 'cohabitant',
            'spouse_fiscal_status': 'with income',
            'spouse_net_revenue': 500,
            'spouse_other_net_revenue': 0,
            'children': 1,
        }
        model = self.env['fleet.vehicle.model'].create({
            'name': 'Opel Model',
            'brand_id': self.env.ref('fleet.brand_opel').id,
        })
        car = {
            'model_id': model.id,
            'driver_id': address.id,
            'acquisition_date': datetime.date(2018, 1, 15),
            'first_contract_date': datetime.date(2018, 1, 15),
            'car_value': 29235.15,
            'fuel_type': 'diesel',
            'co2': 89,
        }
        car_contract = {
            'recurring_cost_amount_depreciated': 562.52,
        }
        contract = {
            'name': 'Contract For Roger',
            'date_start': datetime.date(2019, 1, 1),
            'wage': 3542.63,
            'fuel_card': 150,
            'holidays': 1,
            'meal_voucher_amount': 7.45,
            'representation_fees': 150,
            'internet': 38,
            'mobile': 0,
            'ip_wage_rate': 25,
            'ip': True,
            'resource_calendar_id': self.ref('resource.resource_calendar_std_38h'),
        }
        payslip = {
            'date_from': datetime.date.today().replace(year=2019, month=5, day=1),
            'date_to': datetime.date.today().replace(year=2019, month=5, day=31),
            'struct_id': self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary'),
        }
        holiday = [{
            'name': 'Unpaid Leave Day 1',
            'holiday_status_id': self.leave_type_unpaid.id,
            'request_date_from': datetime.date(2019, 5, 1),
            'request_date_to': datetime.date(2019, 5, 1),
            'request_hour_from': '7',
            'request_hour_to': '18',
        }, {
            'name': 'Unpaid Leave Day 2',
            'holiday_status_id': self.leave_type_unpaid.id,
            'request_date_from': datetime.date(2019, 5, 2),
            'request_date_to': datetime.date(2019, 5, 2),
            'request_hour_from': '7',
            'request_hour_to': '18',
        }, {
            'name': 'Bank Holiday Day 1',
            'holiday_status_id': self.leave_type_bank_holidays.id,
            'request_date_from': datetime.date(2019, 5, 6),
            'request_date_to': datetime.date(2019, 5, 6),
            'request_hour_from': '7',
            'request_hour_to': '18',
        }, {
            'name': 'Bank Holiday Day 2',
            'holiday_status_id': self.leave_type_bank_holidays.id,
            'request_date_from': datetime.date(2019, 5, 7),
            'request_date_to': datetime.date(2019, 5, 7),
            'request_hour_from': '7',
            'request_hour_to': '18',
        }]
        self.case_test(values, employee, payslip_values=payslip, contract_values=contract, holidays_values=holiday, car_values=car, car_contract_values=car_contract)

    # ATN + No leave + IP (2019) + car
    def test_with_car_with_atn_with_car(self):
        values = OrderedDict([
            ('BASIC', 3473.56),
            ('ATN.INT', 5.00),
            ('ATN.MOB', 4.0),
            ('SALARY', 3482.56),
            ('ONSS', -455.17),
            ('ATN.CAR', 109.17),
            ('GROSSIP', 3136.56),
            ('IP.PART', -868.39),
            ('GROSS', 2268.17),
            ('P.P', -465.98),
            ('ATN.CAR.2', -109.17),
            ('ATN.INT.2', -5.00),
            ('ATN.MOB.2', -4.00),
            ('M.ONSS', -32.72),
            ('MEAL_V_EMP', -22.89),
            ('REP.FEES', 150.00),
            ('IP', 868.39),
            ('IP.DED', -65.13),
            ('NET', 2581.67),
        ])
        values = OrderedDict([])
        address = self.env['res.partner'].create({
            'name': 'Roger4',
        })
        employee = {
            'name': 'Roger4',
            'address_home_id': address.id,
            'marital': 'cohabitant',
            'spouse_fiscal_status': 'with income',
            'spouse_net_revenue': 500,
            'spouse_other_net_revenue': 0,
        }
        model = self.env['fleet.vehicle.model'].create({
            'name': 'Opel Model',
            'brand_id': self.env.ref('fleet.brand_opel').id,
        })
        car = {
            'model_id': model.id,
            'driver_id': address.id,
            'acquisition_date': datetime.date(2014, 12, 10),
            'first_contract_date': datetime.date(2014, 12, 10),
            'car_value': 28138.86,
            'fuel_type': 'diesel',
            'co2': 88.00,
        }
        car_contract = {
            'recurring_cost_amount_depreciated': 503.12,
        }
        contract = {
            'name': 'Contract For Roger',
            'date_start': datetime.date(2019, 1, 1),
            'wage': 3470.36,
            'fuel_card': 150,
            'holidays': 1,
            'meal_voucher_amount': 7.45,
            'representation_fees': 150,
            'internet': 38,
            'mobile': 0,
            'ip_wage_rate': 25,
            'ip': True,
            'resource_calendar_id': self.ref('resource.resource_calendar_std_38h'),
        }
        payslip = {
            'date_from': datetime.date.today().replace(year=2019, month=3, day=1),
            'date_to': datetime.date.today().replace(year=2019, month=3, day=31),
            'struct_id': self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary'),
        }
        self.case_test(values, employee, payslip_values=payslip, contract_values=contract, car_values=car, car_contract_values=car_contract)
