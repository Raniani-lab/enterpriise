# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date, datetime

from odoo.addons.hr_work_entry_holidays.tests.common import TestWorkEntryHolidaysBase
from odoo.tests.common import users, warmup


class TestWorkEntryHolidaysPerformance(TestWorkEntryHolidaysBase):

    def setUp(self):
        super().setUp()
        self.jack = self.env['hr.employee'].create({'name': 'Jack'})
        self.employees = self.richard_emp | self.jack

        self.env['hr.contract'].create([{
            'date_start': date(2018, 1, 1),
            'date_end': date(2018, 2, 1),
            'name': 'Contract for %s' % employee.name,
            'wage': 5000.0,
            'state': 'open',
            'employee_id': employee.id,
            'date_generated_from': datetime(2018, 1, 1, 0, 0),
            'date_generated_to': datetime(2018, 1, 1, 0, 0),
        } for employee in self.employees])

    @users('__system__', 'admin')
    @warmup
    def test_performance_leave_validate(self):
        self.richard_emp.generate_work_entries(date(2018, 1, 1), date(2018, 1, 2))
        leave = self.create_leave(datetime(2018, 1, 1, 7, 0), datetime(2018, 1, 1, 18, 0))

        with self.assertQueryCount(__system__=98, admin=172):
            leave.action_validate()
        leave.action_refuse()

    @users('__system__', 'admin')
    @warmup
    def test_performance_leave_write(self):
        leave = self.create_leave(datetime(2018, 1, 1, 7, 0), datetime(2018, 1, 1, 18, 0))

        with self.assertQueryCount(__system__=19, admin=35):
            leave.date_to = datetime(2018, 1, 1, 19, 0)
        leave.action_refuse()

    @users('__system__', 'admin')
    @warmup
    def test_performance_leave_create(self):
        with self.assertQueryCount(__system__=26, admin=102):
            leave = self.create_leave(datetime(2018, 1, 1, 7, 0), datetime(2018, 1, 1, 18, 0))
        leave.action_refuse()

    @users('__system__', 'admin')
    @warmup
    def test_performance_leave_confirm(self):
        leave = self.create_leave(datetime(2018, 1, 1, 7, 0), datetime(2018, 1, 1, 18, 0))
        leave.action_draft()
        with self.assertQueryCount(__system__=20, admin=113):
            leave.action_confirm()
        leave.state = 'cancel'
