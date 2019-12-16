# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
from dateutil.relativedelta import relativedelta

from odoo import fields
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase


class TestHrAppraisal(TransactionCase):
    """ Test used to check that when doing appraisal creation."""

    def setUp(self):
        super(TestHrAppraisal, self).setUp()
        self.HrEmployee = self.env['hr.employee']
        self.HrAppraisal = self.env['hr.appraisal']
        self.main_company = self.env.ref('base.main_company')

        self.dep_rd = self.env['hr.department'].create({'name': 'RD Test'})
        self.manager = self.env['hr.employee'].create({'name': 'Manager Test', 'department_id': self.dep_rd.id})
        self.job = self.env['hr.job'].create({'name': 'Developer Test', 'department_id': self.dep_rd.id})
        self.colleague = self.env['hr.employee'].create({'name': 'Colleague Test', 'department_id': self.dep_rd.id})

        group = self.env.ref('hr_appraisal.group_hr_appraisal_user').id
        self.user = self.env['res.users'].create({
            'name': 'Michael Hawkins',
            'login': 'test',
            'groups_id': [(6, 0, [group])],
        })

        self.hr_employee = self.HrEmployee.create(dict(
            name="Michael Hawkins",
            user_id=self.user.id,
            department_id=self.dep_rd.id,
            parent_id=self.manager.id,
            job_id=self.job.id,
            work_location="Grand-Rosière",
            work_phone="+3281813700",
            work_email='michael@odoo.com',
            appraisal_manager_ids=[self.manager.id],
            appraisal_colleagues_ids=[self.colleague.id],
            last_appraisal_date=date.today() + relativedelta(months=-12, days=5)
        ))

        self.env['ir.config_parameter'].sudo().set_param("hr_appraisal.appraisal_min_period", 6)
        self.env['ir.config_parameter'].sudo().set_param("hr_appraisal.appraisal_max_period", 12)

    def test_hr_appraisal(self):
        # I create a new Employee with appraisal configuration.
        hr_employee2 = self.HrEmployee.create(dict(
            name="John Doe",
            next_appraisal_date=date.today() + relativedelta(days=6)
        ))

        # I run the scheduler
        self.HrEmployee.run_employee_appraisal()  # cronjob

        # I check whether new appraisal is created for above employee or not
        appraisals = self.HrAppraisal.search([('employee_id', '=', hr_employee2.id)])
        self.assertTrue(appraisals, "Appraisal not created")

        # I start the appraisal process by click on "Start Appraisal" button.
        appraisals.button_send_appraisal()

        # I check that state is "Appraisal Sent".
        self.assertEqual(appraisals.state, 'pending', "appraisal should be 'Appraisal Sent' state")
        # I check that "Final Interview Date" is set or not.
        appraisals.write({'date_final_interview': str(date.today() + relativedelta(months=1))})
        self.assertTrue(appraisals.date_final_interview, "Interview Date is not created")
        # I check whether final interview meeting is created or not
        appraisals = self.HrAppraisal.search([('employee_id', '=', hr_employee2.id)])
        self.assertTrue(appraisals.meeting_id, "Meeting is not created")
        # I close this Apprisal
        appraisals.write({'state': 'done'})
        # I check that state of Appraisal is done.
        self.assertEqual(appraisals.state, 'done', "Appraisal should be in done state")

    def test_new_employee_next_appraisal_date_generation(self):
        hr_employee3 = self.HrEmployee.create(dict(
            name="Jane Doe",
        ))

        dateAppraisal = date.today() + relativedelta(months=12)
        self.assertEqual(hr_employee3.next_appraisal_date, dateAppraisal)

    def test_request_appraisal_too_early(self):
        self.HrAppraisal.create({
            'employee_id': self.hr_employee.id,
            'date_close': date.today() + relativedelta(months=1),
        })
        with self.assertRaises(ValidationError):
            self.HrAppraisal.with_user(self.user.id).create({
                'employee_id': self.hr_employee.id,
                'date_close': date.today() + relativedelta(months=2),
            })

    def test_request_appraisal_too_early_2(self):
        # force date in the past
        query = """
            UPDATE hr_employee
            SET next_appraisal_date=%s
            WHERE id=%s;
        """
        self.env.cr.execute(query, (date.today() + relativedelta(months=11), self.hr_employee.id))
        self.HrEmployee.invalidate_cache(['next_appraisal_date'])

        self.hr_employee.periodic_appraisal_created = True

        self.HrEmployee.run_employee_appraisal()  # cronjob
        self.assertTrue(self.hr_employee.periodic_appraisal_created, False)
        self.assertEqual(self.hr_employee.next_appraisal_date, date.today() + relativedelta(months=11))
