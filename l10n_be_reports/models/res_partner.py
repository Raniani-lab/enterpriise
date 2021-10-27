# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import zipfile
import tempfile
import base64
from stdnum.be import vat
from collections import Counter
from lxml import etree

from odoo import _, fields, models
from odoo.exceptions import UserError

ONSS_COUNTRY_CODE_MAPPING = {
    'AD': '00102', 'AE': '00260', 'AF': '00251', 'AG': '00403', 'AI': '00490', 'AL': '00101', 'AM': '00249',
    'AO': '00341', 'AR': '00511', 'AS': '00690', 'AT': '00105', 'AU': '00611', 'AZ': '00250', 'BA': '00149',
    'BB': '00423', 'BD': '00237', 'BE': '00000', 'BF': '00308', 'BG': '00106', 'BH': '00268', 'BI': '00303',
    'BJ': '00310', 'BM': '00485', 'BN': '00224', 'BO': '00512', 'BR': '00513', 'BS': '00425', 'BT': '00223',
    'BW': '00302', 'BY': '00142', 'BZ': '00430', 'CA': '00401', 'CD': '00306', 'CF': '00305', 'CG': '00307',
    'CH': '00127', 'CI': '00309', 'CK': '00687', 'CL': '00514', 'CM': '00304', 'CN': '00218', 'CO': '00515',
    'CR': '00411', 'CU': '00412', 'CV': '00339', 'CY': '00107', 'CZ': '00140', 'DE': '00103', 'DJ': '00345',
    'DK': '00108', 'DM': '00480', 'DO': '00427', 'DZ': '00351', 'EC': '00516', 'EE': '00136', 'EG': '00352',
    'EH': '00388', 'ER': '00349', 'ES': '00109', 'ET': '00311', 'FI': '00110', 'FJ': '00617', 'FK': '00580',
    'FM': '00602', 'FR': '00111', 'GA': '00312', 'GB': '00112', 'GD': '00426', 'GE': '00253', 'GF': '00581',
    'GH': '00314', 'GI': '00180', 'GL': '00498', 'GM': '00313', 'GN': '00315', 'GP': '00496', 'GQ': '00337',
    'GR': '00114', 'GT': '00413', 'GU': '00681', 'GW': '00338', 'GY': '00521', 'HK': '00234', 'HN': '00414',
    'HR': '00146', 'HT': '00419', 'HU': '00115', 'ID': '00208', 'IE': '00116', 'IL': '00256', 'IN': '00207',
    'IQ': '00254', 'IR': '00255', 'IS': '00117', 'IT': '00128', 'JM': '00415', 'JO': '00257', 'JP': '00209',
    'KE': '00336', 'KG': '00226', 'KH': '00216', 'KI': '00622', 'KM': '00343', 'KN': '00431', 'KP': '00219',
    'KR': '00206', 'KW': '00264', 'KY': '00492', 'KZ': '00225', 'LA': '00210', 'LB': '00258', 'LC': '00428',
    'LI': '00118', 'LK': '00203', 'LR': '00318', 'LS': '00301', 'LT': '00137', 'LU': '00113', 'LV': '00135',
    'LY': '00353', 'MA': '00354', 'MC': '00120', 'MD': '00144', 'ME': '00151', 'MG': '00324', 'MH': '00603',
    'MK': '00148', 'ML': '00319', 'MM': '00201', 'MN': '00221', 'MO': '00281', 'MQ': '00497', 'MR': '00355',
    'MS': '00493', 'MT': '00119', 'MU': '00317', 'MV': '00222', 'MW': '00358', 'MX': '00416', 'MY': '00212',
    'MZ': '00340', 'NA': '00384', 'NC': '00683', 'NE': '00321', 'NG': '00322', 'NI': '00417', 'NL': '00129',
    'NO': '00121', 'NP': '00213', 'NR': '00615', 'NU': '00604', 'NZ': '00613', 'OM': '00266', 'PA': '00418',
    'PE': '00518', 'PF': '00684', 'PG': '00619', 'PH': '00214', 'PK': '00259', 'PL': '00122', 'PM': '00495',
    'PN': '00692', 'PR': '00487', 'PS': '00271', 'PT': '00123', 'PW': '00679', 'PY': '00517', 'QA': '00267',
    'RE': '00387', 'RO': '00124', 'RS': '00152', 'RU': '00145', 'RW': '00327', 'SA': '00252', 'SB': '00623',
    'SC': '00342', 'SD': '00356', 'SE': '00126', 'SG': '00205', 'SH': '00389', 'SI': '00147', 'SK': '00141',
    'SL': '00328', 'SM': '00125', 'SN': '00320', 'SO': '00329', 'SR': '00522', 'SS': '00365', 'SV': '00421',
    'SY': '00261', 'SZ': '00347', 'TC': '00488', 'TD': '00333', 'TG': '00334', 'TH': '00235', 'TJ': '00228',
    'TL': '00282', 'TM': '00229', 'TN': '00357', 'TO': '00616', 'TR': '00262', 'TT': '00422', 'TV': '00621',
    'TW': '00204', 'TZ': '00332', 'UA': '00143', 'UG': '00323', 'US': '00402', 'UY': '00519', 'UZ': '00227',
    'VA': '00133', 'VC': '00429', 'VE': '00520', 'VG': '00479', 'VI': '00478', 'VN': '00220', 'VU': '00624',
    'WF': '00689', 'WS': '00614', 'XK': '00153', 'YE': '00270', 'ZA': '00325', 'ZM': '00335', 'ZW': '00344'
}

def _vat_to_bce(vat_number: str) -> str:
    return vat.compact(vat_number)

def format_if_float(amount):
    return f"{amount * 100:.0f}" if isinstance(amount, float) else amount  # amounts in € requires to be formatted for xml


class ResPartner(models.Model):
    _inherit = 'res.partner'

    citizen_identification = fields.Char(string="Citizen Identification",
                                         help="This code corresponds to the personal identification number for the tax authorities.\n"
                                              "More information here:\n"
                                              "https://ec.europa.eu/taxation_customs/tin/pdf/fr/TIN_-_subject_sheet_-_3_examples_fr.pdf")
    form_file = fields.Binary(readonly=True, help="Technical field to store all forms file.")

    def create_281_50_form(self):
        return {
            "name": _("Create forms 281.50"),
            "type": "ir.actions.act_window",
            "res_model": "l10n_be_reports.281_50_wizard",
            "views": [[False, "form"]],
            "target": "new",
        }

    def _generate_281_50_form(self, file_type, wizard_values):
        '''
        Main function for the creation of the 281.50 form.\n
        This function calls several functions to create a dictionary
        and send it into two templates.\n
        One template for the creation of the XML file and another one
        for the creation of the PDF file.\n
        When the two files are created, we send these files to the
        partner.\n
        :param file_type: List of tuple, could be xml, pdf or booth.
        :param wizard_values: Dictionary including some basic information
        like the reference year, if it is a test file, etc.
        :returns: An action to download form files (XML and PDF).
        '''
        reference_year = wizard_values['reference_year']

        tag_281_50_commissions = self.env.ref('l10n_be_reports.account_tag_281_50_commissions')
        tag_281_50_fees = self.env.ref('l10n_be_reports.account_tag_281_50_fees')
        tag_281_50_atn = self.env.ref('l10n_be_reports.account_tag_281_50_atn')
        tag_281_50_exposed_expenses = self.env.ref('l10n_be_reports.account_tag_281_50_exposed_expenses')
        account_281_50_tags = self.env['account.account.tag'] + tag_281_50_commissions + tag_281_50_fees + tag_281_50_atn + tag_281_50_exposed_expenses

        commissions_per_partner = self._get_balance_per_partner(tag_281_50_commissions, reference_year)
        fees_per_partner = self._get_balance_per_partner(tag_281_50_fees, reference_year)
        atn_per_partner = self._get_balance_per_partner(tag_281_50_atn, reference_year)
        exposed_expenses_per_partner = self._get_balance_per_partner(tag_281_50_exposed_expenses, reference_year)
        paid_amount_per_partner = self._get_paid_amount_per_partner(reference_year, account_281_50_tags)

        if not any([commissions_per_partner, fees_per_partner, atn_per_partner, exposed_expenses_per_partner, paid_amount_per_partner]):
            raise UserError(_('There are no accounts or partner with a 281.50 tag.'))

        partners = self.env['res.partner'].browse(set(
            list(commissions_per_partner)
            + list(fees_per_partner)
            + list(atn_per_partner)
            + list(exposed_expenses_per_partner)
            + list(paid_amount_per_partner)
        ))

        attachments = []
        for partner in partners:
            partner._check_required_values()

            partner_remunerations = {
                'commissions': commissions_per_partner.get(partner.id, 0.0),
                'fees': fees_per_partner.get(partner.id, 0.0),
                'atn': atn_per_partner.get(partner.id, 0.0),
                'exposed_expenses': exposed_expenses_per_partner.get(partner.id, 0.0),
            }
            paid_amount = paid_amount_per_partner.get(partner.id, 0.0)

            partner_information = partner._get_partner_information(partner_remunerations, paid_amount)
            values_dict = partner._generate_codes_values(wizard_values, partner_information)

            file_name = f'{partner.name}_{reference_year}_281_50'
            if wizard_values.get('is_test'):
                file_name += '_test'
            if 'xml' in file_type:
                values_dict_amount_formatted = {k: format_if_float(v) for k, v in values_dict.items()}
                attachments.append((f'{file_name}.xml', partner._generate_281_50_xml(values_dict_amount_formatted)))
            if 'pdf' in file_type:
                attachments.append((f'{file_name}.pdf', partner._generate_281_50_pdf(values_dict)))

        if len(attachments) > 1: # If there are more than one file, we zip all these files.
            downloaded_filename = f'281_50_forms_{reference_year}.zip'
            with tempfile.SpooledTemporaryFile() as tmp_file: # We store the zip into a temporary file.
                with zipfile.ZipFile(tmp_file, 'w', zipfile.ZIP_DEFLATED) as archive: # We create the zip archive.
                    for attach in attachments: # And we store each file in the archive.
                        archive.writestr(attach[0], attach[1])
                tmp_file.seek(0)
                partners.form_file = base64.b64encode(tmp_file.read())
        else: # If there is only one file, we download the file directly.
            downloaded_filename = attachments[0][0]
            partners.form_file = base64.b64encode(attachments[0][1])

        return {
            'type': 'ir.actions.act_url',
            'name': 'Download 281.50 Form',
            'url': f'/web/content/res.partner/{partners[0].id}/form_file/{downloaded_filename}?download=true'
        }

    def _generate_281_50_xml(self, values_dict):
        '''
        Function to create the XML file.\n
        :param: values_dict All information about the partner
        :return: A XML file
        '''
        self.ensure_one()
        partner_id = self.parent_id and self.parent_id.id or self.id
        xml, dummy = self.env.ref('l10n_be_reports.action_report_partner_281_50_xml')._render_qweb_text(partner_id, values_dict)
        xml_element = etree.fromstring(xml)
        xml_file = etree.tostring(xml_element, xml_declaration=True, encoding='utf-8') # Well format the xml and add the xml_declaration
        return xml_file

    def _generate_281_50_pdf(self, values_dict):
        '''
        Function to create the PDF file.\n
        :param: values_dict All information about the partner
        :return: A PDF file
        '''
        self.ensure_one()
        partner_id = self.parent_id and self.parent_id.id or self.id
        pdf_file, dummy = self.env.ref('l10n_be_reports.action_report_partner_281_50_pdf').sudo()._render_qweb_pdf(partner_id, values_dict)
        return pdf_file

    def _check_required_values(self):
        '''
        This functions verifies that some fields on the company and on the user are set.\n
        Company's fields:\n
        - Street\n
        - Zip Code\n
        - City\n
        - Phone number\n
        - VAT number\n
        User's fields:\n
        - Street\n
        - Zip\n
        - Citizen id or VAT number\n
        '''
        self.ensure_one()
        current_company = self.env.company
        if not (current_company.street and current_company.zip and current_company.city and current_company.phone and current_company.vat):
            raise UserError(_("Your company is not correctly configured. Please be sure that the following pieces of information are set: street, zip, city, phone and vat"))
        if not self.parent_id:
            if not (self.street and self.zip and (self.citizen_identification or self.vat)):
                raise UserError(_(
                    "The partner %(partner_name)s is not correctly configured. "
                    "Please be sure that the following pieces of information are set: "
                    "street, zip code and vat.",
                    partner_name=self.name,
                ))
        elif not (self.parent_id.street and self.parent_id.zip and self.parent_id.vat):
            raise UserError(_("Partner %s is not correctly configured. Please be sure that the following pieces of information are set: street, zip code and vat.", self.parent_id.name))

    def _generate_codes_values(self, wizard_values, partner_information):
        '''
        This function generates a big dictionary including all information
        about the partner.\n
        :param: wizard_values Some basics information like the reference year, etc.
        :param: partner_information Information about the partner like his name,
        his VAT number, etc.
        :return: A dictionary with all information for the creation of the XML and PDF file.
        '''
        self.ensure_one()
        current_company = self.env.company

        sum_control = sum([
            partner_information.get('remunerations')['commissions'],
            partner_information.get('remunerations')['fees'],
            partner_information.get('remunerations')['atn'],
            partner_information.get('remunerations')['exposed_expenses'],
            partner_information.get('total_amount'),
            partner_information.get('paid_amount'),
        ])
        sender_bce_number = income_debtor_bce_number = _vat_to_bce(current_company.vat)
        is_partner_from_belgium = partner_information.get('country_code') == 'BE'

        return {
            # V0XXX: info about the sender and the sending
            'V0002': wizard_values.get('reference_year'),
            'V0010': wizard_values.get('is_test') and 'BELCOTST' or 'BELCOTAX',
            'V0011': fields.Date.today().strftime('%d-%m-%Y'),
            'V0014': current_company.name,
            'V0015': f"{current_company.street}, {(current_company.street2 or '')}",
            'V0016': current_company.zip,
            'V0017': current_company.city,
            'V0018': current_company.phone.replace(" ", ""),
            'V0021': self.env.user.name,
            'V0022': current_company.partner_id._get_lang_code(),
            'V0023': self.env.user.email,
            'V0024': sender_bce_number,
            'V0025': wizard_values.get('type_sending'),
            # A1XXX: info for this declaration
            'A1002': wizard_values.get('reference_year'),
            'A1005': income_debtor_bce_number,
            'A1011': current_company.name,
            'A1013': current_company.street + (current_company.street2 or ''),
            'A1014': current_company.zip,
            'A1015': current_company.city,
            'A1016': ONSS_COUNTRY_CODE_MAPPING.get(current_company.country_id.code),
            'A1020': 1,  # language code for field 1011 to 1013 and 1015
            # F2XXX: info for this 281.XX tax form
            'F2002': wizard_values.get('reference_year'),
            'F2005': income_debtor_bce_number,
            'F2008': 28150,  # fiche type
            'F2009': 0,  # id number of this fiche for this beneficiary
            'F2013': partner_information.get('name'),
            'F2015': partner_information.get('address'),
            'F2016': partner_information.get('zip') if is_partner_from_belgium else '',
            'F2017': partner_information.get('city'),
            'F2028': wizard_values.get('type_treatment'),  # fiche treatment: 0 -> ordinary, 1 -> modification, 2 -> adding, 3 -> cancellation
            'F2029': 0,
            'F2105': 0,  # birthplace
            'F2018': ONSS_COUNTRY_CODE_MAPPING.get(partner_information.get('country_code')),
            'F2018_display': partner_information.get('country_name'),
            'F2112': '' if is_partner_from_belgium else partner_information.get('zip'),
            'F2114': '',   # firstname: full name is set on F2013
            # F50_2XXX: info for this 281.50 tax form
            'F50_2030': partner_information.get('nature'),
            'F50_2031': 0 if partner_information.get('paid_amount') != 0 else 1,
            'F50_2059': sum_control,  # Total control : sum 2060 to 2088 for this 281.50 form
            'F50_2060': partner_information.get('remunerations')['commissions'],
            'F50_2061': partner_information.get('remunerations')['fees'],
            'F50_2062': partner_information.get('remunerations')['atn'],
            'F50_2063': partner_information.get('remunerations')['exposed_expenses'],
            'F50_2064': partner_information.get('total_amount'),  # Total from 2060 to 2063
            'F50_2065': partner_information.get('paid_amount'),
            'F50_2066': 0,  # irrelevant: sport remuneration
            'F50_2067': 0,  # irrelevant: manager remuneration
            'F50_2099': '',  # further comments concerning amounts from 2060 to 2067
            'F50_2103': '',  # nature of the amounts
            'F50_2107': partner_information.get('job_position'),
            'F50_2109': partner_information.get('citizen_identification'),
            'F50_2110': partner_information.get('bce_number') if is_partner_from_belgium else '',  # KBO/BCE number
            # R8XXX: controls for the declaration
            'R8002': wizard_values.get('reference_year'),
            'R8005': income_debtor_bce_number,
            'R8010': 3,  # number of record for this declaration: A1XXX, F50_2XXX, R8XXX -> 3
            'R8011': 0,
            'R8012': sum_control,  # sum of all 2059 from all 281.50 form
            # R9XXX: controls for the whole sending
            'R9002': wizard_values.get('reference_year'),
            'R9010': 3,  # from the xml validation: should be equal to the number of declaration + 2 (number of F50 + 2 ~R8010)
            'R9011': 5,  # same than previous + 2
            'R9012': 0,
            'R9013': sum_control,  # sum of all 8012
        }

    def _get_lang_code(self):
        return {
            'nl': '1',
            'fr': '2',
            'de': '3',
        }.get((self.lang or "")[:2], '2')

    def _get_partner_information(self, partner_remuneration, paid_amount):
        self.ensure_one()
        is_company_partner = not self.is_company and self.commercial_partner_id.id != self.id
        company_partner = self.commercial_partner_id
        return {
            'name':  is_company_partner and company_partner.name or self.name,
            'address': is_company_partner and (company_partner.street + (company_partner.street2 or '')) or (self.street + (self.street2 or '')),
            'country_code': is_company_partner and company_partner.country_id and company_partner.country_id.code or self.country_id.code,
            'country_name': is_company_partner and company_partner.country_id and company_partner.country_id.name or self.country_id.name,
            'zip': is_company_partner and company_partner.zip or self.zip,
            'city': is_company_partner and company_partner.city or self.city,
            'nature': (is_company_partner or self.is_company) and '2' or '1',
            'bce_number': (is_company_partner or self.is_company) and _vat_to_bce(company_partner.vat) or '',
            'remunerations': partner_remuneration,
            'paid_amount': paid_amount,
            'total_amount': sum(partner_remuneration.values()),
            'job_position': (is_company_partner or self.is_company) and '' or self.function,
            'citizen_identification': (is_company_partner or self.is_company) and '' or self.citizen_identification,
        }

    def _get_balance_per_partner(self, tag, reference_year):
        '''
        This function gets all balance (based on account.move.line)
        for each partner following some rules:\n
            - All account.move.line have an account with the "281.50 - XXXXX" tag.\n
            - All account.move.line must be between the first day and the last day\n
            of the reference year.\n
            - All account.move.line must be in a posted account.move.\n
        These information are group by partner !
        :param accounts Account: used to compute the balance (normally account with 281.50 - XXXXX tag).
        :param reference_year: The reference year.
        :return: A dict of partner_id: balance
        '''
        accounts = self.env['account.account'].search([('tag_ids', 'in', tag.ids)])
        if not accounts:
            return {}
        date_from = fields.Date().from_string(reference_year+'-01-01')
        date_to = fields.Date().from_string(reference_year+'-12-31')

        self._cr.execute('''
            SELECT line.partner_id, ROUND(SUM(line.balance), currency.decimal_places) AS balance
              FROM account_move_line line
              JOIN res_currency AS currency ON line.company_currency_id = currency.id
             WHERE line.partner_id = ANY(%(partners)s)
               AND line.account_id = ANY(%(accounts)s)
               AND line.date BETWEEN %(date_from)s AND %(date_to)s
               AND line.parent_state = 'posted'
               AND line.company_id = %(company)s
          GROUP BY line.partner_id, currency.id
        ''', {
            'partners': self.ids,
            'accounts': accounts.ids,
            'date_from': date_from,
            'date_to': date_to,
            'company': self.env.company.id,
        })
        return dict(self._cr.fetchall())

    def _get_paid_amount_per_partner(self, reference_year, tags):
        '''
        Get all paid amount for each partner for a specific year and the previous year.
        :param reference_year: The selected year
        :param tags: Which tags to get paid amount for
        :return: A dict of paid amount (for the specific year and the previous year) per partner.
        '''
        max_date_from = date_from = f'{reference_year}-01-01'
        max_date_to = date_to = f'{reference_year}-12-31'
        company_id = self.env.company.id
        self._cr.execute('''
    SELECT sub.partner_id, ROUND(SUM(sub.paid_amount), currency.decimal_places) AS paid_amount
      FROM (
           SELECT move.partner_id AS partner_id,
                  (paid_per_partner.paid_amount / SUM(move.amount_total)) * SUM(move_line.balance) AS paid_amount,
                  paid_per_partner.currency_id AS currency_id
             FROM (
                  SELECT aml1.partner_id, SUM(apr.amount) AS paid_amount, currency.id AS currency_id
                    FROM account_move_line aml1
                    JOIN account_partial_reconcile apr ON aml1.id = apr.credit_move_id
                    JOIN account_move_line aml2 ON aml2.id = apr.debit_move_id
                    JOIN res_currency currency ON aml1.company_currency_id = currency.id
                   WHERE aml1.parent_state = 'posted'
                     AND aml2.parent_state = 'posted'
                     AND aml1.company_id = %(company_id)s AND apr.max_date <= %(max_date_to)s
                     AND aml1.date BETWEEN %(date_from)s AND %(date_to)s
                GROUP BY aml1.partner_id, currency.id
                  ) AS paid_per_partner
             JOIN account_move move ON move.partner_id = paid_per_partner.partner_id
             JOIN account_move_line move_line ON move_line.move_id = move.id
             JOIN account_account_account_tag account_tag ON move_line.account_id = account_tag.account_account_id
            WHERE account_tag.account_account_tag_id = ANY (%(tag_ids)s)
              AND move.state = 'posted'
              AND move.company_id = %(company_id)s
              AND move.date BETWEEN %(date_from)s AND %(date_to)s
              AND move.partner_id = ANY(%(partner_ids)s)
         GROUP BY move.partner_id, paid_per_partner.paid_amount, paid_per_partner.currency_id
         ORDER BY move.partner_id ASC
           ) sub
      JOIN res_currency currency ON currency.id = sub.currency_id
  GROUP BY sub.partner_id, currency.id
        ''', {
            'company_id': company_id,
            'max_date_to': max_date_to,
            'date_from': date_from,
            'date_to': date_to,
            'tag_ids': tags.ids,
            'partner_ids': self.ids,
        })
        amount_per_partner_specific_year = dict(self._cr.fetchall())

        # Get all paid amount for each partner for the previous year
        # Pay attention that the SQL query is not exactly the same as above.
        date_from = f'{int(reference_year) - 1}-01-01'
        date_to = f'{int(reference_year) - 1}-12-31'
        self._cr.execute('''
    SELECT sub.partner_id, ROUND(SUM(sub.paid_amount), currency.decimal_places) AS paid_amount
      FROM (
           SELECT move.partner_id AS partner_id,
                  (paid_per_partner.paid_amount/SUM(move.amount_total)) * SUM(move_line.balance) AS paid_amount,
                  paid_per_partner.currency_id AS currency_id
             FROM (
                  SELECT aml1.partner_id, SUM(apr.amount) AS paid_amount, currency.id AS currency_id
                    FROM account_move_line aml1
                    JOIN account_partial_reconcile apr ON aml1.id = apr.credit_move_id
                    JOIN account_move_line aml2 ON aml2.id = apr.debit_move_id
                    JOIN res_currency currency ON aml1.company_currency_id = currency.id
                   WHERE aml1.parent_state = 'posted'
                     AND aml2.parent_state = 'posted'
                     AND aml1.company_id = %(company_id)s
                     AND apr.max_date BETWEEN %(max_date_from)s AND %(max_date_to)s
                     AND aml1.date BETWEEN %(date_from)s AND %(date_to)s
                GROUP BY aml1.partner_id, currency.id
                  ) AS paid_per_partner
             JOIN account_move move ON move.partner_id = paid_per_partner.partner_id
             JOIN account_move_line move_line ON move_line.move_id = move.id
             JOIN account_account_account_tag account_tag ON move_line.account_id = account_tag.account_account_id
            WHERE account_tag.account_account_tag_id = ANY(%(tag_ids)s)
              AND move.state = 'posted'
              AND move.company_id = %(company_id)s
              AND move.date BETWEEN %(date_from)s AND %(date_to)s
              AND move.partner_id = ANY(%(partner_ids)s)
         GROUP BY move.partner_id, paid_per_partner.paid_amount, paid_per_partner.currency_id
         ORDER BY move.partner_id ASC
           ) AS sub
      JOIN res_currency currency ON currency_id = currency.id
  GROUP BY sub.partner_id, currency.id
        ''', {
            'company_id': company_id,
            'max_date_from': max_date_from,
            'max_date_to': max_date_to,
            'date_from': date_from,
            'date_to': date_to,
            'tag_ids': tags.ids,
            'partner_ids': self.ids,
        })
        amount_per_partner_previous_year = dict(self._cr.fetchall())

        # Merge amount from previous year and amount from reference_year
        return Counter(amount_per_partner_specific_year) + Counter(amount_per_partner_previous_year)
