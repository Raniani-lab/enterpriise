# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from psycopg2 import IntegrityError

from odoo.tests import tagged
from odoo.tools import mute_logger

from .common import TestFsmFlowSaleCommon


@tagged('-at_install', 'post_install', 'fsm_project')
class TestIndustryFsmProject(TestFsmFlowSaleCommon):

    def test_timesheet_product_is_required(self):
        """ Test if timesheet product is required in billable fsm project

            To do this we need to check if an exception is raise when the timesheet
            product is False/None and the project config has this props:
                - allow_billable=True,
                - allow_timesheets=True,
                - is_fsm=True.

            Test Case:
            =========
            Remove the timesheeet product in the billable fsm project and check if an exception is raise.
        """
        with mute_logger('odoo.sql_db'):
            with self.assertRaises(IntegrityError):
                self.fsm_project.write({'timesheet_product_id': False})
                self.fsm_project.flush()
