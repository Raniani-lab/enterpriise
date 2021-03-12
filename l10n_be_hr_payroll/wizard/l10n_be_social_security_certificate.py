# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class L10nBeSocialSecurityCertificate(models.TransientModel):
    _name = 'l10n.be.social.security.certificate'
    _description = 'Belgium: Social Security Certificate'

    @api.model
    def default_get(self, field_list=None):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        return super().default_get(field_list)

    date_from = fields.Date(default=lambda s: fields.Date.today() + relativedelta(day=1, month=1, years=-1))
    date_to = fields.Date(default=lambda s: fields.Date.today() + relativedelta(day=31, month=12, years=-1))
    state = fields.Selection([
        ('draft', 'Draft'),
        ('done', 'Done'),
    ], default='draft')
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    social_security_sheet = fields.Binary('Social Security Certificate', readonly=True, attachment=False)
    social_security_filename = fields.Char()

    def print_report(self):
        self.ensure_one()
        report_data = {}

        date_from = self.date_from + relativedelta(day=1)
        date_to = self.date_to + relativedelta(day=31)

        monthly_pay = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_salary')
        termination_pay = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_termination_fees')
        holiday_pay_n = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_departure_n_holidays')
        holiday_pay_n1 = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_departure_n1_holidays')
        double_pay = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_double_holiday')
        thirteen_pay = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_thirteen_month')
        student_pay = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_student_regular_pay')
        structures = monthly_pay + termination_pay + holiday_pay_n + holiday_pay_n1 + double_pay + thirteen_pay + student_pay

        all_payslips = self.env['hr.payslip'].search([
            ('state', 'in', ['done', 'paid']),
            ('struct_id', 'in', structures.ids),
            ('company_id', '=', self.company_id.id),
            ('date_from', '>=', date_from),
            ('date_to', '<=', date_to)])

        monthly_slips = all_payslips.filtered(lambda p: p.struct_id == monthly_pay)
        termination_slips = all_payslips.filtered(lambda p: p.struct_id == termination_pay)
        holiday_slips = all_payslips.filtered(lambda p: p.struct_id in [holiday_pay_n, holiday_pay_n1])
        double_slips = all_payslips.filtered(lambda p: p.struct_id == double_pay)
        thirteen_slips = all_payslips.filtered(lambda p: p.struct_id == thirteen_pay)
        student_slips = all_payslips.filtered(lambda p: p.struct_id == student_pay)

        gross_before_onss = sum(p._get_salary_line_total('BASIC') + p._get_salary_line_total('COMMISSION') for p in monthly_slips)
        atn = sum(p._get_salary_line_total('ATN.INT') + p._get_salary_line_total('ATN.MOB') + p._get_salary_line_total('ATN.LAP') for p in monthly_slips)
        termination_fees = sum(p._get_salary_line_total('BASIC') for p in termination_slips)
        student = sum(p._get_salary_line_total('BASIC') for p in student_slips)
        thirteen_month = sum(p._get_salary_line_total('BASIC') for p in thirteen_slips)
        double_pay = sum(p._get_salary_line_total('D.P') + p._get_salary_line_total('EU.LEAVE.DEDUC') for p in double_slips)
        total_gross_before_onss = gross_before_onss + atn + termination_fees + student + thirteen_month + double_pay
        atn_without_onss = sum(p._get_salary_line_total('ATN.CAR') for p in monthly_slips)
        early_holiday_pay = sum(p._get_salary_line_total('PAY_SIMPLE') for p in holiday_slips)
        holiday_pay_supplement = sum(p._get_salary_line_total('PAY DOUBLE') for p in holiday_slips)
        other_exempted_amount = sum(p._get_salary_line_total('PAY DOUBLE COMPLEMENTARY') for p in holiday_slips)
        thirteen_month_gross = sum(p._get_salary_line_total('SALARY') for p in thirteen_slips)
        double_gross = sum(p._get_salary_line_total('SALARY') for p in double_slips)
        subtotal_gross = total_gross_before_onss + atn_without_onss + early_holiday_pay + holiday_pay_supplement + other_exempted_amount + student + thirteen_month_gross + double_gross
        onss_cotisation = sum(p._get_salary_line_total('ONSSTOTAL') for p in monthly_slips)
        onss_cotisation_termination_fees = sum(p._get_salary_line_total('ONSSTOTAL') for p in termination_slips)
        anticipated_holiday_pay_retenue = sum(p._get_salary_line_total('ONSS1') for p in holiday_slips)
        holiday_pay_supplement_retenue = sum(p._get_salary_line_total('ONSS2') for p in holiday_slips)
        onss_thirteen_month = sum(p._get_salary_line_total('ONSS') for p in thirteen_slips)
        onss_double = sum(p._get_salary_line_total('ONSS') for p in double_slips)
        onss_student = sum(p._get_salary_line_total('ONSS') for p in student_slips)
        representation_fees = sum(p._get_salary_line_total('REP.FEES') for p in monthly_slips)
        private_car = sum(p._get_salary_line_total('CAR.PRIV') for p in monthly_slips + student_slips)
        atn_car = atn_without_onss
        withholding_taxes = sum(p._get_salary_line_total('P.P') for p in all_payslips)
        misc_onss = sum(p._get_salary_line_total('M.ONSS') for p in all_payslips)
        salary_attachment = sum(p._get_salary_line_total('ATTACH_SALARY') for p in all_payslips)
        atn_deduction = sum(
            p._get_salary_line_total('ATN.CAR.2') + p._get_salary_line_total('ATN.MOB.2') + p._get_salary_line_total('ATN.INT.2') + p._get_salary_line_total('ATN.LAP.2') for p in monthly_slips)
        meal_voucher_employee = sum(p._get_salary_line_total('MEAL_V_EMP') for p in monthly_slips + student_slips)
        net_third_party = sum(p._get_salary_line_total('IMPULSION25') + p._get_salary_line_total('IMPULSION12') for p in monthly_slips)
        salary_assignment = sum(p._get_salary_line_total('ASSIG_SALARY') for p in all_payslips)
        salary_advance = sum(p._get_salary_line_total('ADVANCE') for p in monthly_slips)
        net = sum(p._get_salary_line_quantity('NET') for p in all_payslips)
        total_net = net + salary_advance
        # YTI TODO: Pliz
        emp_onss = 0
        emp_termination_onss = 0
        closure_fund = 0
        charges_redistribution = 0
        if 'vehicle_id' in self.env['hr.payslip']:
            co2_fees = sum(p.vehicle_id.with_context(co2_fee_date=p.date_from)._get_co2_fee(p.vehicle_id.co2, p.vehicle_id.fuel_type) for p in monthly_slips)
        else:
            co2_fees = 0
        structural_reductions = 0
        meal_voucher_employer = sum(p._get_salary_line_quantity('MEAL_V_EMP') * p.contract_id.meal_voucher_paid_by_employer for p in monthly_slips + student_slips)
        withholding_taxes_deduction = sum(p._get_salary_line_total('P.P.DED') for p in monthly_slips)
        total_employer_cost = emp_onss + emp_termination_onss + closure_fund + charges_redistribution + co2_fees + structural_reductions + meal_voucher_employer + withholding_taxes_deduction
        holiday_pay_provision = 0

        wizard_274 = self.env['l10n.be.withholding.tax.exemption'].create({
            'date_start': date_from,
            'date_end': date_to,
        })
        withholding_taxes_exemption = wizard_274.deducted_amount_32 + wizard_274.deducted_amount_33 + wizard_274.deducted_amount_34
        withholding_taxes_capping = -wizard_274.capped_amount_34

        # YTI TODO: Include double holiday - 13th month
        report_data.update({
            'gross_before_onss': gross_before_onss,
            'atn': atn,
            'termination_fees': termination_fees,
            'student': student,
            'thirteen_month': thirteen_month,
            'double_pay': double_pay,
            'total_gross_before_onss': total_gross_before_onss,
            'atn_without_onss': atn_without_onss,
            'early_holiday_pay': early_holiday_pay,
            'holiday_pay_supplement': holiday_pay_supplement,
            'other_exempted_amount': other_exempted_amount,
            'thirteen_month_gross': thirteen_month_gross,
            'double_gross': double_gross,
            'subtotal_gross': subtotal_gross,
            'onss_cotisation': onss_cotisation,
            'onss_cotisation_termination_fees': onss_cotisation_termination_fees,
            'anticipated_holiday_pay_retenue': anticipated_holiday_pay_retenue,
            'holiday_pay_supplement_retenue': holiday_pay_supplement_retenue,
            'onss_student': onss_student,
            'onss_thirteen_month': onss_thirteen_month,
            'onss_double': onss_double,
            'taxable_adaptation': 0,
            'taxable_325': 0,
            'gift_in_kind': 0,
            'representation_fees': representation_fees,
            'private_car': private_car,
            'atn_car': atn_car,
            'withholding_taxes': withholding_taxes,
            'misc_onss': misc_onss,
            'salary_attachment': salary_attachment,
            'atn_deduction': atn_deduction,
            'meal_voucher_employee': meal_voucher_employee,
            'net_third_party': net_third_party,
            'salary_assignment': salary_assignment,
            'salary_advance': salary_advance,
            'net': net,
            'total_net': total_net,
            'emp_onss': emp_onss,
            'emp_termination_onss': emp_termination_onss,
            'closure_fund': closure_fund,
            'charges_redistribution': charges_redistribution,
            'co2_fees': co2_fees,
            'structural_reductions': structural_reductions,
            'meal_voucher_employer': meal_voucher_employer,
            'withholding_taxes_deduction': withholding_taxes_deduction,
            'total_employer_cost': total_employer_cost,
            'holiday_pay_provision': holiday_pay_provision,
            'withholding_taxes_exemption': withholding_taxes_exemption,
            'withholding_taxes_capping': withholding_taxes_capping,
        })


        filename = 'SocialBalance-%s-%s.pdf' % (self.date_from.strftime("%d%B%Y"), self.date_to.strftime("%d%B%Y"))
        export_274_sheet_pdf, dummy = self.env.ref('l10n_be_hr_payroll.action_report_social_security_certificate').sudo()._render_qweb_pdf(res_ids=self.ids, data=report_data)

        self.social_security_filename = filename
        self.social_security_sheet = base64.encodebytes(export_274_sheet_pdf)

        self.state = 'done'
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def action_validate(self):
        self.ensure_one()
        if self.social_security_sheet:
            self._post_process_generated_file(self.social_security_sheet, self.social_security_filename)
        return {'type': 'ir.actions.act_window_close'}

    # To be overwritten in documents_l10n_be_hr_payroll to create a document.document
    def _post_process_generated_file(self, data, filename):
        return
