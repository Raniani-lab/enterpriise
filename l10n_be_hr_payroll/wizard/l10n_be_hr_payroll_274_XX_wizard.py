# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import io

from collections import defaultdict
from dateutil.relativedelta import relativedelta
from lxml import etree

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.modules.module import get_resource_path
from odoo.tools.misc import xlsxwriter


class L10nBeHrPayrollWithholdingTaxExemption(models.TransientModel):
    _name = 'l10n.be.withholding.tax.exemption'
    _description = '274.XX Sheets'

    @api.model
    def default_get(self, field_list=None):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        return super().default_get(field_list)

    date_start = fields.Date(
        'Start Period', required=True,
        default=lambda self: fields.Date.today() + relativedelta(day=1),
        help="Start date of the period to consider.")
    date_end = fields.Date(
        'End Period', required=True,
        default=lambda self: fields.Date.today() + relativedelta(day=31),
        help="End date of the period to consider.")
    line_ids = fields.One2many(
        'l10n.be.withholding.tax.exemption.line', 'wizard_id',
        compute='_compute_line_ids', store=True, readonly=False, compute_sudo=True)
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('waiting', 'Waiting'),
        ('done', 'Done')], default='draft')
    sheet_274_10 = fields.Binary('274.10 Sheet', readonly=True, attachment=False)
    sheet_274_10_filename = fields.Char()
    pp_amount = fields.Monetary("Withholding Taxes", compute='_compute_line_ids', compute_sudo=True)
    pp_amount_32 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    pp_amount_33 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    pp_amount_34 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    taxable_amount = fields.Monetary("Taxable Amount", compute='_compute_line_ids', compute_sudo=True)
    taxable_amount_32 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    taxable_amount_33 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    taxable_amount_34 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    deducted_amount = fields.Monetary("Exempted Amount", compute='_compute_line_ids', compute_sudo=True)
    deducted_amount_32 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    deducted_amount_33 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    deducted_amount_34 = fields.Monetary(compute='_compute_line_ids', compute_sudo=True)
    capped_amount_34 = fields.Monetary("Capped Amount", compute='_compute_line_ids', compute_sudo=True)
    xml_file = fields.Binary(string="XML file")
    xml_filename = fields.Char()
    xml_validation_state = fields.Selection([
        ('normal', "N/A"),
        ('done', "Valid"),
        ('invalid', "Invalid"),
    ], default='normal', compute='_compute_validation_state', store=True)
    error_message = fields.Char(store=True, compute='_compute_validation_state')
    payment_reference = fields.Char('Withholding Tax Payment Reference')
    xls_file = fields.Binary(string="XLS file")
    xls_filename = fields.Char()

    @api.depends('xml_file')
    def _compute_validation_state(self):
        xsd_schema_file_path = get_resource_path(
            'l10n_be_hr_payroll',
            'data',
            'finprof.xsd',
        )
        xsd_root = etree.parse(xsd_schema_file_path)
        schema = etree.XMLSchema(xsd_root)
        for wizard in self:
            if not wizard.xml_file:
                wizard.xml_validation_state = 'normal'
                wizard.error_message = False
            else:
                xml_root = etree.fromstring(base64.b64decode(wizard.xml_file))
                try:
                    schema.assertValid(xml_root)
                    wizard.xml_validation_state = 'done'
                except etree.DocumentInvalid as err:
                    wizard.xml_validation_state = 'invalid'
                    wizard.error_message = str(err)

    def _get_valid_payslips(self):
        return self.env['hr.payslip'].search([
            ('state', '=', 'paid'),
            ('company_id', '=', self.company_id.id),
            ('date_from', '>=', self.date_start),
            ('date_to', '<=', self.date_end)])

    @api.constrains('company_id')
    def _check_l10n_be_company_number(self):
        for company in self.mapped('company_id'):
            if not company.l10n_be_company_number or not company.l10n_be_revenue_code:
                raise ValidationError(_("Please configure the 'Company Number' and the 'Revenue Code' on the Payroll Settings."))

    @api.depends('date_start', 'date_end', 'company_id')
    def _compute_line_ids(self):
        structure_termination = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_termination_fees')
        structure_holidays_n = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_departure_n_holidays')
        structure_holidays_n1 = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_departure_n1_holidays')
        invalid_structures = structure_termination + structure_holidays_n1 + structure_holidays_n

        for wizard in self:
            mapped_pp = defaultdict(lambda: 0)
            mapped_taxable_amount = defaultdict(lambda: 0)
            payslips = self._get_valid_payslips()

            # Total
            wizard.taxable_amount = payslips._get_pp_taxable_amount()
            wizard.pp_amount = sum(abs(p._get_salary_line_total('PPTOTAL')) for p in payslips)
            # Valid payslips for exemption
            payslips = payslips.filtered(lambda p: p.contract_id.rd_percentage and p.struct_id not in invalid_structures)
            # 32 : Civil Engineers / Doctors
            payslips_32 = payslips.filtered(lambda p: p.employee_id.certificate in ['doctor', 'civil_engineer'])
            wizard.taxable_amount_32 = payslips_32._get_pp_taxable_amount()
            wizard.pp_amount_32 = sum(abs(p._get_salary_line_total('PPTOTAL')) for p in payslips_32)

            # 33 : Masters
            payslips_33 = payslips.filtered(lambda p: p.employee_id.certificate in ['master'])
            wizard.taxable_amount_33 = payslips_33._get_pp_taxable_amount()
            wizard.pp_amount_33 = sum(abs(p._get_salary_line_total('PPTOTAL')) for p in payslips_33)
            # 33 : Bachelors
            payslips_34 = payslips.filtered(lambda p: p.employee_id.certificate in ['bachelor'])
            wizard.taxable_amount_34 = payslips_34._get_pp_taxable_amount()
            wizard.pp_amount_34 = sum(abs(p._get_salary_line_total('PPTOTAL')) for p in payslips_34)
            wizard.write({
                'deducted_amount': 0,
                'deducted_amount_32': 0,
                'deducted_amount_33': 0,
                'deducted_amount_34': 0,
            })

            for payslip in payslips:
                if payslip.contract_id.rd_percentage:
                    deducted_amount = payslip.contract_id.rd_percentage / 100 * 0.8 * abs(payslip._get_salary_line_total('PPTOTAL'))
                    if payslip.employee_id.certificate in ['doctor', 'civil_engineer']:
                        wizard.deducted_amount_32 += deducted_amount
                    elif payslip.employee_id.certificate == 'master':
                        wizard.deducted_amount_33 += deducted_amount
                    elif payslip.employee_id.certificate == 'bachelor':
                        wizard.deducted_amount_34 += deducted_amount
                    wizard.deducted_amount += deducted_amount
                    mapped_pp[payslip.employee_id] += payslip.contract_id.rd_percentage / 100 * 0.8 * abs(payslip._get_salary_line_total('PPTOTAL'))
                    mapped_taxable_amount[payslip.employee_id] += payslip._get_pp_taxable_amount()

            # The total amount of the exemption from payment of the withholding tax granted to
            # researchers who have a bachelor's degree is limited to 25% of the total amount of
            # the exemption from the payment of the withholding tax granted to researchers who have
            # a diploma qualifying as a doctorate or Master. This percentage will be doubled for
            # small companies (article 15 §§, 1 to 6 of the Companies Code). This limitation has
            # not changed on January 1, 2020.
            # https://www.belspo.be/belspo/organisation/fisc_dipl_fr.stm
            wizard.capped_amount_34 = min(
                wizard.deducted_amount_34,
                (wizard.deducted_amount_32 + wizard.deducted_amount_33) / 4)

            wizard.line_ids = [(5, 0, 0)] + [(0, 0, {
                'wizard_id': wizard.id,
                'employee_id': employee.id,
                'amount': mapped_pp[employee],
                'taxable_amount': mapped_taxable_amount[employee],
            }) for employee in mapped_pp.keys()]

    def action_generate_pdf(self):
        self.ensure_one()
        report_data = {
            'company_name': self.company_id.name,
            'company_address': ' '.join([self.company_id.street or '', self.company_id.street2 or '']),
            'company_zip': self.company_id.zip,
            'company_city': self.company_id.city,
            'company_phone': self.company_id.phone,
            'date_start': self.date_start.strftime("%d/%m/%Y"),
            'date_end': self.date_end.strftime("%d/%m/%Y"),
        }

        filename = '%s-%s-274_XX.pdf' % (self.date_start.strftime("%d%B%Y"), self.date_end.strftime("%d%B%Y"))
        export_274_sheet_pdf, _ = self.env.ref('l10n_be_hr_payroll.action_report_employee_274_10').sudo()._render_qweb_pdf(res_ids=self.ids, data=report_data)

        self.sheet_274_10_filename = filename
        self.sheet_274_10 = base64.encodebytes(export_274_sheet_pdf)
        self.state = 'waiting'
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def _to_eurocent(self, amount):
        return '%s' % int(amount * 100)

    def _get_rendering_data(self):
        # https://finances.belgium.be/sites/default/files/downloads/Sp%C3%A9cification%20XML.doc
        result = {
            'creation_date': fields.Date.today().strftime("%Y-%m-%d"),
            'last_period': self.date_start.strftime("%y%m"),
            'declarations': [],
            'positive_amount': 1,
            'positive_total': 0,
            'negative_amount': 3,
            'negative_total': 0,
        }
        payslips = self._get_valid_payslips()

        if len(payslips.mapped('company_id')) > 1:
            raise UserError(_('The payslips should be from the same company.'))
        if not payslips:
            raise UserError(_('There is no valid payslip to declare.'))

        year_period_code = {
            2018: '601',
            2019: '701',
            2020: '801',
            2021: '901',
        }
        reference_number = payslips[0].company_id.l10n_be_company_number
        # payment reference - 12 Characters
        first_10_characters = "%s%s" % (
            reference_number[1:8], # 1 - 7
            year_period_code[payslips[0].date_from.year],  # 8-10
        )
        payment_reference = "%s%s" % (
            first_10_characters,
            int(first_10_characters) % 97,
        )
        self.payment_reference = "+++ %s / %s / %s +++" % (
            payment_reference[0:3],
            payment_reference[3:7],
            payment_reference[7:12],
        )

        date_from = payslips[0].date_from
        date_to = payslips[0].date_to
        district = payslips[0].company_id.l10n_be_revenue_code[:2]
        office = payslips[0].company_id.l10n_be_revenue_code[-2:]

        if any(payslip.date_from != date_from or payslip.date_to != date_to for payslip in payslips):
            raise UserError(_('The payslips should cover the same period'))

        declaration_10 = {
            'declaration_number': 10000010,
            'reference_number': reference_number,
            'year': date_from.strftime("%Y"),
            'period': '%s00' % (date_from.strftime("%m")),
            'revenue_nature': 10,
            'taxable_revenue': 0,
            'prepayment': 0,
            'payment_reference': payment_reference,
            'district': district,
            'office': office,
        }
        declaration_32 = {
            'declaration_number': 10000032,
            'reference_number': reference_number,
            'year': date_from.strftime("%Y"),
            'period': '%s00' % (date_from.strftime("%m")),
            'revenue_nature': 32,
            'taxable_revenue': 0,
            'prepayment': 0,
            'payment_reference': payment_reference,
            'district': district,
            'office': office,
        }
        declaration_33 = {
            'declaration_number': 10000033,
            'reference_number': reference_number,
            'year': date_from.strftime("%Y"),
            'period': '%s00' % (date_from.strftime("%m")),
            'revenue_nature': 33,
            'taxable_revenue': 0,
            'prepayment': 0,
            'payment_reference': payment_reference,
            'district': district,
            'office': office,
        }
        declaration_34 = {
            'declaration_number': 10000034,
            'reference_number': reference_number,
            'year': date_from.strftime("%Y"),
            'period': '%s00' % (date_from.strftime("%m")),
            'revenue_nature': 34,
            'taxable_revenue': 0,
            'prepayment': 0,
            'payment_reference': payment_reference,
            'district': district,
            'office': office,
        }
        structure_termination = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_termination_fees')
        structure_holidays_n = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_departure_n_holidays')
        structure_holidays_n1 = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_departure_n1_holidays')
        invalid_structures = structure_termination + structure_holidays_n1 + structure_holidays_n

        for payslip in payslips:
            pp_total = payslip._get_salary_line_total('PPTOTAL')
            if pp_total >= 0:
                pp_total_eurocent = int(pp_total * 100)
                taxable_eurocent = int(payslip._get_pp_taxable_amount() * 100)
                declaration_10['prepayment'] += pp_total_eurocent
                declaration_10['taxable_revenue'] += taxable_eurocent
                result['positive_total'] += pp_total_eurocent

            if payslip.struct_id not in invalid_structures and payslip.contract_id.rd_percentage:
                employee = payslip.employee_id
                deduction = - payslip.contract_id.rd_percentage / 100 * 0.8 * abs(payslip._get_salary_line_total('PPTOTAL'))
                if deduction:
                    if employee.certificate in ['doctor', 'civil_engineer']:
                        pp_total_eurocent = int(deduction * 100)
                        taxable_eurocent = int(payslip._get_pp_taxable_amount() * 100)
                        declaration_32['prepayment'] += pp_total_eurocent
                        declaration_32['taxable_revenue'] += taxable_eurocent
                    elif employee.certificate == 'master':
                        pp_total_eurocent = int(deduction * 100)
                        taxable_eurocent = int(payslip._get_pp_taxable_amount() * 100)
                        declaration_33['prepayment'] += pp_total_eurocent
                        declaration_33['taxable_revenue'] += taxable_eurocent
                    elif employee.certificate == 'bachelor':
                        pp_total_eurocent = int(deduction * 100)
                        taxable_eurocent = int(payslip._get_pp_taxable_amount() * 100)
                        declaration_34['prepayment'] += pp_total_eurocent
                        declaration_34['taxable_revenue'] += taxable_eurocent
                    result['negative_total'] += int(deduction * 100)

        result['declarations'] = [declaration_10, declaration_32, declaration_33, declaration_34]
        result['positive_total'] = str(result['positive_total'])
        result['negative_total'] = str(result['negative_total'])
        return result

    def action_generate_xml(self):
        filename = '%s-%s-finprof.xml' % (self.date_start.strftime("%d%B%Y"), self.date_end.strftime("%d%B%Y"))
        self.xml_filename = filename

        xml_str = self.env.ref('l10n_be_hr_payroll.finprof_xml_report')._render(
            self._get_rendering_data())

        # Prettify xml string
        root = etree.fromstring(xml_str, parser=etree.XMLParser(remove_blank_text=True))
        xml_formatted_str = etree.tostring(root, pretty_print=True, encoding='utf-8', xml_declaration=True)

        self.xml_file = base64.encodebytes(xml_formatted_str)

        self.state = 'waiting'
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def action_generate_xls(self):
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        worksheet = workbook.add_worksheet('Exemption Details')
        style_highlight = workbook.add_format({'bold': True, 'pattern': 1, 'bg_color': '#E0E0E0', 'align': 'center'})
        style_normal = workbook.add_format({'align': 'center'})
        row = 0

        headers = [
            "Nom Complet",
            "Numéro National",
            "Département",
            "Date d'entrée",
            "Date de sortie",
            "Certification",
            "Fonction",
            "Recherche Scientifique \%",
            "Montant Imposable",
            "Dispense de Vers. Recherche Scientifique",
        ]

        certificate_selection_vals = {
            elem[0]: elem[1] for elem in self.env['hr.employee']._fields['certificate']._description_selection(self.env)
        }

        rows = []
        for line in self.line_ids:
            employee = line.employee_id.sudo()

            rows.append((
                employee.name,
                employee.identification_id,
                employee.department_id.name or employee.contract_id.department_id.name,
                employee.first_contract_date.strftime("%d-%m-%Y") if employee.first_contract_date else '',
                employee.departure_date.strftime("%d-%m-%Y") if employee.departure_date else '',
                certificate_selection_vals[employee.certificate],
                employee.job_title or employee.job_id.name,
                employee.contract_id.rd_percentage,
                line.taxable_amount,
                line.amount,
            ))

        col = 0
        for header in headers:
            worksheet.write(row, col, header, style_highlight)
            worksheet.set_column(col, col, 30)
            col += 1

        row = 1
        for employee_row in rows:
            col = 0
            for employee_data in employee_row:
                worksheet.write(row, col, employee_data, style_normal)
                col += 1
            row += 1

        workbook.close()
        xlsx_data = output.getvalue()

        self.xls_file = base64.encodebytes(xlsx_data)
        self.xls_filename = "withholding_tax_exemption_details.xlsx"

        self.state = 'waiting'
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
        if self.sheet_274_10:
            self._post_process_generated_file(self.sheet_274_10, self.sheet_274_10_filename)
        if self.xls_file:
            self._post_process_generated_file(self.xls_file, self.xls_filename)
        if self.xml_file:
            self._post_process_generated_file(self.xml_file, self.xml_filename)
        return {'type': 'ir.actions.act_window_close'}

    def _post_process_generated_file(self, data, filename):
        return


class L10nBeHrPayrollWithholdingTaxExemptionLine(models.TransientModel):
    _name = 'l10n.be.withholding.tax.exemption.line'
    _description = '274.XX Sheets Line'

    wizard_id = fields.Many2one('l10n.be.withholding.tax.exemption')
    employee_id = fields.Many2one('hr.employee')
    certificate = fields.Selection(related='employee_id.certificate')
    taxable_amount = fields.Monetary()
    amount = fields.Monetary(string="Exempted Amount")
    company_id = fields.Many2one('res.company', related='wizard_id.company_id')
    currency_id = fields.Many2one('res.currency', related='company_id.currency_id')
