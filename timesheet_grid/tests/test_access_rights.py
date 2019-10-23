from odoo import fields

from odoo.exceptions import AccessError, UserError

from odoo.tests.common import new_test_user
from odoo.addons.hr_timesheet.tests.test_timesheet import TestCommonTimesheet


class TestAccessRightsTimesheetGrid(TestCommonTimesheet):

    def setUp(self):
        super(TestAccessRightsTimesheetGrid, self).setUp()

        self.user_approver = new_test_user(self.env, 'user_approver', groups='hr_timesheet.group_hr_timesheet_approver')

        self.empl_approver = self.env['hr.employee'].create({
            'name': 'Empl Approver 1',
            'user_id': self.user_approver.id
        })

        self.user_approver2 = new_test_user(self.env, 'user_approver2', groups='hr_timesheet.group_hr_timesheet_approver')

        self.empl_approver2 = self.env['hr.employee'].create({
            'name': 'Empl Approver 2',
            'user_id': self.user_approver2.id
        })

        today = fields.Date.today()

        self.timesheet = self.env['account.analytic.line'].with_user(self.user_approver).create({
            'name': 'My timesheet 1',
            'project_id': self.project_customer.id,
            'task_id': self.task2.id,
            'date': today,
            'unit_amount': 2,
            'employee_id': self.empl_employee.id
        })

        self.user_employee3 = new_test_user(self.env, 'user_employee3', groups='hr_timesheet.group_hr_timesheet_user')

        self.empl_employee3 = self.env['hr.employee'].create({
            'name': 'User Empl Employee 3',
            'user_id': self.user_employee3.id,
            'timesheet_manager_id': self.user_approver.id
        })

        self.timesheet2 = self.env['account.analytic.line'].with_user(self.user_approver).create({
            'name': 'My timesheet 4',
            'project_id': self.project_customer.id,
            'task_id': self.task1.id,
            'date': today,
            'unit_amount': 2,
            'employee_id': self.empl_employee3.id
        })

        self.project_follower = self.env['project.project'].create({
            'name': "Project with visibility set on 'Invited employees'",
            'allow_timesheets': True,
            'privacy_visibility': 'followers',
        })

    def test_timesheet_validation_approver(self):
        """ Check if the approver who has created the timesheet for an employee, can validate the timesheet."""
        timesheet_to_validate = self.timesheet
        validate_action = timesheet_to_validate.with_user(self.user_approver).action_validate_timesheet()

        wizard = self.env['timesheet.validation'].browse(validate_action['res_id'])
        wizard.action_validate()
        self.assertEqual(timesheet_to_validate.validated, True)

    def test_timesheet_validation_by_approver_when_he_is_not_responsible(self):
        """Check if an approver can validate an timesheet, if he isn't the Timesheet Responsible."""
        timesheet_to_validate = self.timesheet2

        # Normally the approver can't validate the timesheet because he doesn't know the project
        # (and he isn't the manager of the employee) and he's not the Timesheet Responsible
        validate_action = timesheet_to_validate.with_user(self.user_approver2).action_validate_timesheet()
        wizard = self.env['timesheet.validation'].with_user(self.user_approver2).browse(validate_action['res_id'])
        wizard.action_validate()
        self.assertEqual(timesheet_to_validate.validated, False)

    def test_timesheet_validation_by_approver_when_he_is_manager_of_employee(self):
        """Check if an approver can validate the timesheets into this project, when he is the manager of the employee."""
        timesheet_to_validate = self.timesheet2
        validate_action = timesheet_to_validate.with_user(self.user_approver).action_validate_timesheet()

        wizard = self.env['timesheet.validation'].browse(validate_action['res_id'])
        wizard.action_validate()
        self.assertEqual(timesheet_to_validate.validated, True)

    def test_show_timesheet_only_if_user_follow_project(self):
        """
            Test if the user cannot see the timesheets into a project when this project with visibility set on 'Invited employee', this user has the access right : 'See my timesheets' and he doesn't follow the project.
        """
        Timesheet = self.env['account.analytic.line']
        Partner = self.env['res.partner']
        partner = Partner.create({
            'name': self.user_manager.name,
            'email': self.user_manager.email
        })

        self.user_manager.write({
            'partner_id': partner.id
        })

        self.project_follower.message_subscribe(partner_ids=[self.user_manager.partner_id.id])

        timesheet = Timesheet.with_user(self.user_manager).create({
            'project_id': self.project_follower.id,
            'name': '/'
        })

        with self.assertRaises(AccessError):
            timesheet.with_user(self.user_employee).read()
            timesheet.with_user(self.user_approver).read()

    def test_employee_update_validated_timesheet(self):
        """
            Check an user with access right 'See own timesheet'
            cannot update his timesheet when it's validated.
        """
        timesheet_to_validate = self.timesheet
        validate_action = timesheet_to_validate.with_user(self.user_approver).action_validate_timesheet()

        wizard = self.env['timesheet.validation'].browse(validate_action['res_id'])
        wizard.action_validate()
        self.assertEqual(self.timesheet.validated, True)

        with self.assertRaises(AccessError):
            self.timesheet.with_user(self.user_employee).write({'unit_amount': 10})

        self.assertEqual(self.timesheet.unit_amount, 2)

    def test_employee_validate_timesheet(self):
        """
            Check an user with the access rule 'See own timesheet'
            cannot validate any timesheets.
        """
        with self.assertRaises(AccessError):
            timesheet_to_validate = self.timesheet
            validate_action = timesheet_to_validate.with_user(self.user_employee).action_validate_timesheet()

            wizard = self.env['timesheet.validation'].browse(validate_action['res_id'])
            wizard.action_validate()

        self.assertEqual(self.timesheet.validated, False)
