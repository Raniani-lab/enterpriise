# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import api, fields, models


class HrContractEmployeeReport(models.Model):
    _name = "hr.contract.employee.report"
    _description = "Contract and Employee Analysis Report"
    _auto = False
    _rec_name = 'date'

    contract_id = fields.Many2one('hr.contract', 'Contract', readonly=True)
    employee_id = fields.Many2one('hr.employee', 'Employee', readonly=True)
    company_id = fields.Many2one('res.company', 'Company', readonly=True)
    department_id = fields.Many2one('hr.department', 'Department', readonly=True)

    count_employee_exit = fields.Integer('# Departure Employee', readonly=True)
    count_new_employee = fields.Integer('# New Employees', readonly=True)
    age_sum = fields.Float('Duration Contract', group_operator="sum", readonly=True)

    wage = fields.Float('Wage', group_operator="avg", readonly=True)

    date = fields.Date('Date', readonly=True)
    date_end_contract = fields.Date('Date Last Contract Ended', group_operator="max", readonly=True)

    departure_reason = fields.Selection([
        ('fired', 'Fired'),
        ('resigned', 'Resigned'),
        ('retired', 'Retired')
    ], string="Departure Reason", readonly=True)


    def _query(self, fields='', from_clause='', outer=''):
        select_ = '''
            c.id as id,
            c.id as contract_id,
            e.id as employee_id,
            e.company_id as company_id,
            e.departure_reason as departure_reason,
            e.department_id as department_id,
            c.wage AS wage,
            CASE WHEN serie = start.contract_start THEN 1 ELSE 0 END as count_new_employee,
            CASE WHEN date_part('month', exit.contract_end) = date_part('month', serie) AND date_part('year', exit.contract_end) = date_part('year', serie) THEN 1 ELSE 0 END as count_employee_exit,
            date_start,
            date_end,
            exit.contract_end as date_end_contract,
            start.contract_start,
            CASE
                WHEN date_part('month', date_start) = date_part('month', serie) AND date_part('year', date_start) = date_part('year', serie)
                    THEN (31 - LEAST(date_part('day', date_start), 30)) / 30
                WHEN date_end IS NULL THEN 1
                WHEN date_part('month', date_end) = date_part('month', serie) AND date_part('year', date_end) = date_part('year', serie)
                    THEN (LEAST(date_part('day', date_end), 30) / 30)
                ELSE 1 END as age_sum,
            serie::DATE as date
            %s
        ''' % fields

        from_ = """
                (SELECT age(COALESCE(date_end, current_date), date_start) as age, * FROM hr_contract WHERE state != 'cancel') c
                LEFT JOIN hr_employee e ON (e.id = c.employee_id)
                LEFT JOIN (
                    SELECT employee_id, contract_end
                    FROM (SELECT employee_id, MAX(COALESCE(date_end, current_date)) as contract_end FROM hr_contract WHERE state != 'cancel' GROUP BY employee_id) c_end
                    WHERE c_end.contract_end < current_date) exit on (exit.employee_id = c.employee_id)
                LEFT JOIN (
                    SELECT employee_id, MIN(date_start) as contract_start
                    FROM hr_contract WHERE state != 'cancel'
                    GROUP BY employee_id) start on (start.employee_id = c.employee_id)
                 %s
                CROSS JOIN generate_series(c.date_start, COALESCE(c.date_end, current_date + interval '1 year'), interval '1 month') serie
        """ % from_clause

        return '(SELECT * %s FROM (SELECT %s FROM %s) in_query)' % (outer, select_, from_)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (%s)""" % (self._table, self._query()))
