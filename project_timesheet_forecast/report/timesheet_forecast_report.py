# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import sql

from odoo import api, fields, models, tools

class TimesheetForecastReport(models.Model):

    _name = "project.timesheet.forecast.report.analysis"
    _description = "Timesheet & Planning Statistics"
    _auto = False
    _rec_name = 'entry_date'
    _order = 'entry_date desc'

    entry_date = fields.Date('Date', readonly=True)
    employee_id = fields.Many2one('hr.employee', 'Employee', readonly=True)
    company_id = fields.Many2one('res.company', string="Company", readonly=True)
    task_id = fields.Many2one('project.task', string='Task', readonly=True)
    project_id = fields.Many2one('project.project', string='Project', readonly=True)
    line_type = fields.Selection([('forecast', 'Planning'), ('timesheet', 'Timesheet')], string='Type', readonly=True)
    effective_hours = fields.Float('Effective Hours', readonly=True)
    planned_hours = fields.Float('Planned Hours', readonly=True)
    difference = fields.Float('Remaining Hours', readonly=True)
    user_id = fields.Many2one('res.users', string='Assigned to', readonly=True)
    is_published = fields.Boolean(readonly=True)

    @api.model
    def _select(self):
        select_str = """
            SELECT
                d::date AS entry_date,
                F.employee_id AS employee_id,
                E.company_id AS company_id,
                F.task_id AS task_id,
                F.project_id AS project_id,
                F.user_id AS user_id,
                0.0 AS effective_hours,
                F.allocated_hours / NULLIF(F.working_days_count, 0) AS planned_hours,
                F.allocated_hours / NULLIF(F.working_days_count, 0) AS difference,
                'forecast' AS line_type,
                F.id AS id,
                CASE WHEN F.state = 'published' THEN TRUE ELSE FALSE END AS is_published
        """
        return select_str

    @api.model
    def _from(self):
        from_str = """
            FROM generate_series(
                (SELECT min(start_datetime) FROM planning_slot)::date,
                (SELECT max(end_datetime) FROM planning_slot)::date,
                '1 day'::interval
            ) d
                LEFT JOIN planning_slot F ON d::date >= F.start_datetime::date AND d::date <= F.end_datetime::date
                LEFT JOIN hr_employee E ON F.employee_id = E.id
                LEFT JOIN resource_resource R ON E.resource_id = R.id
        """
        return from_str

    @api.model
    def _where(self):
        where_str = """
            WHERE
                EXTRACT(ISODOW FROM d.date) IN (
                    SELECT A.dayofweek::integer+1 FROM resource_calendar_attendance A WHERE A.calendar_id = R.calendar_id
                )
        """
        return where_str

    @api.model
    def _select_union(self):
        select_str = """
            SELECT
                A.date AS entry_date,
                E.id AS employee_id,
                E.company_id AS company_id,
                A.task_id AS task_id,
                A.project_id AS project_id,
                A.user_id AS user_id,
                A.unit_amount / UOM.factor * HOUR_UOM.factor AS effective_hours,
                0.0 AS planned_hours,
                -A.unit_amount / UOM.factor * HOUR_UOM.factor AS difference,
                'timesheet' AS line_type,
                -A.id AS id,
                TRUE AS is_published
        """
        return select_str

    @api.model
    def _from_union(self):
        from_str = """
            FROM account_analytic_line A
                LEFT JOIN hr_employee E ON A.employee_id = E.id
                LEFT JOIN uom_uom UOM ON A.product_uom_id = UOM.id,
                (
                    SELECT
                        U.factor
                    FROM uom_uom U
                    WHERE U.id = %s
                ) HOUR_UOM
        """ % (self.env.ref('uom.product_uom_hour').id)
        return from_str

    @api.model
    def _where_union(self):
        where_str = """
            WHERE A.project_id IS NOT NULL
        """
        return where_str

    def init(self):
        query = "(%s %s %s) UNION (%s %s %s)" % (
            self._select(),
            self._from(),
            self._where(),
            self._select_union(),
            self._from_union(),
            self._where_union()
        )

        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute(
            sql.SQL("CREATE or REPLACE VIEW {} as ({})").format(
                sql.Identifier(self._table),
                sql.SQL(query)
            ))

    @api.model
    def _fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        result = super(TimesheetForecastReport, self)._fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        if view_type in ['pivot', 'graph'] and self.env.company.timesheet_encode_uom_id == self.env.ref('uom.product_uom_day'):
            self.env['account.analytic.line']._apply_time_label(result['arch'], related_model=self._name)
        return result
