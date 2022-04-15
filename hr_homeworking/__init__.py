# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import fields, api, SUPERUSER_ID

from . import models
from . import wizard


def _initialize_homeworking_locations(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})

    # Create a default homeworking schedule for every department that doesn't have one.
    cr.execute("""
        WITH undefined_location AS (
            SELECT
                loc.id
            FROM homeworking_location loc
            WHERE loc.location_type = 'unspecified'
            LIMIT 1
        )
        INSERT INTO
            homeworking_schedule (
                department_id,
                company_id,
                date_start,
                monday_location_id,
                tuesday_location_id,
                wednesday_location_id,
                thursday_location_id,
                friday_location_id,
                saturday_location_id,
                sunday_location_id
            )
        SELECT distinct
            department.id,
            department.company_id,
            current_date,
            loc.id,
            loc.id,
            loc.id,
            loc.id,
            loc.id,
            loc.id,
            loc.id
        FROM      hr_department department
        JOIN      undefined_location loc
        on        loc.id > 0
        LEFT JOIN homeworking_schedule schedule
        ON        schedule.department_id = department.id
        AND		  (schedule.date_end >= current_date or schedule.date_end is null)
        WHERE     schedule.id is null
    """)

    # Generate the homeworking entries for all employees
    env['homeworking.entry']._cron_generate_homeworking_entries()
