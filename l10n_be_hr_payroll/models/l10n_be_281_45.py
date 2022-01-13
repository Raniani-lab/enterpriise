# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import io
import logging
import zipfile

from datetime import date
from collections import defaultdict
from lxml import etree

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.modules.module import get_resource_path

_logger = logging.getLogger(__name__)

# Sources:
# - Technical Doc https://finances.belgium.be/fr/E-services/Belcotaxonweb/documentation-technique
# - "Avis aux débiteurs" https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/avis_aux_debiteurs#q2

COUNTRY_CODES = {
    'BE': '00000',
    'ES': '00109',
    'FR': '00111',
    'GR': '00112',
    'LU': '00113',
    'DE': '00103',
    'RO': '00124',
    'IT': '00128',
    'NL': '00129',
    'TR': '00262',
    'US': '00402',
    'MA': 'O0354',
}


class L10nBe28145(models.Model):
    _name = 'l10n_be.281_45'
    _description = 'HR Payroll 281.45 Wizard'
    _order = 'reference_year'

    def _get_years(self):
        return [(str(i), i) for i in range(fields.Date.today().year, 2009, -1)]

    @api.model
    def default_get(self, field_list):
        if self.env.company.country_id.code != "BE":
            raise UserError(_('You must be logged in a Belgian company to use this feature'))
        return super().default_get(field_list)

    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    state = fields.Selection([('generate', 'generate'), ('get', 'get')], default='generate')
    reference_year = fields.Selection(
        selection='_get_years', string='Reference Year', required=True,
        default=lambda x: str(fields.Date.today().year - 1))
    is_test = fields.Boolean(string="Is It a test ?", default=False)
    type_sending = fields.Selection([
        ('0', 'Original send'),
        ('1', 'Send grouped corrections'),
        ], string="Sending Type", default='0', required=True)
    type_treatment = fields.Selection([
        ('0', 'Original'),
        ('1', 'Modification'),
        ('2', 'Add'),
        ('3', 'Cancel'),
        ], string="Treatment Type", default='0', required=True)
    xml_file = fields.Binary('XML File', readonly=True, attachment=False)
    xml_filename = fields.Char()
    xml_validation_state = fields.Selection([
        ('normal', 'N/A'),
        ('done', 'Valid'),
        ('invalid', 'Invalid'),
    ], default='normal', compute='_compute_validation_state', store=True)
    error_message = fields.Char('Error Message', compute='_compute_validation_state', store=True)
    line_ids = fields.One2many(
        'l10n_be.281_45.line', 'sheet_id', compute='_compute_line_ids', store=True, readonly=False)

    @api.depends('reference_year')
    def _compute_line_ids(self):
        for sheet in self:
            all_payslips = self.env['hr.payslip'].search([
                ('date_to', '<=', date(int(sheet.reference_year), 12, 31)),
                ('date_from', '>=', date(int(sheet.reference_year), 1, 1)),
                ('state', 'in', ['done', 'paid']),
                ('company_id', '=', sheet.company_id.id),
            ])
            all_employees = all_payslips.mapped('employee_id')
            sheet.write({
                'line_ids': [(5, 0, 0)] + [(0, 0, {
                    'employee_id': employee.id,
                }) for employee in all_employees]
            })

    @api.depends('xml_file')
    def _compute_validation_state(self):
        xsd_schema_file_path = get_resource_path(
            'l10n_be_hr_payroll',
            'data',
            '161-xsd-2021-20211223.xsd',
        )
        xsd_root = etree.parse(xsd_schema_file_path)
        schema = etree.XMLSchema(xsd_root)

        no_xml_file_records = self.filtered(lambda record: not record.xml_file)
        no_xml_file_records.update({
            'xml_validation_state': 'normal',
            'error_message': False})
        for record in self - no_xml_file_records:
            xml_root = etree.fromstring(base64.b64decode(record.xml_file))
            try:
                schema.assertValid(xml_root)
                record.xml_validation_state = 'done'
            except etree.DocumentInvalid as err:
                record.xml_validation_state = 'invalid'
                record.error_message = str(err)

    def name_get(self):
        return [(
            record.id,
            '%s%s' % (record.reference_year, _('- Test') if record.is_test else '')
        ) for record in self]

    def _check_employees_configuration(self, employees):
        invalid_employees = employees.filtered(lambda e: not (e.company_id and e.company_id.street and e.company_id.zip and e.company_id.city and e.company_id.phone and e.company_id.vat))
        if invalid_employees:
            raise UserError(_("The company is not correctly configured on your employees. Please be sure that the following pieces of information are set: street, zip, city, phone and vat") + '\n' + '\n'.join(invalid_employees.mapped('name')))

        invalid_employees = employees.filtered(
            lambda e: not e.address_home_id or not e.address_home_id.street or not e.address_home_id.zip or not e.address_home_id.city or not e.address_home_id.country_id)
        if invalid_employees:
            raise UserError(_("The following employees don't have a valid private address (with a street, a zip, a city and a country):\n%s", '\n'.join(invalid_employees.mapped('name'))))

        if not all(emp.contract_ids and emp.contract_id for emp in employees):
            raise UserError(_('Some employee has no contract.'))

        invalid_employees = employees.filtered(lambda e: not e._is_niss_valid())
        if invalid_employees:
            raise UserError(_('Invalid NISS number for those employees:\n %s', '\n'.join(invalid_employees.mapped('name'))))

        invalid_country_codes = employees.address_home_id.country_id.filtered(lambda c: c.code not in COUNTRY_CODES)
        if invalid_country_codes:
            raise UserError(_('Unsupported country code %s. Please contact an administrator.', ', '.join(invalid_country_codes.mapped('code'))))

    @api.model
    def _get_lang_code(self, lang):
        if lang == 'nl_NL':
            return 1
        elif lang == 'fr_FR':
            return 2
        elif lang == 'de_DE':
            return 3
        return 2

    @api.model
    def _get_country_code(self, country):
        return COUNTRY_CODES[country.code]

    @api.model
    def _get_marital_code(self, marital):
        codes = {
            'single': '1',
            'married': '2',
            'cohabitant': '2',
            'widower': '3',
            'divorced': '4',
        }
        return codes.get(marital, '0')

    @api.model
    def _get_fiscal_status(self, employee):
        if employee.marital in ['married', 'cohabitant']:
            if employee.spouse_fiscal_status in ['high_income', 'high_pension']:
                return '1'
            if employee.spouse_fiscal_status == 'without_income':
                return '2'
            if employee.spouse_fiscal_status in ['low_pension', 'low_income']:
                return '3'
        return '0'  # single, widow, ...

    @api.model
    def _get_dependent_people(self, employee):
        if not employee.other_dependent_people:
            return 0
        return employee.other_senior_dependent + employee.other_disabled_senior_dependent + self.other_juniors_dependent + self.other_disabled_juniors_dependent

    @api.model
    def _get_other_family_charges(self, employee):
        if employee.dependent_children and employee.marital in ['single', 'widower']:
            return 'X'
        return ''

    def _get_rendering_data(self, employees):
        main_data = {
            'v0002_inkomstenjaar': self.reference_year,
            'v0010_bestandtype': 'BELCOTST' if self.is_test else 'BELCOTAX',
            'v0011_aanmaakdatum': fields.Date.today().strftime('%d-%m-%Y'),
            'v0014_naam': self.company_id.name,
            'v0015_adres': self.company_id.street,
            'v0016_postcode': self.company_id.zip,
            'v0017_gemeente': self.company_id.city,
            'v0018_telefoonnummer': self.company_id.phone,
            'v0021_contactpersoon': self.env.user.name,
            'v0022_taalcode': self._get_lang_code(self.env.user.employee_id.address_home_id.lang),
            'v0023_emailadres': self.env.user.email,
            'v0024_nationaalnr': self.company_id.vat.replace('BE', ''),
            'v0025_typeenvoi': self.type_sending,

            'a1002_inkomstenjaar': self.reference_year,
            'a1005_registratienummer': self.company_id.vat.replace('BE', ''),
            'a1011_naamnl1': self.company_id.name,
            'a1013_adresnl': self.company_id.street,
            'a1015_gemeente': self.company_id.zip,
            'a1020_taalcode': 1,
        }

        employees_data = []

        all_payslips = self.env['hr.payslip'].search([
            ('date_to', '<=', date(int(self.reference_year), 12, 31)),
            ('date_from', '>=', date(int(self.reference_year), 1, 1)),
            ('state', 'in', ['done', 'paid']),
            ('employee_id', 'in', employees.ids),
        ])
        print(employees, all_payslips)
        all_employees = all_payslips.mapped('employee_id')
        self._check_employees_configuration(all_employees)

        employee_payslips = defaultdict(lambda: self.env['hr.payslip'])
        for payslip in all_payslips:
            employee_payslips[payslip.employee_id] |= payslip

        line_codes = [
            'IP',
            'IP.DED',
        ]
        all_line_values = all_payslips._get_line_values(line_codes)

        belgium = self.env.ref('base.be')
        sequence = 0
        # warrant_structure = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_structure_warrant')
        for employee in employee_payslips:
            is_belgium = employee.address_home_id.country_id == belgium
            payslips = employee_payslips[employee]
            sequence += 1

            mapped_total = {
                code: sum(all_line_values[code][p.id]['total'] for p in payslips)
                for code in line_codes}

            sheet_values = {
                'employee': employee,
                'employee_id': employee.id,
                'f2002_inkomstenjaar': self.reference_year,
                'f2005_registratienummer': self.company_id.vat.replace('BE', ''),
                'f2008_typefiche': '28110',
                'f2009_volgnummer': sequence,
                'f2011_nationaalnr': employee.niss,
                'f2013_naam': employee.name,
                'f2015_adres': employee.address_home_id.street,
                'f2016_postcodebelgisch': employee.address_home_id.zip if is_belgium else '0',
                'employee_city': employee.address_home_id.city,
                'f2018_landwoonplaats': '0' if is_belgium else self._get_country_code(employee.address_home_id.country_id),
                'f2019_burgerlijkstand': self._get_marital_code(employee.marital),
                'f2020_echtgenote': self._get_fiscal_status(employee),
                'f2021_aantalkinderen': employee.children + employee.disabled_children_number,
                'f2022_anderentlaste': self._get_dependent_people(employee),
                'f2023_diverse': self._get_other_family_charges(employee),
                'f2024_echtgehandicapt': 'H' if employee.disabled_spouse_bool else '',
                'f2026_verkrghandicap': 'H' if employee.disabled else '',
                'f2027_taalcode': self._get_lang_code(employee.address_home_id.lang),
                'f2028_typetraitement': self.type_treatment,
                'f2029_enkelopgave325': 0,
                'f2112_buitenlandspostnummer': employee.address_home_id.zip if not is_belgium else '0',
                'f2114_voornamen': employee.name,
                'f45_2030_aardpersoon': 1,
                'f45_2031_verantwoordingsstukken': 0,
                'f45_2060_brutoinkomsten': round(mapped_total['IP'], 2),
                'f45_2061_forfaitairekosten': round(mapped_total['IP'] / 2.0, 2),
                'f45_2062_werkelijkekosten': 0,
                'f45_2063_roerendevoorheffing': round(-mapped_total['IP.DED'], 2),
                'f45_2099_comment': '',
                'f45_2109_fiscaalidentificat': employee.identification_id if employee.country_id != belgium else '',
                'f45_2110_kbonbr': 0, # ?
            }
            employees_data.append(sheet_values)

        sheets_count = len(employees_data)
        sum_2009 = round(sum(sheet_values['f2009_volgnummer'] for sheet_values in employees_data), 2)
        sum_2059 = 0
        sum_2063 = round(sum(sheet_values['f45_2063_roerendevoorheffing'] for sheet_values in employees_data), 2)
        total_data = {
            'r8002_inkomstenjaar': self.reference_year,
            'r8010_aantalrecords': sheets_count,
            'r8011_controletotaal': sum_2009,
            'r8012_controletotaal': sum_2059,
            'r8013_totaalvoorheffingen': sum_2063,
            'r9002_inkomstenjaar': self.reference_year,
            'r9010_aantallogbestanden': sheets_count,
            'r9011_totaalaantalrecords': sheets_count,
            'r9012_controletotaal': sum_2009,
            'r9013_controletotaal': sum_2063,
            'r9014_controletotaal': sum_2059,
        }
        print(employees_data)
        return {'data': main_data, 'employees_data': employees_data, 'total_data': total_data}

    def action_generate_pdf(self):
        self.line_ids.write({'pdf_to_generate': True})
        self.env.ref('hr_payroll.ir_cron_generate_payslip_pdfs')._trigger()

    def _process_files(self, files):
        self.ensure_one()
        for employee, filename, data in files:
            line = self.line_ids.filtered(lambda l: l.employee_id == employee)
            line.write({
                'pdf_file': base64.encodebytes(data),
                'pdf_filename': filename,
            })

    def action_generate_xml(self):
        self.ensure_one()
        self.xml_filename = '%s-281_45_report.xml' % (self.reference_year)
        xml_str = self.env.ref('l10n_be_hr_payroll.281_45_xml_report')._render(self._get_rendering_data(self.line_ids.employee_id))

        # Prettify xml string
        root = etree.fromstring(xml_str, parser=etree.XMLParser(remove_blank_text=True))
        xml_formatted_str = etree.tostring(root, pretty_print=True, encoding='utf-8', xml_declaration=True)

        self.xml_file = base64.encodebytes(xml_formatted_str)
        self.state = 'get'


class L10nBe28145Line(models.Model):
    _name = 'l10n_be.281_45.line'
    _description = 'HR Payroll 281.45 Line Wizard'

    employee_id = fields.Many2one('hr.employee')
    pdf_file = fields.Binary('PDF File', readonly=True, attachment=False)
    pdf_filename = fields.Char()
    sheet_id = fields.Many2one('l10n_be.281_45')
    pdf_to_generate = fields.Boolean()

    def _generate_pdf(self):
        for sheet in self.sheet_id:
            lines = self.filtered(lambda l: l.sheet_id == sheet)
            rendering_data = sheet._get_rendering_data(lines.employee_id)
            for sheet_values in rendering_data['employees_data']:
                for key, value in sheet_values.items():
                    if not value:
                        sheet_values[key] = _('None')
            template_sudo = self.env.ref('l10n_be_hr_payroll.action_report_employee_281_45').sudo()

            pdf_files = []
            sheet_count = len(rendering_data['employees_data'])
            counter = 1
            for sheet_data in rendering_data['employees_data']:
                _logger.info('Printing 281.45 sheet (%s/%s)', counter, sheet_count)
                counter += 1
                sheet_filename = '%s-%s-281_45' % (sheet_data['f2002_inkomstenjaar'], sheet_data['f2013_naam'])
                employee_lang = sheet_data['employee'].sudo().address_home_id.lang
                sheet_file, dummy = template_sudo.with_context(lang=employee_lang)._render_qweb_pdf(
                    sheet_data['employee_id'], data={**sheet_data, **rendering_data['data']})
                pdf_files.append((sheet_data['employee'], sheet_filename, sheet_file))

            if pdf_files:
                sheet._process_files(pdf_files)
