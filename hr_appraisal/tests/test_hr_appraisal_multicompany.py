# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
from dateutil.relativedelta import relativedelta

from odoo import fields
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase, new_test_user


class TestHrAppraisal(TransactionCase):
    """ Test used to check that appraisal works in multicompany."""

    def setUp(self):
        super(TestHrAppraisal, self).setUp()
        self.HrEmployee = self.env['hr.employee']
        self.HrAppraisal = self.env['hr.appraisal']
        self.main_company = self.env['res.company'].create({'name': 'main'})
        self.other_company = self.env['res.company'].create({'name': 'other'})
        self.env['ir.config_parameter'].sudo().set_param("hr_appraisal.appraisal_min_period", 6)
        self.env['ir.config_parameter'].sudo().set_param("hr_appraisal.appraisal_max_period", 12)
        self.env['ir.config_parameter'].sudo().set_param("hr_appraisal.appraisal_create_in_advance_days", 8)

        self.user = new_test_user(self.env, login='My super login', groups='hr_appraisal.group_hr_appraisal_user', 
                                  company_ids=[(6, 0, (self.main_company | self.other_company).ids)], company_id=self.main_company.id)

        self.hr_employee = self.HrEmployee.create(dict(
            name="Michael Hawkins",
            user_id=self.user.id,
            last_appraisal_date=date.today() - relativedelta(months=12, days=-12),
            company_id=self.main_company.id,
        ))

        self.hr_employee2 = self.HrEmployee.create(dict(
            user_id=self.user.id,
            company_id=self.other_company.id,
            last_appraisal_date=date.today() - relativedelta(months=12, days=-6),
        ))

    def test_hr_appraisal(self):
        # I create a new Employee with appraisal configuration.
        self.assertEqual(self.hr_employee.periodic_appraisal_created, False)
        self.assertEqual(self.hr_employee2.periodic_appraisal_created, False)

        self.env['hr.employee'].run_employee_appraisal()
        self.assertEqual(self.hr_employee.periodic_appraisal_created, False)
        self.assertEqual(self.hr_employee2.periodic_appraisal_created, True)

        self.assertEqual(self.env['hr.appraisal'].search([('employee_id', '=', self.hr_employee2.id)]).company_id.id, self.other_company.id)
        self.assertEqual(self.user.with_company(company=self.other_company.id).next_appraisal_date, self.hr_employee2.next_appraisal_date)
