# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta
from odoo import models


class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    def _get_base_local_dict(self):
        res = super()._get_base_local_dict()
        res.update({
            'compute_onss_restructuring': compute_onss_restructuring,
        })
        return res

def compute_onss_restructuring(payslip, categories, worked_days, inputs):
    # Source: https://www.onem.be/fr/documentation/feuille-info/t115

    # 1. Grant condition
    # A worker who has been made redundant following a restructuring benefits from a reduction in his personal contributions under certain conditions:
    # - The engagement must take place during the validity period of the reduction card. The reduction card is valid for 6 months, calculated from date to date, following the termination of the employment contract.
    # - The gross monthly reference salary does not exceed
    # o 3.071.90: if the worker is under 30 years of age at the time of entry into service
    # o 4,504.93: if the worker is at least 30 years old at the time of entry into service
    # 2. Amount of reduction
    # Lump sum reduction of € 133.33 per month (full time - full month) in personal social security contributions.
    # If the worker does not work full time for a full month or if he works part time, this amount is reduced proportionally.

    # So the reduction is:
    # 1. Full-time worker: P = (J / D) x 133.33
    # - Full time with full one month benefits: € 133.33

    # Example the worker entered service on 02/01/2021 and worked the whole month
    # - Full time with incomplete services: P = (J / D) x 133.33
    # Example: the worker entered service on February 15 -> (10/20) x 133.33 = € 66.665
    # P = amount of reduction
    # J = the number of worker's days declared with a benefit code 1, 3, 4, 5 and 20 .;
    # D = the maximum number of days of benefits for the month concerned in the work scheme concerned.

    # 2. Part-time worker: P = (H / U) x 133.33
    # Example: the worker starts 02/01/2021 and works 19 hours a week.
    # (76/152) x 133.33 = € 66.665
    # Example: the worker starts 02/15/2021 and works 19 hours a week.
    # (38/155) x 133.33 = 33.335 €

    # P = amount of reduction
    # H = the number of working hours declared with a service code 1, 3, 4, 5 and 20;
    # U = the number of monthly hours corresponding to D.

    # 3. Duration of this reduction
    # The benefit applies to all periods of occupation that fall within the period that:
    # starts to run on the day you start your first occupation during the validity period of the restructuring reduction card;
    # and which ends on the last day of the second quarter following the start date of this first occupation.
    # 4. Formalities to be completed
    # The employer deducts the lump sum from the normal amount of personal contributions when paying the remuneration.
    # The ONEM communicates to the ONSS the data concerning the identification of the worker and the validity date of the card.

    # 5. Point of attention
    # If the worker also benefits from a reduction in his personal contributions for low wages, the cumulation between this reduction and that for restructuring cannot exceed the total amount of personal contributions due.

    # If this is the case, we must first reduce the restructuring reduction.

    # Example:
    # - personal contributions = 200 €
    # - restructuring reduction = € 133.33
    # - low salary reduction = 100 €

    # The total amount of reductions exceeds the contributions due. We must therefore first reduce the restructuring reduction and then the balance of the low wage reduction.

    employee = payslip.dict.contract_id.employee_id
    first_contract_date = employee.first_contract_date
    birthdate = employee.birthday
    age = relativedelta(first_contract_date, birthdate).years
    if age < 30:
        threshold = payslip.rule_parameter('onss_restructuring_before_30')
    else:
        threshold = payslip.rule_parameter('onss_restructuring_after_30')

    salary = payslip.paid_amount
    if salary > threshold:
        return 0

    amount = payslip.rule_parameter('onss_restructuring_amount')

    paid_hours = sum(payslip.worked_days_line_ids.filtered(lambda wd: wd.amount).mapped('number_of_hours'))
    total_hours = sum(payslip.worked_days_line_ids.mapped('number_of_hours'))
    ratio = paid_hours / total_hours if total_hours else 0

    start = first_contract_date
    end = payslip.dict.date_to
    number_of_months = (end.year - start.year) * 12 + (end.month - start.month)
    if 0 <= number_of_months <= 6:
        return amount * ratio
    return 0
