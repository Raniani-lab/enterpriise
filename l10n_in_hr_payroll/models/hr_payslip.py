# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, time
from odoo import api, fields, models, _
from odoo.tools import format_date, date_utils


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    advice_id = fields.Many2one('hr.payroll.advice', string='Bank Advice', copy=False)

    def _get_l10n_in_company_working_time(self, return_hours=False):
        self.ensure_one()
        slip_date_time = datetime.combine(self.date_from, time(12, 0, 0))
        company_work_data = self.company_id.resource_calendar_id.get_work_duration_data(
            date_utils.start_of(slip_date_time, 'month'),
            date_utils.end_of(slip_date_time, 'month'))
        if return_hours:
            return company_work_data['hours']
        return company_work_data['days']

    @api.depends('employee_id', 'struct_id', 'date_from')
    def _compute_name(self):
        super()._compute_name()
        for slip in self.filtered(lambda s: s.country_code == 'IN'):
            lang = slip.employee_id.sudo().address_home_id.lang or self.env.user.lang
            payslip_name = slip.struct_id.payslip_name or _('Salary Slip')
            date = format_date(self.env, slip.date_from, date_format="MMMM y", lang_code=lang)
            if slip.number:
                slip.name = '%(payslip_name)s - %(slip_ref)s - %(dates)s' % {
                    'slip_ref': slip.number,
                    'payslip_name': payslip_name,
                    'dates': date
                }
            else:
                slip.name = '%(payslip_name)s - %(dates)s' % {
                    'payslip_name': payslip_name,
                    'dates': date
                }

    def _get_data_files_to_update(self):
        # Note: file order should be maintained
        return super()._get_data_files_to_update() + [(
            'l10n_in_hr_payroll', [
                'data/hr_salary_rule_category_data.xml',
                'data/hr_payroll_structure_type_data.xml',
                'data/hr_rule_parameters_data.xml',
                'data/salary_rules/hr_salary_rule_ind_emp_data.xml',
                'data/salary_rules/hr_salary_rule_with_pf_data.xml',
                'data/salary_rules/hr_salary_rule_without_pf_data.xml',
                'data/salary_rules/hr_salary_rule_worker_data.xml',
            ])]
