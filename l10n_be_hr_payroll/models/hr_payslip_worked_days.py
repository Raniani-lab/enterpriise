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

        # For the average of the variable remuneration:
        # Taking into account the full number of months with the employer
        # Variable monthly average remuneration to be divided by 25 and increased by 20% (in 5-day regime).
        # Example: if over 7 months, the variable average monthly remuneration is € 1,212.
        # You add, to the JF, the following amount: 1212/25 = 48.48 + 20% = € 58.17.
        variable_salary_wd = self.filtered(lambda wd: wd.code == 'LEAVE1731')
        for wd in variable_salary_wd:
            amount = wd.payslip_id._get_last_year_average_variable_revenues()
            amount = amount / 25.0
            if not float_compare(wd.payslip_id.contract_id.resource_calendar_id.work_time_rate, 100, precision_digits=2):
                amount *= 1.2
            wd.amount = amount

        paid_be_wds = (monthly_self - credit_time_days - variable_salary_wd).filtered(
            lambda wd: wd.payslip_id.struct_id.country_id.code == "BE" and wd.is_paid)
        if paid_be_wds:
            for be_wd in paid_be_wds:
                payslip = be_wd.payslip_id
                calendar = payslip.contract_id.resource_calendar_id or payslip.employee_id.resource_calendar_id
                hours_per_week = calendar.hours_per_week
                wage = payslip._get_contract_wage() if payslip.contract_id else 0
                # If out of contract, we should use a 'rule of 3' instead of the hourly formula to
                # deduct the real wage
                out_be_wd = be_wd.payslip_id.worked_days_line_ids.filtered(lambda wd: wd.code == 'OUT')
                # after_contract_public_holiday_type = self.env.ref('l10n_be_hr_payroll.work_entry_type_after_contract_public_holiday', raise_if_not_found=False)
                after_contract_public_holiday_wd = be_wd.payslip_id.worked_days_line_ids.filtered(lambda wd: wd.code == 'LEAVE510')
                after_contract_public_holiday_hours = sum(after_contract_public_holiday_wd.mapped('number_of_hours'))
                if out_be_wd:
                    out_hours = sum([wd.number_of_hours for wd in out_be_wd])
                    remaining_hours = sum([wd.number_of_hours for wd in be_wd.payslip_id.worked_days_line_ids - out_be_wd]) - after_contract_public_holiday_hours
                    out_ratio = remaining_hours / (out_hours + remaining_hours)
                else:
                    out_ratio = 1
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
                if be_wd.code == 'OUT':
                    worked_day_amount = 0
                elif be_wd.code == "WORK100":
                    # Case with half days mixed with full days
                    work100_wds = be_wd.payslip_id.worked_days_line_ids.filtered(lambda wd: wd.code == "WORK100")
                    number_of_hours = sum([
                        wd.number_of_hours * (1 if wd.code != 'LEAVE510' else out_ratio)
                        for wd in be_wd.payslip_id.worked_days_line_ids
                        if wd.code not in ['WORK100', 'OUT'] and not wd.is_credit_time])
                    if len(work100_wds) > 1:
                        # In this case, we cannot use the hourly formula since the monthly
                        # salary must always be the same, without having an identical number of
                        # working days

                        # If only presence -> Compute the full days from the hourly formula
                        if len(list(set(be_wd.payslip_id.worked_days_line_ids.mapped('code')))) == 1:
                            ratio = (out_ratio - 3 / (13 * hours_per_week) * number_of_hours) if hours_per_week else 0
                            worked_day_amount = wage * ratio
                            if float_compare(be_wd.number_of_hours, max(work100_wds.mapped('number_of_hours')), 2): # lowest lines
                                ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                                worked_day_amount = worked_day_amount * (1 - ratio)
                            else:  # biggest line
                                ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                                worked_day_amount = worked_day_amount * ratio
                        # Mix of presence/absences - Compute the half days from the hourly formula
                        else:
                            if float_compare(be_wd.number_of_hours, max(work100_wds.mapped('number_of_hours')), 2): # lowest lines
                                ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                                worked_day_amount = wage * ratio
                                # ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                                # worked_day_amount = worked_day_amount * (1 - ratio)
                            else:  # biggest line
                                total_wage = (out_ratio - 3 / (13 * hours_per_week) * number_of_hours) * wage if hours_per_week else 0
                                ratio = 3 / (13 * hours_per_week) * (work100_wds - be_wd).number_of_hours if hours_per_week else 0
                                worked_day_amount = total_wage - wage * ratio
                                # ratio = 3 / (13 * hours_per_week) * be_wd.number_of_hours if hours_per_week else 0
                                # worked_day_amount = worked_day_amount * ratio
                    else:
                        # Classic case : Only 1 WORK100 line
                        ratio = (out_ratio - 3 / (13 * hours_per_week) * number_of_hours) if hours_per_week else 0
                        worked_day_amount = wage * ratio
                else:
                    number_of_hours = be_wd.number_of_hours
                    ratio = 3 / (13 * hours_per_week) * number_of_hours if hours_per_week else 0
                    worked_day_amount = wage * ratio
                    if be_wd.code == 'LEAVE510':
                        worked_day_amount *= out_ratio
                be_wd.amount = worked_day_amount

        super(HrPayslipWorkedDays, self - credit_time_days - paid_be_wds - variable_salary_wd)._compute_amount()
