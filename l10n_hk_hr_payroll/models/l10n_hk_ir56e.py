# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import api, fields, models
from odoo.tools import format_date

_logger = logging.getLogger(__name__)


class L10nHkIr56e(models.Model):
    _name = 'l10n_hk.ir56e'
    _inherit = 'l10n_hk.ird'
    _description = 'IR56E Sheet'
    _order = 'submission_date'

    line_ids = fields.One2many('l10n_hk.ir56e.line', 'sheet_id', string="Appendices")

    @api.depends('submission_date')
    def _compute_display_name(self):
        for sheet in self:
            sheet.display_name = format_date(self.env, sheet.submission_date, date_format="MMMM y", lang_code=self.env.user.lang)

    def _get_rendering_data(self, employees):
        self.ensure_one()

        employees_error = self._check_employees(employees)
        if employees_error:
            return {'error': employees_error}

        main_data = self._get_main_data()
        employees_data = []
        for employee in employees:
            hkid, ppnum = '', ''
            if employee.identification_id:
                hkid = employee.identification_id.strip().upper()
            else:
                ppnum = ', '.join([employee.passport_id, employee.l10n_hk_passport_place_of_issue])

            spouse_name, spouse_hkid, spouse_passport = '', '', ''
            if employee.marital == 'married':
                spouse_name = employee.spouse_complete_name.upper()
                if employee.l10n_hk_spouse_identification_id:
                    spouse_hkid = employee.l10n_hk_spouse_identification_id.strip().upper()
                if employee.l10n_hk_spouse_passport_id or employee.l10n_hk_spouse_passport_place_of_issue:
                    spouse_passport = ', '.join(i for i in [employee.l10n_hk_spouse_passport_id, employee.l10n_hk_spouse_passport_place_of_issue] if i)

            employee_address = ', '.join(i for i in [
                employee.private_street, employee.private_street2, employee.private_city, employee.private_state_id.name, employee.private_country_id.name] if i)

            sheet_values = {
                'employee': employee,
                'employee_id': employee.id,
                'HKID': hkid,
                'TypeOfForm': self.type_of_form,
                'Surname': employee.l10n_hk_surname,
                'GivenName': employee.l10n_hk_given_name,
                'NameInChinese': employee.l10n_hk_name_in_chinese,
                'Sex': 'M' if employee.gender == 'male' else 'F',
                'MaritalStatus': 2 if employee.marital == 'married' else 1,
                'PpNum': ppnum,
                'SpouseName': spouse_name,
                'SpouseHKID': spouse_hkid,
                'SpousePpNum': spouse_passport,
                'employee_address': employee_address,
                'Capacity': employee.job_title,
                'date_of_commencement': employee.first_contract_date,
                'monthly_salary': employee.contract_id.wage,
                'PlaceOfResInd': int(bool(employee.l10n_hk_rental_id)),
            }

            if employee.l10n_hk_rental_id:
                sheet_values.update({
                    'AddrOfPlace': employee.l10n_hk_rental_id.address,
                    'NatureOfPlace': employee.l10n_hk_rental_id.nature,
                    'RentPaidEe': employee.l10n_hk_rental_id.amount,
                    'RentRefund': employee.l10n_hk_rental_id.amount,
                })

            employees_data.append(sheet_values)

        return {'data': main_data, 'employees_data': employees_data}

class L10nHkIr56eLine(models.Model):
    _name = 'l10n_hk.ir56e.line'
    _description = 'IR56E Line'

    employee_id = fields.Many2one('hr.employee', string='Employee', required=True)
    pdf_file = fields.Binary(string='PDF File', readonly=True)
    pdf_filename = fields.Char(string='PDF Filename', readonly=True)
    sheet_id = fields.Many2one('l10n_hk.ir56e', string='IR56E', required=True, ondelete='cascade')
    pdf_to_generate = fields.Boolean()

    _sql_constraints = [
        ('unique_employee', 'unique(employee_id, sheet_id)', 'An employee can only have one IR56E line per sheet.'),
    ]

    def _generate_pdf(self):
        report_sudo = self.env["ir.actions.report"].sudo()
        report_id = self.env.ref('l10n_hk_hr_payroll.action_report_employee_ir56e').id

        for sheet in self.sheet_id:
            lines = self.filtered(lambda l: l.sheet_id == sheet)
            rendering_data = sheet._get_rendering_data(lines.employee_id)
            if 'error' in rendering_data:
                sheet.pdf_error = rendering_data['error']
                continue
            pdf_files = []
            sheet_count = len(rendering_data['employees_data'])
            counter = 1
            for sheet_data in rendering_data['employees_data']:
                _logger.info('Printing IR56E sheet (%s/%s)', counter, sheet_count)
                counter += 1
                sheet_filename = '%s_-_IR56E' % (sheet_data['employee'].name)
                sheet_file, dummy = report_sudo.with_context(allowed_company_ids=sheet_data['employee'].company_id.ids)._render_qweb_pdf(
                    report_id, [sheet_data['employee']], data={**sheet_data, **rendering_data['data']})
                pdf_files.append((sheet_data['employee'], sheet_filename, sheet_file))

            if pdf_files:
                sheet._process_files(pdf_files)
