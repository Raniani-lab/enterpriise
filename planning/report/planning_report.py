# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import fields, models


class PlanningReport(models.Model):
    _name = "planning.slot.report.analysis"
    _description = "Planning Statistics"
    _auto = False
    _rec_name = 'entry_date'
    _order = 'entry_date desc'

    entry_date = fields.Date('Date', readonly=True)
    employee_id = fields.Many2one('hr.employee', 'Employee', readonly=True)
    role_id = fields.Many2one('planning.role', string='Role', readonly=True)
    number_hours = fields.Float("Allocated Hours", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE or REPLACE VIEW %s as (
                (
                    SELECT
                        P.id AS id,
                        d::date AS entry_date,
                        P.employee_id AS employee_id,
                        P.role_id AS role_id,
                        P.allocated_hours / NULLIF(P.working_days_count, 0) AS number_hours
                    FROM generate_series(
                        (SELECT min(start_datetime) FROM planning_slot)::date,
                        (SELECT max(end_datetime) FROM planning_slot)::date,
                        '1 day'::interval
                    ) d
                        LEFT JOIN planning_slot P ON d.date >= P.start_datetime::date AND d.date <= end_datetime::date
                        LEFT JOIN hr_employee E ON P.employee_id = E.id
                        LEFT JOIN resource_resource R ON E.resource_id = R.id
                    WHERE
                        EXTRACT(ISODOW FROM d.date) IN (
                            SELECT A.dayofweek::integer+1 FROM resource_calendar_attendance A WHERE A.calendar_id = R.calendar_id
                        )
                )
            )
        """ % (self._table,))
