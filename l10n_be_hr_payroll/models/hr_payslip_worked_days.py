# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.tools.float_utils import float_compare


class HrPayslipWorkedDays(models.Model):
    _inherit = 'hr.payslip.worked_days'

    is_credit_time = fields.Boolean(string='Credit Time')

    @api.depends('is_paid', 'is_credit_time', 'number_of_hours', 'payslip_id', 'payslip_id.normal_wage', 'payslip_id.sum_worked_hours')
    def _compute_amount(self):
        monthly_self = self.filtered(lambda wd: wd.payslip_id.wage_type == "monthly")

        credit_time_days = monthly_self.filtered(lambda worked_day: worked_day.is_credit_time)
        credit_time_days.update({'amount': 0})

        belgium = self.env.ref('base.be')
        paid_be_wds = (monthly_self - credit_time_days).filtered(
            lambda wd: wd.payslip_id.struct_id.country_id == belgium and wd.is_paid)
        if paid_be_wds:
            for be_wd in paid_be_wds:
                payslip = be_wd.payslip_id
                calendar = payslip.contract_id.resource_calendar_id or payslip.employee_id.resource_calendar_id
                hours_per_week = calendar.hours_per_week
                wage = payslip._get_contract_wage() if payslip.contract_id else 0
                ####################################################################################
                #  Example:
                #  Note: 3/13/38) * wage : hourly wage, if 13th months and 38 hours/week calendar
                #
                #  CODE     :   number_of_hours    :    Amount
                #  WORK100  :      130 hours       : (1 - 3/13/38 * (15 + 30)) * wage
                #  PAID     :      30 hours        : 3/13/38 * (15 + 30)) * wage
                #  UNPAID   :      15 hours        : 0
                #
                #  TOTAL PAID : WORK100 + PAID + UNPAID = (1 - 3/13/38 * 15 ) * wage
                ####################################################################################
                if be_wd.code == "WORK100":
                    # Case with half days mixed with full days
                    work100_wds = be_wd.payslip_id.worked_days_line_ids.filtered(lambda wd: wd.code == "WORK100")
                    number_of_hours = sum([wd.number_of_hours for wd in be_wd.payslip_id.worked_days_line_ids if wd.code != "WORK100" and not wd.is_credit_time])
                    ratio = (1 - 3 / (13 * hours_per_week) * number_of_hours) if hours_per_week else 0
                    worked_day_amount = wage * ratio
                    if len(work100_wds) > 1:
                        # In this case, we cannot use the hourly formula since the monthly
                        # salary must always be the same, without having an identical number of
                        # working days
                        if float_compare(be_wd.number_of_hours, max(work100_wds.mapped('number_of_hours')), 2): # lowest lines
                            ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                            worked_day_amount = worked_day_amount * (1 - ratio)
                        else:  # biggest line
                            ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                            worked_day_amount = worked_day_amount * ratio
                else:
                    number_of_hours = be_wd.number_of_hours
                    ratio = 3 / (13 * hours_per_week) * number_of_hours if hours_per_week else 0
                    worked_day_amount = wage * ratio
                be_wd.amount = worked_day_amount

        super(HrPayslipWorkedDays, self - credit_time_days - paid_be_wds)._compute_amount()
