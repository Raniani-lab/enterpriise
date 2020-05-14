# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details
from datetime import datetime

from odoo.tests.common import Form
from .common import TestCommonPlanning


class TestPlanningForm(TestCommonPlanning):

    def test_planning_no_employee_no_company(self):
      """ test multi day slot without calendar (no employee nor company) """
      with Form(self.env['planning.slot']) as slot:
        start, end = datetime(2020, 1, 1, 8, 0), datetime(2020, 1, 11, 18, 0)
        slot.start_datetime = start
        slot.end_datetime = end
        slot.employee_id = self.env['hr.employee']
        slot.company_id = self.env['res.company']
        slot.allocated_percentage = 100
        self.assertEqual(slot.allocated_hours, (end - start).total_seconds() / (60 * 60))
