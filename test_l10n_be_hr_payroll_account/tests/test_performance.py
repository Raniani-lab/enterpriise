# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import time

from datetime import date, datetime

from odoo.tests.common import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import users, warmup


@tagged('post_install', '-at_install', 'payroll_perf')
class TestPayslipValidation(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_be.l10nbe_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.EMPLOYEES_COUNT = 100

        cls.company_data['company'].write({
            'country_id': cls.env.ref('base.be').id,
            'l10n_be_company_number': '0477472701',
            'l10n_be_revenue_code': '1293',
            'street': 'Rue du Paradis',
            'zip': '6870',
            'city': 'Eghezee',
            'vat': 'BE0897223670',
            'phone': '061928374',
        })

        cls.company = cls.env.company

        cls.env.user.tz = 'Europe/Brussels'

        cls.date_from = date(2020, 9, 1)
        cls.date_to = date(2020, 9, 30)

        cls.addresses = cls.env['res.partner'].create([{
            'name': "Test Private Address %i" % i,
            'company_id': cls.company.id,
            'type': "private"
        } for i in range(cls.EMPLOYEES_COUNT)])

        cls.resource_calendar_38_hours_per_week = cls.env['resource.calendar'].create([{
            'name': "Test Calendar : 38 Hours/Week",
            'company_id': cls.company.id,
            'hours_per_day': 7.6,
            'tz': "Europe/Brussels",
            'two_weeks_calendar': False,
            'hours_per_week': 38.0,
            'full_time_required_hours': 38.0,
            'attendance_ids': [(5, 0, 0)] + [(0, 0, {
                'name': "Attendance",
                'dayofweek': dayofweek,
                'hour_from': hour_from,
                'hour_to': hour_to,
                'day_period': day_period,
                'work_entry_type_id': cls.env.ref('hr_work_entry.work_entry_type_attendance').id

            }) for dayofweek, hour_from, hour_to, day_period in [
                ("0", 8.0, 12.0, "morning"),
                ("0", 13.0, 16.6, "afternoon"),
                ("1", 8.0, 12.0, "morning"),
                ("1", 13.0, 16.6, "afternoon"),
                ("2", 8.0, 12.0, "morning"),
                ("2", 13.0, 16.6, "afternoon"),
                ("3", 8.0, 12.0, "morning"),
                ("3", 13.0, 16.6, "afternoon"),
                ("4", 8.0, 12.0, "morning"),
                ("4", 13.0, 16.6, "afternoon"),

            ]],
        }])

        cls.employees = cls.env['hr.employee'].create([{
            'name': "Test Employee %i" % i,
            'address_home_id': cls.addresses[i].id,
            'resource_calendar_id': cls.resource_calendar_38_hours_per_week.id,
            'company_id': cls.company.id,
            'km_home_work': 75,
            'niss': '93051822361',
            'certificate': 'master',

        } for i in range(cls.EMPLOYEES_COUNT)])

        cls.brand = cls.env['fleet.vehicle.model.brand'].create([{
            'name': "Test Brand"
        }])

        cls.model = cls.env['fleet.vehicle.model'].create([{
            'name': "Test Model",
            'brand_id': cls.brand.id
        }])

        cls.cars = cls.env['fleet.vehicle'].create([{
            'name': "Test Car %i" % i,
            'license_plate': "TEST %i" % i,
            'driver_id': cls.employees[i].address_home_id.id,
            'company_id': cls.company.id,
            'model_id': cls.model.id,
            'first_contract_date': date(2020, 10, 8),
            'co2': 88.0,
            'car_value': 38000.0,
            'fuel_type': "diesel",
            'acquisition_date': date(2020, 1, 1)
        } for i in range(cls.EMPLOYEES_COUNT)])

        cls.vehicle_contracts = cls.env['fleet.vehicle.log.contract'].create([{
            'name': "Test Contract%s" % i,
            'vehicle_id': cls.cars[i].id,
            'company_id': cls.company.id,
            'start_date': date(2020, 10, 8),
            'expiration_date': date(2021, 10, 8),
            'state': "open",
            'cost_generated': 0.0,
            'cost_frequency': "monthly",
            'recurring_cost_amount_depreciated': 450.0
        } for i in range(cls.EMPLOYEES_COUNT)])

        cls.contracts = cls.env['hr.contract'].create([{
            'name': "Contract For Payslip Test %i" % i,
            'employee_id': cls.employees[i].id,
            'resource_calendar_id': cls.resource_calendar_38_hours_per_week.id,
            'company_id': cls.company.id,
            'date_generated_from': datetime(2020, 9, 1, 0, 0, 0),
            'date_generated_to': datetime(2020, 9, 1, 0, 0, 0),
            'car_id': cls.cars[i].id,
            'structure_type_id': cls.env.ref('hr_contract.structure_type_employee_cp200').id,
            'date_start': date(2018, 12, 31),
            'wage': 2400,
            'wage_on_signature': 2400,
            'state': "open",
            'transport_mode_car': True,
            'fuel_card': 150.0,
            'internet': 38.0,
            'representation_fees': 150.0,
            'mobile': 30.0,
            'meal_voucher_amount': 7.45,
            'eco_checks': 250.0,
            'ip_wage_rate': 25.0,
            'ip': True,
            'rd_percentage': 100,
        } for i in range(cls.EMPLOYEES_COUNT)])

        cls.sick_time_off_type = cls.env['hr.leave.type'].create({
            'name': 'Sick Time Off',
            'allocation_type': 'no',
            'work_entry_type_id': cls.env.ref('hr_work_entry_contract.work_entry_type_sick_leave').id,
        })

        cls.long_term_sick_time_off_type = cls.env['hr.leave.type'].create({
            'name': 'Sick Time Off',
            'allocation_type': 'no',
            'work_entry_type_id': cls.env.ref('l10n_be_hr_payroll.work_entry_type_long_sick').id,
        })

        # Public Holiday (global)
        cls.env['resource.calendar.leaves'].create([{
            'name': "Public Holiday (global)",
            'calendar_id': cls.resource_calendar_38_hours_per_week.id,
            'company_id': cls.company.id,
            'date_from': datetime(2020, 9, 22, 5, 0, 0),
            'date_to': datetime(2020, 9, 22, 23, 0, 0),
            'resource_id': False,
            'time_type': "leave",
            'work_entry_type_id': cls.env.ref('l10n_be_hr_payroll.work_entry_type_bank_holiday').id
        }])

        # Everyone takes a legal leave the same day
        legal_leave = cls.env.ref('hr_work_entry_contract.work_entry_type_legal_leave')
        cls.env['resource.calendar.leaves'].create([{
            'name': "Legal Leave %i" % i,
            'calendar_id': cls.resource_calendar_38_hours_per_week.id,
            'company_id': cls.company.id,
            'resource_id': cls.employees[i].resource_id.id,
            'date_from': datetime(2020, 9, 14, 5, 0, 0),
            'date_to': datetime(2020, 9, 15, 23, 0, 0),
            'time_type': "leave",
            'work_entry_type_id': legal_leave.id,
        } for i in range(cls.EMPLOYEES_COUNT)])

    @users('admin')
    @warmup
    def test_performance_l10n_be_payroll_whole_flow(self):
        self.env.user.company_ids |= self.company

        # Work entry generation
        with self.assertQueryCount(admin=6026):
            # Note 4408 requests are related to the db insertions
            # i.e. self.env['hr.work.entry'].create(vals_list) and thus
            # are not avoidable.
            self.employees.generate_work_entries(self.date_from, self.date_to)

        structure = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary')
        payslips_values = [{
            'name': "Test Payslip %i" % i,
            'employee_id': self.employees[i].id,
            'contract_id': self.contracts[i].id,
            'company_id': self.company.id,
            'vehicle_id': self.cars[i].id,
            'struct_id': structure.id,
            'date_from': self.date_from,
            'date_to': self.date_to,
        } for i in range(self.EMPLOYEES_COUNT)]

        # Payslip Creation
        with self.assertQueryCount(admin=1113):
            start_time = time.time()
            payslips = self.env['hr.payslip'].with_context(allowed_company_ids=self.company.ids).create(payslips_values)
            # --- 0.3016078472137451 seconds ---
            print("--- %s seconds ---" % (time.time() - start_time))

        # Payslip Computation
        with self.assertQueryCount(admin=4348):
            start_time = time.time()
            payslips.compute_sheet()
            # --- 9.298089027404785 seconds ---
            print("--- %s seconds ---" % (time.time() - start_time))

        # Payslip Validation
        with self.assertQueryCount(admin=785):
            start_time = time.time()
            payslips.action_payslip_done()
            # --- 11.888638019561768 seconds ---
            print("--- %s seconds ---" % (time.time() - start_time))

        # 273S Declaration
        declaration_273S = self.env['l10n_be.273s'].with_context(allowed_company_ids=self.company.ids).create({
            'year': self.date_from.year,
            'month': str(self.date_from.month),
        })
        with self.assertQueryCount(admin=7):
            start_time = time.time()
            declaration_273S.action_generate_xml()
            # --- 0.027051687240600586 seconds ---
            print("--- %s seconds ---" % (time.time() - start_time))
        self.assertEqual(declaration_273S.xml_validation_state, 'done', declaration_273S.error_message)

        # 274.XX Declaration
        declaration_274_XX = self.env['l10n_be.274_xx'].with_context(allowed_company_ids=self.company.ids).create({
            'year': self.date_from.year,
            'month': str(self.date_from.month),
        })
        with self.assertQueryCount(admin=100):
            start_time = time.time()
            declaration_274_XX.action_generate_xml()
            # --- 0.40171217918395996 seconds ---
            print("--- %s seconds ---" % (time.time() - start_time))
        self.assertEqual(declaration_274_XX.xml_validation_state, 'done', declaration_274_XX.error_message)
