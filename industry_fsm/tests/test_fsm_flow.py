# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from odoo import Command
from odoo.tests import new_test_user, tagged, TransactionCase


@tagged('post_install', '-at_install')
class TestFsmFlow(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fsm_project = cls.env['project.project'].create({
            'name': 'Field Service',
            'is_fsm': True,
            'allow_timesheets': True,
        })

        cls.user_employee_timer_timesheet = new_test_user(cls.env, login='marcel', groups='industry_fsm.group_fsm_user')
        cls.user_employee_timer_task = new_test_user(cls.env, login='henri', groups='industry_fsm.group_fsm_user')
        cls.user_employee_mark_as_done = new_test_user(cls.env, login='george', groups='industry_fsm.group_fsm_user')
        cls.employee_timer_timesheet = cls.env['hr.employee'].create({
            'name': 'Employee Timesheet Timer',
            'user_id': cls.user_employee_timer_timesheet.id,
        })
        cls.employee_timer_task = cls.env['hr.employee'].create({
            'name': 'Employee Task Timer',
            'user_id': cls.user_employee_timer_task.id,
        })
        cls.employee_mark_as_done = cls.env['hr.employee'].create({
            'name': 'Employee Mark As Done',
            'user_id': cls.user_employee_mark_as_done.id,
        })
        cls.partner_1 = cls.env['res.partner'].create({'name': 'A Test Partner 1'})
        cls.task = cls.env['project.task'].with_context({'mail_create_nolog': True}).create({
            'name': 'Fsm task',
            'user_ids': [Command.set([cls.user_employee_mark_as_done.id])],
            'project_id': cls.fsm_project.id,
            'partner_id': cls.partner_1.id,
        })

    def test_stop_timers_on_mark_as_done(self):
        self.assertEqual(len(self.task.sudo().timesheet_ids), 0, 'There is no timesheet associated to the task')
        timesheet = self.env['account.analytic.line'].with_user(self.user_employee_timer_timesheet).create({'name': '', 'project_id': self.fsm_project.id})
        timesheet.action_add_time_to_timer(3)
        timesheet.action_change_project_task(self.fsm_project.id, self.task.id)
        self.assertTrue(timesheet.user_timer_id, 'A timer is linked to the timesheet')
        self.assertTrue(timesheet.user_timer_id.is_timer_running, 'The timer linked to the timesheet is running')
        task_with_user_employee_timer_task = self.task.with_user(self.user_employee_timer_task)
        task_with_user_employee_timer_task.action_timer_start()
        self.assertTrue(task_with_user_employee_timer_task.user_timer_id, 'A timer is linked to the task')
        self.assertTrue(task_with_user_employee_timer_task.user_timer_id.is_timer_running, 'The timer linked to the task is running')
        task_with_user_employee_mark_as_done = self.task.with_user(self.user_employee_mark_as_done)
        result = task_with_user_employee_mark_as_done.action_fsm_validate()
        self.assertEqual(result['type'], 'ir.actions.act_window', 'As there are still timers to stop, an action is returned')
        Timer = self.env['timer.timer']
        tasks_running_timer_ids = Timer.search([('res_model', '=', 'project.task'), ('res_id', '=', self.task.id)])
        timesheets_running_timer_ids = Timer.search([('res_model', '=', 'account.analytic.line'), ('res_id', '=', timesheet.id)])
        self.assertEqual(len(timesheets_running_timer_ids), 1, 'There is still a timer linked to the timesheet')
        self.task.invalidate_model(['timesheet_ids'])
        self.assertEqual(len(tasks_running_timer_ids), 1, 'There is still a timer linked to the task')
        wizard = self.env['project.task.stop.timers.wizard'].create({'line_ids': [Command.create({'task_id': self.task.id})]})
        wizard.action_confirm()
        tasks_running_timer_ids = Timer.search([('res_model', '=', 'project.task'), ('res_id', '=', self.task.id)])
        timesheets_running_timer_ids = Timer.search([('res_model', '=', 'account.analytic.line'), ('res_id', '=', timesheet.id)])
        self.assertFalse(timesheets_running_timer_ids, 'There is no more timer linked to the timesheet')
        self.task.invalidate_model(['timesheet_ids'])
        self.assertFalse(tasks_running_timer_ids, 'There is no more timer linked to the task')
        self.assertEqual(len(self.task.sudo().timesheet_ids), 2, 'There are two timesheets')
