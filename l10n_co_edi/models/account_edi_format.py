# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, api, models, _
from odoo.tools.float_utils import float_compare
from odoo.tools import DEFAULT_SERVER_TIME_FORMAT
from .carvajal_request import CarvajalRequest

import pytz
import base64
from collections import defaultdict
from datetime import timedelta


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    @api.model
    def _l10n_co_edi_generate_electronic_invoice_filename(self, invoice):
        '''Generates the filename for the XML sent to Carvajal. A separate
        sequence is used because Carvajal requires the invoice number
        to only contain digits.
        '''
        SEQUENCE_CODE = 'l10n_co_edi.filename'
        IrSequence = self.env['ir.sequence'].with_company(invoice.company_id)
        invoice_number = IrSequence.next_by_code(SEQUENCE_CODE)

        # if a sequence does not yet exist for this company create one
        if not invoice_number:
            IrSequence.sudo().create({
                'name': 'Colombian electronic invoicing sequence for company %s' % invoice.company_id.id,
                'code': SEQUENCE_CODE,
                'implementation': 'no_gap',
                'padding': 10,
                'number_increment': 1,
                'company_id': invoice.company_id.id,
            })
            invoice_number = IrSequence.next_by_code(SEQUENCE_CODE)

        return 'face_{}{:0>10}{:010x}.xml'.format(invoice._l10n_co_edi_get_electronic_invoice_type(),
                                                  invoice.company_id.vat,
                                                  int(invoice_number))

    # -------------------------------------------------------------------------
    # Generation
    # -------------------------------------------------------------------------

    def _l10n_co_edi_generate_xml(self, invoice):
        '''Renders the XML that will be sent to Carvajal.'''

        def get_notas():
            '''This generates notes in a particular format. These notes are pieces
            of text that are added to the PDF in various places. |'s are
            interpreted as newlines by Carvajal. Each note is added to the
            XML as follows:

            <NOT><NOT_1>text</NOT_1></NOT>

            One might wonder why Carvajal uses this arbitrary format
            instead of some extra simple XML tags but such questions are best
            left to philosophers, not dumb developers like myself.
            '''
            def get_total_volume():
                '''Volume has to be reported in l (not e.g. ml).'''
                lines = invoice.invoice_line_ids.filtered(lambda line: line.product_uom_id.category_id == self.env.ref('uom.product_uom_categ_vol'))
                l = sum(line.product_uom_id._compute_quantity(line.quantity, self.env.ref('uom.product_uom_litre')) for line in lines)
                return int(l)

            def get_total_weight():
                '''Weight has to be reported in kg (not e.g. g).'''
                lines = invoice.invoice_line_ids.filtered(lambda line: line.product_uom_id.category_id == self.env.ref('uom.product_uom_categ_kgm'))
                kg = sum(line.product_uom_id._compute_quantity(line.quantity, self.env.ref('uom.product_uom_kgm')) for line in lines)
                return int(kg)

            def get_total_units():
                '''Units have to be reported as units (not e.g. boxes of 12).'''
                lines = invoice.invoice_line_ids.filtered(lambda line: line.product_uom_id.category_id == self.env.ref('uom.product_uom_categ_unit'))
                units = sum(line.product_uom_id._compute_quantity(line.quantity, self.env.ref('uom.product_uom_unit')) for line in lines)
                return int(units)

            withholding_amount = invoice.amount_untaxed + sum(invoice.line_ids.filtered(lambda line: line.tax_line_id and not line.tax_line_id.l10n_co_edi_type.retention).mapped('price_total'))
            amount_in_words = invoice.currency_id.with_context(lang=invoice.partner_id.lang or 'es_ES').amount_to_text(withholding_amount)
            shipping_partner = self.env['res.partner'].browse(invoice._get_invoice_delivery_partner_id())
            notas = [
                '1.-%s|%s|%s|%s|%s|%s' % (invoice.company_id.l10n_co_edi_header_gran_contribuyente or '',
                                          invoice.company_id.l10n_co_edi_header_tipo_de_regimen or '',
                                          invoice.company_id.l10n_co_edi_header_retenedores_de_iva or '',
                                          invoice.company_id.l10n_co_edi_header_autorretenedores or '',
                                          invoice.company_id.l10n_co_edi_header_resolucion_aplicable or '',
                                          invoice.company_id.l10n_co_edi_header_actividad_economica or ''),
                '2.-%s' % (invoice.company_id.l10n_co_edi_header_bank_information or '').replace('\n', '|'),
                '3.- %s' % (invoice.narration or 'N/A'),
                '6.- %s|%s' % (invoice.invoice_payment_term_id.note, amount_in_words),
                '7.- %s' % (invoice.company_id.website),
                '8.-%s|%s|%s' % (invoice.partner_id.commercial_partner_id._get_vat_without_verification_code() or '', shipping_partner.phone or '', invoice.invoice_origin or ''),
                '10.- | | | |%s' % (invoice.invoice_origin or 'N/A'),
                '11.- |%s| |%s|%s' % (get_total_units(), get_total_weight(), get_total_volume())
            ]

            return notas

        invoice = invoice.with_context(lang=invoice.partner_id.lang)

        move_lines_with_tax_type = invoice.line_ids.filtered('tax_line_id.l10n_co_edi_type')
        retention_lines = move_lines_with_tax_type.filtered(lambda move: move.tax_line_id.l10n_co_edi_type.retention)
        retention_lines_dict = defaultdict(list)
        for line in retention_lines:
            retention_lines_dict[line.tax_line_id.l10n_co_edi_type].append(line)
        regular_lines = move_lines_with_tax_type - retention_lines
        regular_lines_dict = defaultdict(list)
        for line in regular_lines:
            regular_lines_dict[line.tax_line_id.l10n_co_edi_type].append(line)

        ovt_tax_codes = ('01C', '02C', '03C')
        ovt_taxes = move_lines_with_tax_type.filtered(lambda move: move.tax_line_id.l10n_co_edi_type.code in ovt_tax_codes).tax_line_id

        invoice_type_to_ref_1 = {
            'out_invoice': 'IV',
            'out_refund': 'NC',
        }

        taxes_amount_dict = {}
        exempt_tax_dict = {}
        tax_group_covered_goods = self.env.ref('l10n_co.tax_group_covered_goods', raise_if_not_found=False)
        for line in invoice.invoice_line_ids:
            price_unit = line.price_unit * (1 - (line.discount or 0.0) / 100.0)
            taxes = line.tax_ids.compute_all(price_unit, quantity=line.quantity, currency=line.currency_id,
                                             product=line.product_id, partner=line.partner_id)
            taxes_amount_dict[line.id] = []
            for tax in taxes['taxes']:
                tax_rec = self.env['account.tax'].browse(tax['id'])
                taxes_amount_dict[line.id].append({'base': "%.2f" % tax['base'],
                                                   'tax': tax['amount'],
                                                   'code': tax_rec.l10n_co_edi_type.code,
                                                   'retention': tax_rec.l10n_co_edi_type.retention,
                                                   'rate': tax_rec.amount,
                                                   'amount_type': tax_rec.amount_type})
            if tax_group_covered_goods and tax_group_covered_goods in line.mapped('tax_ids.tax_group_id'):
                exempt_tax_dict[line.id] = True
        # The rate should indicate how many pesos is one foreign currency
        term_lines = invoice.line_ids.filtered(lambda line: line.account_id.internal_type == 'receivable')
        rate = sum(abs(term_lines.mapped('balance'))) / sum(abs(term_lines.mapped('amount_currency')))

        currency_rate = "%.2f" % rate

        withholding_amount = '%.2f' % (invoice.amount_untaxed + sum(invoice.line_ids.filtered(lambda move: move.tax_line_id and not move.tax_line_id.l10n_co_edi_type.retention).mapped('price_total')))

        # edi_type
        if invoice.move_type == 'out_refund':
            edi_type = "91"
        elif invoice.move_type == 'out_invoice' and invoice.l10n_co_edi_debit_note:
            edi_type = "92"
        else:
            edi_type = "{0:0=2d}".format(int(invoice.l10n_co_edi_type))

        # validation_time
        validation_time = fields.Datetime.now()
        validation_time = pytz.utc.localize(validation_time)
        bogota_tz = pytz.timezone('America/Bogota')
        validation_time = validation_time.astimezone(bogota_tz)
        validation_time = validation_time.strftime(DEFAULT_SERVER_TIME_FORMAT) + "-05:00"

        # description
        description_field = None
        if invoice.move_type == 'out_refund':
            description_field = 'l10n_co_edi_description_code_credit'
        if invoice.move_type == 'out_invoice' and invoice.l10n_co_edi_debit_note:
            description_field = 'l10n_co_edi_description_code_debit'
        description_code = invoice[description_field] if description_field else None
        description = dict(invoice._fields[description_field].selection).get(description_code) if description_code else None

        xml_content = self.env.ref('l10n_co_edi.electronic_invoice_xml')._render({
            'invoice': invoice,
            'edi_type': edi_type,
            'company_partner': invoice.company_id.partner_id,
            'sales_partner': invoice.user_id,
            'invoice_partner': invoice.partner_id.commercial_partner_id,
            'retention_lines_dict': retention_lines_dict,
            'regular_lines_dict': regular_lines_dict,
            'tax_types': invoice.mapped('line_ids.tax_ids.l10n_co_edi_type'),
            'exempt_tax_dict': exempt_tax_dict,
            'currency_rate': currency_rate,
            'shipping_partner': self.env['res.partner'].browse(invoice._get_invoice_delivery_partner_id()),
            'invoice_type_to_ref_1': invoice_type_to_ref_1,
            'ovt_taxes': ovt_taxes,
            'float_compare': float_compare,
            'notas': get_notas(),
            'taxes_amount_dict': taxes_amount_dict,
            'withholding_amount': withholding_amount,
            'validation_time': validation_time,
            'delivery_date': invoice.invoice_date + timedelta(1),
            'description_code': description_code,
            'description': description,
        })
        return '<?xml version="1.0" encoding="utf-8"?>'.encode() + xml_content

    def _l10n_co_post_invoice_step_1(self, invoice):
        '''Sends the xml to carvajal.
        '''
        # == Generate XML ==
        xml_filename = self._l10n_co_edi_generate_electronic_invoice_filename(invoice)
        xml = self._l10n_co_edi_generate_xml(invoice)
        attachment = self.env['ir.attachment'].create({
            'name': xml_filename,
            'res_id': invoice.id,
            'res_model': invoice._name,
            'type': 'binary',
            'datas': base64.encodebytes(xml),
            'mimetype': 'application/xml',
            'description': _('Colombian invoice UBL generated for the %s document.') % invoice.name,
        })

        # == Upload ==
        request = CarvajalRequest(invoice.company_id)
        response = request.upload(xml_filename, xml)

        if 'error' not in response:
            invoice.l10n_co_edi_transaction = response['transactionId']

            # == Chatter ==
            invoice.with_context(no_new_invoice=True).message_post(
                body=_('Electronic invoice submission succeeded. Message from Carvajal:<br/>%s', response['message']),
                attachment_ids=attachment.ids,
            )
            # Do not return the attachment because it is not signed yet.
        else:
            # Return the attachment with the error to allow debugging.
            response['attachment'] = attachment

        return response

    def _l10n_co_post_invoice_step_2(self, invoice):
        '''Checks the current status of an uploaded XML with Carvajal. It
        posts the results in the invoice chatter and also attempts to
        download a ZIP containing the official XML and PDF if the
        invoice is reported as fully validated.
        '''
        request = CarvajalRequest(invoice.company_id)
        response = request.check_status(invoice)
        if not response.get('error'):
            response['success'] = True
            invoice.l10n_co_edi_cufe_cude_ref = response['l10n_co_edi_cufe_cude_ref']

            # == Create the attachment ==
            if 'filename' in response and 'xml_file' in response:
                response['attachment'] = self.env['ir.attachment'].create({
                    'name': response['filename'],
                    'res_id': invoice.id,
                    'res_model': invoice._name,
                    'type': 'binary',
                    'datas': base64.b64encode(response['xml_file']),
                    'mimetype': 'application/xml',
                    'description': _('Colombian invoice UBL generated for the %s document.') % invoice.name,
                })

            # == Chatter ==
            invoice.with_context(no_new_invoice=True).message_post(body=response['message'], attachments=response['attachments'])

        return response

    # -------------------------------------------------------------------------
    # BUSINESS FLOW: EDI
    # -------------------------------------------------------------------------

    def _needs_web_services(self):
        # OVERRIDE
        return self.code == 'ubl_carvajal' or super()._needs_web_services()

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'ubl_carvajal':
            return super()._is_compatible_with_journal(journal)
        return journal.type == 'sale' and journal.country_code == 'CO'

    def _is_required_for_invoice(self, invoice):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'ubl_carvajal':
            return super()._is_required_for_invoice(invoice)

        # Determine on which invoices the EDI must be generated.
        return invoice.move_type in ('out_invoice', 'out_refund') and invoice.country_code == 'CO'

    def _check_move_configuration(self, move):
        # OVERRIDE
        self.ensure_one()
        edi_result = super()._check_move_configuration(move)
        if self.code != 'ubl_carvajal':
            return edi_result

        company = move.company_id
        journal = move.journal_id
        if not company.l10n_co_edi_username or not company.l10n_co_edi_password or not company.l10n_co_edi_company or \
           not company.l10n_co_edi_account:
            edi_result.append(_("Carvajal credentials are not set on the company, please go to Accounting Settings and set the credentials."))
        if not journal.l10n_co_edi_dian_authorization_number or not journal.l10n_co_edi_dian_authorization_date or \
           not journal.l10n_co_edi_dian_authorization_end_date:
            edi_result.append(_("'Resolución DIAN' fields must be set on the journal %s", journal.display_name))
        if not move.partner_id.vat:
            edi_result.append(_("You can not validate an invoice that has a partner without VAT number."))
        if not move.company_id.partner_id.l10n_co_edi_obligation_type_ids:
            edi_result.append(_("'Obligaciones y Responsabilidades' on the Customer Fiscal Data section needs to be set for the partner %s.", move.company_id.partner_id.display_name))
        if not move.partner_id.commercial_partner_id.l10n_co_edi_obligation_type_ids:
            edi_result.append(_("'Obligaciones y Responsabilidades' on the Customer Fiscal Data section needs to be set for the partner %s.", move.partner_id.commercial_partner_id.display_name))
        if (move.l10n_co_edi_type == '2' and \
                any(l.product_id and not l.product_id.l10n_co_edi_customs_code for l in move.invoice_line_ids)):
            edi_result.append(_("Every exportation product must have a customs code."))
        elif any(l.product_id and not l.product_id.default_code and \
                 not l.product_id.barcode and not l.product_id.unspsc_code_id for l in move.invoice_line_ids):
            edi_result.append(_("Every product on a line should at least have a product code (barcode, internal, UNSPSC) set."))

        if not move.company_id.partner_id.l10n_latam_identification_type_id.l10n_co_document_code:
            edi_result.append(_("The Identification Number Type on the company\'s partner should be 'NIT'."))
        if not move.partner_id.commercial_partner_id.l10n_latam_identification_type_id.l10n_co_document_code:
            edi_result.append(_("The Identification Number Type on the customer\'s partner should be 'NIT'."))

        return edi_result

    def _post_invoice_edi(self, invoices, test_mode=False):
        # OVERRIDE
        self.ensure_one()
        edi_result = super()._post_invoice_edi(invoices, test_mode=test_mode)
        if self.code != 'ubl_carvajal':
            return edi_result

        invoice = invoices  # No batching ensures that only one invoice is given as parameter
        if not invoice.l10n_co_edi_transaction:
            return {invoice: self._l10n_co_post_invoice_step_1(invoice)}
        else:
            return {invoice: self._l10n_co_post_invoice_step_2(invoice)}

    def _cancel_invoice_edi(self, invoices, test_mode=False):
        # OVERRIDE
        self.ensure_one()
        return {invoice: {'success': True} for invoice in invoices}  # By default, cancel succeeds doing nothing.
