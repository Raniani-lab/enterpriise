# -*- coding: utf-8 -*-
from collections import defaultdict
from datetime import datetime
import logging
from lxml import etree
from pytz import timezone
import re
from werkzeug.urls import url_quote_plus

from odoo import api, fields, models, Command, _
from odoo.exceptions import ValidationError, UserError
from odoo.osv import expression
from odoo.tools import frozendict
from odoo.tools.float_utils import float_is_zero
from odoo.addons.base.models.ir_qweb import keep_query

_logger = logging.getLogger(__name__)

USAGE_SELECTION = [
    ('G01', 'Acquisition of merchandise'),
    ('G02', 'Returns, discounts or bonuses'),
    ('G03', 'General expenses'),
    ('I01', 'Constructions'),
    ('I02', 'Office furniture and equipment investment'),
    ('I03', 'Transportation equipment'),
    ('I04', 'Computer equipment and accessories'),
    ('I05', 'Dices, dies, molds, matrices and tooling'),
    ('I06', 'Telephone communications'),
    ('I07', 'Satellite communications'),
    ('I08', 'Other machinery and equipment'),
    ('D01', 'Medical, dental and hospital expenses.'),
    ('D02', 'Medical expenses for disability'),
    ('D03', 'Funeral expenses'),
    ('D04', 'Donations'),
    ('D05', 'Real interest effectively paid for mortgage loans (room house)'),
    ('D06', 'Voluntary contributions to SAR'),
    ('D07', 'Medical insurance premiums'),
    ('D08', 'Mandatory School Transportation Expenses'),
    ('D09', 'Deposits in savings accounts, premiums based on pension plans.'),
    ('D10', 'Payments for educational services (Colegiatura)'),
    ('S01', "Without fiscal effects"),
]

class AccountMove(models.Model):
    _inherit = 'account.move'

    # ==== CFDI flow fields ====

    l10n_mx_edi_is_cfdi_needed = fields.Boolean(
        compute='_compute_l10n_mx_edi_is_cfdi_needed',
        store=True,
    )
    # The CFDI documents displayed on the invoice.
    # This is a many2many because a payment could pay multiple invoices.
    l10n_mx_edi_invoice_document_ids = fields.Many2many(
        comodel_name='l10n_mx_edi.document',
        relation='l10n_mx_edi_invoice_document_ids_rel',
        column1='invoice_id',
        column2='document_id',
        copy=False,
        readonly=True,
    )
    # The CFDI documents displayed on the payment.
    l10n_mx_edi_payment_document_ids = fields.One2many(
        comodel_name='l10n_mx_edi.document',
        inverse_name='move_id',
        copy=False,
        readonly=True,
    )
    # The CFDI documents for the view.
    l10n_mx_edi_document_ids = fields.One2many(
        comodel_name='l10n_mx_edi.document',
        compute='_compute_l10n_mx_edi_document_ids',
    )
    l10n_mx_edi_cfdi_state = fields.Selection(
        string="CFDI status",
        selection=[
            ('sent', 'Signed'),
            ('cancel', 'Cancelled'),
        ],
        store=True,
        copy=False,
        tracking=True,
        compute="_compute_l10n_mx_edi_cfdi_state_and_attachment",
    )
    l10n_mx_edi_cfdi_sat_state = fields.Selection(
        string="SAT status",
        selection=[
            ('valid', "Validated"),
            ('cancelled', "Cancelled"),
            ('not_found', "Not Found"),
            ('not_defined', "Not Defined"),
            ('error', "Error"),
        ],
        store=True,
        copy=False,
        tracking=True,
        compute="_compute_l10n_mx_edi_cfdi_state_and_attachment",
    )
    l10n_mx_edi_cfdi_attachment_id = fields.Many2one(
        comodel_name='ir.attachment',
        string="CFDI",
        store=True,
        copy=False,
        compute='_compute_l10n_mx_edi_cfdi_state_and_attachment',
    )
    # Technical field indicating if the "Update Payments" button needs to be displayed on invoice view.
    l10n_mx_edi_update_payments_needed = fields.Boolean(compute='_compute_l10n_mx_edi_update_payments_needed')
    # Technical field indicating if the "Force PUE" button needs to be displayed on payment view.
    l10n_mx_edi_force_pue_payment_needed = fields.Boolean(compute='_compute_l10n_mx_edi_force_pue_payment_needed')
    # Technical field indicating if the "Update SAT" button needs to be displayed on invoice/payment view.
    l10n_mx_edi_update_sat_needed = fields.Boolean(compute='_compute_l10n_mx_edi_update_sat_needed')
    l10n_mx_edi_post_time = fields.Datetime(
        string="Posted Time",
        readonly=True,
        copy=False,
        help="Keep empty to use the current México central time",
    )
    l10n_mx_edi_usage = fields.Selection(
        selection=USAGE_SELECTION,
        string="Usage",
        default='S01',
        help="Used in CFDI to express the key to the usage that will gives the receiver to this invoice. This "
             "value is defined by the customer.\nNote: It is not cause for cancellation if the key set is not the usage "
             "that will give the receiver of the document.",
    )
    l10n_mx_edi_cfdi_origin = fields.Char(
        string="CFDI Origin",
        copy=False,
        help="In some cases like payments, credit notes, debit notes, invoices re-signed or invoices that are redone "
             "due to payment in advance will need this field filled, the format is:\n"
             "Origin Type|UUID1, UUID2, ...., UUIDn.\n"
             "Where the origin type could be:\n"
             "- 01: Nota de crédito\n"
             "- 02: Nota de débito de los documentos relacionados\n"
             "- 03: Devolución de mercancía sobre facturas o traslados previos\n"
             "- 04: Sustitución de los CFDI previos\n"
             "- 05: Traslados de mercancias facturados previamente\n"
             "- 06: Factura generada por los traslados previos\n"
             "- 07: CFDI por aplicación de anticipo",
    )
    # Indicate the journal entry substituting the current cancelled one.
    # In other words, this is the reason why the current journal entry is cancelled.
    l10n_mx_edi_cfdi_cancel_id = fields.Many2one(
        comodel_name='account.move',
        string="Substituted By",
        compute='_compute_l10n_mx_edi_cfdi_cancel_id',
    )

    # ==== CFDI certificate fields ====
    l10n_mx_edi_certificate_id = fields.Many2one(
        comodel_name='l10n_mx_edi.certificate',
        string="Source Certificate")
    l10n_mx_edi_cer_source = fields.Char(
        string='Certificate Source',
        help="Used in CFDI like attribute derived from the exception of certificates of Origin of the "
             "Free Trade Agreements that Mexico has celebrated with several countries. If it has a value, it will "
             "indicate that it serves as certificate of origin and this value will be set in the CFDI node "
             "'NumCertificadoOrigen'.")

    # ==== CFDI attachment fields ====
    l10n_mx_edi_cfdi_uuid = fields.Char(
        string="Fiscal Folio",
        compute='_compute_l10n_mx_edi_cfdi_uuid',
        copy=False,
        store=True,
        help="Folio in electronic invoice, is returned by SAT when send to stamp.",
    )
    l10n_mx_edi_cfdi_supplier_rfc = fields.Char(
        string="Supplier RFC",
        compute='_compute_cfdi_values',
        help="The supplier tax identification number.",
    )
    l10n_mx_edi_cfdi_customer_rfc = fields.Char(
        string="Customer RFC",
        compute='_compute_cfdi_values',
        help="The customer tax identification number.",
    )
    l10n_mx_edi_cfdi_amount = fields.Monetary(
        string="Total Amount",
        compute='_compute_cfdi_values',
        help="The total amount reported on the cfdi.",
    )

    # ==== Other fields ====
    l10n_mx_edi_payment_method_id = fields.Many2one(
        comodel_name='l10n_mx_edi.payment.method',
        string="Payment Way",
        compute='_compute_l10n_mx_edi_payment_method_id',
        store=True,
        readonly=False,
        help="Indicates the way the invoice was/will be paid, where the options could be: "
             "Cash, Nominal Check, Credit Card, etc. Leave empty if unkown and the XML will show 'Unidentified'.",
    )
    # Indicate what kind of payment is expected to pay the current invoice.
    # PUE is for a quick payment close to the invoice date paying completely the invoice.
    # In that case, by default, you don't need to sent the payment to the SAT.
    # PPD means you have either a delay, either multiple partial payments to do.
    # In that case, the payment(s) must be sent to the SAT.
    l10n_mx_edi_payment_policy = fields.Selection(
        string="Payment Policy",
        selection=[('PPD', 'PPD'), ('PUE', 'PUE')],
        compute='_compute_l10n_mx_edi_payment_policy',
    )
    # Indicate if you send the invoice to the SAT using 'Publico En General' meaning
    # the customer is unknown by the SAT. This is mainly used when the customer doesn't have
    # a VAT number registered to the SAT.
    l10n_mx_edi_cfdi_to_public = fields.Boolean(
        string="CFDI to public",
        compute='_compute_l10n_mx_edi_cfdi_to_public',
        store=True,
        readonly=False,
        help="Send the CFDI with recipient 'publico en general'",
    )

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _l10n_mx_edi_is_cfdi_payment(self):
        self.ensure_one()
        return self.payment_id or self.statement_line_id

    def _l10n_mx_edi_cfdi_invoice_append_addenda(self, cfdi, addenda):
        ''' Append an additional block to the signed CFDI passed as parameter.
        :param move:    The account.move record.
        :param cfdi:    The invoice's CFDI as a string.
        :param addenda: (ir.ui.view) The addenda to add as a string.
        :return cfdi:   The cfdi including the addenda.
        '''
        self.ensure_one()
        addenda_values = {'record': self, 'cfdi': cfdi}

        addenda = self.env['ir.qweb']._render(addenda.id, values=addenda_values).strip()
        if not addenda:
            return cfdi

        cfdi_node = etree.fromstring(cfdi)
        addenda_node = etree.fromstring(addenda)
        version = cfdi_node.get('Version')

        # Add a root node Addenda if not specified explicitly by the user.
        if addenda_node.tag != '{http://www.sat.gob.mx/cfd/%s}Addenda' % version[0]:
            node = etree.Element(etree.QName('http://www.sat.gob.mx/cfd/%s' % version[0], 'Addenda'))
            node.append(addenda_node)
            addenda_node = node

        cfdi_node.append(addenda_node)
        return etree.tostring(cfdi_node, pretty_print=True, xml_declaration=True, encoding='UTF-8')

    def _l10n_mx_edi_cfdi_amount_to_text(self):
        """Method to transform a float amount to text words
        E.g. 100 - ONE HUNDRED
        :returns: Amount transformed to words mexican format for invoices
        :rtype: str
        """
        self.ensure_one()

        currency_name = self.currency_id.name.upper()

        # M.N. = Moneda Nacional (National Currency)
        # M.E. = Moneda Extranjera (Foreign Currency)
        currency_type = 'M.N' if currency_name == 'MXN' else 'M.E.'

        # Split integer and decimal part
        amount_i, amount_d = divmod(self.amount_total, 1)
        amount_d = round(amount_d, 2)
        amount_d = int(round(amount_d * 100, 2))

        words = self.currency_id.with_context(lang=self.partner_id.lang or 'es_ES').amount_to_text(amount_i).upper()
        return '%(words)s %(amount_d)02d/100 %(currency_type)s' % {
            'words': words,
            'amount_d': amount_d,
            'currency_type': currency_type,
        }

    @api.model
    def _l10n_mx_edi_write_cfdi_origin(self, code, uuids):
        ''' Format the code and uuids passed as parameter in order to fill the l10n_mx_edi_cfdi_origin field.
        The code corresponds to the following types:
            - 01: Nota de crédito
            - 02: Nota de débito de los documentos relacionados
            - 03: Devolución de mercancía sobre facturas o traslados previos
            - 04: Sustitución de los CFDI previos
            - 05: Traslados de mercancias facturados previamente
            - 06: Factura generada por los traslados previos
            - 07: CFDI por aplicación de anticipo

        The generated string must match the following template:
        <code>|<uuid1>,<uuid2>,...,<uuidn>

        :param code:    A valid code as a string between 01 and 07.
        :param uuids:   A list of uuids returned by the government.
        :return:        A valid string to be put inside the l10n_mx_edi_cfdi_origin field.
        '''
        return '%s|%s' % (code, ','.join(uuids))

    def _l10n_mx_edi_read_cfdi_origin(self):
        self.ensure_one()
        cfdi_origin = self.l10n_mx_edi_cfdi_origin
        splitted = cfdi_origin.split('|')
        if len(splitted) != 2:
            return False

        try:
            code = int(splitted[0])
        except ValueError:
            return False

        if code < 1 or code > 7:
            return False
        return splitted[0], [uuid.strip() for uuid in splitted[1].split(',')]

    def _l10n_mx_edi_get_extra_common_report_values(self):
        self.ensure_one()
        cfdi_infos = self.env['l10n_mx_edi.document']._decode_cfdi_attachment(self.l10n_mx_edi_cfdi_attachment_id.raw)
        if not cfdi_infos:
            return {}

        barcode_value_params = keep_query(
            re=cfdi_infos['supplier_rfc'],
            rr=cfdi_infos['customer_rfc'],
            tt=cfdi_infos['amount_total'],
            id=cfdi_infos['uuid'],
        )
        barcode_sello = url_quote_plus(cfdi_infos['sello'][-8:], safe='=/').replace('%2B', '+')
        barcode_value = url_quote_plus(f'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?{barcode_value_params}&fe={barcode_sello}')
        barcode_src = f'/report/barcode/?barcode_type=QR&value={barcode_value}&width=180&height=180'

        return {
            **cfdi_infos,
            'barcode_src': barcode_src,
        }

    def _l10n_mx_edi_get_extra_invoice_report_values(self):
        """ Collect extra values used to render the invoice PDF report containing CFDI information.

        :return: A python dictionary.
        """
        self.ensure_one()
        cfdi_infos = self._l10n_mx_edi_get_extra_common_report_values()
        if not cfdi_infos:
            return cfdi_infos

        payment_way = cfdi_infos['cfdi_node'].attrib.get('FormaPago')
        if payment_way:
            payment_method = self.env['l10n_mx_edi.payment.method'].search([('code', '=', payment_way)])
            cfdi_infos['payment_way'] = f'{payment_way} - {payment_method.name}'

        return cfdi_infos

    def _l10n_mx_edi_get_extra_payment_report_values(self):
        """ Collect extra values used to render the payment PDF report containing CFDI information.

        :return: A python dictionary.
        """
        self.ensure_one()
        cfdi_infos = self._l10n_mx_edi_get_extra_common_report_values()
        if not cfdi_infos:
            return cfdi_infos

        node = cfdi_infos['cfdi_node'].xpath("//*[local-name()='Pago']")[0]
        payment_info = cfdi_infos['payment_info'] = {}
        if node.attrib.get('RfcEmisorCtaOrd'):
            payment_info['from_account_vat'] = node.attrib['RfcEmisorCtaOrd']
        if node.attrib.get('NomBancoOrdExt'):
            payment_info['from_account_name'] = node.attrib['NomBancoOrdExt']
        if node.attrib.get('CtaOrdenante'):
            payment_info['from_account_number'] = node.attrib['CtaOrdenante']
        if node.attrib.get('RfcEmisorCtaBen'):
            payment_info['to_account_vat'] = node.attrib['RfcEmisorCtaBen']
        if node.attrib.get('CtaBeneficiario'):
            payment_info['to_account_number'] = node.attrib['CtaBeneficiario']

        related_invoices = cfdi_infos['invoices'] = []
        uuids = []
        for node in cfdi_infos['cfdi_node'].xpath("//*[local-name()='DoctoRelacionado']"):
            uuids.append(node.attrib['IdDocumento'])
            related_invoices.append({
                'uuid': node.attrib['IdDocumento'],
                'partiality': node.attrib['NumParcialidad'],
                'previous_balance': float(node.attrib['ImpSaldoAnt']),
                'amount_paid': float(node.attrib['ImpPagado']),
                'balance': float(node.attrib['ImpSaldoInsoluto']),
                'currency': node.attrib['MonedaDR'],
            })
        invoices = self.env['account.move'].search([('l10n_mx_edi_cfdi_uuid', 'in', uuids)])
        invoices_map = {x.l10n_mx_edi_cfdi_uuid: x for x in invoices}
        for invoice_values in related_invoices:
            invoice_values['invoice'] = invoices_map.get(invoice_values['uuid'], self.env['account.move'])

        return cfdi_infos

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('country_code')
    def _compute_amount_total_words(self):
        # EXTENDS 'account'
        super()._compute_amount_total_words()
        for move in self:
            if move.country_code == 'MX':
                move.amount_total_words = move._l10n_mx_edi_cfdi_amount_to_text()

    @api.depends('move_type', 'company_currency_id', 'payment_id', 'statement_line_id')
    def _compute_l10n_mx_edi_is_cfdi_needed(self):
        """ Check whatever or not the CFDI is needed on this invoice.
        """
        for move in self:
            move.l10n_mx_edi_is_cfdi_needed = \
                move.country_code == 'MX' \
                and move.company_currency_id.name == 'MXN' \
                and (move.move_type in ('out_invoice', 'out_refund') or move._l10n_mx_edi_is_cfdi_payment())

    @api.depends('l10n_mx_edi_invoice_document_ids.state', 'l10n_mx_edi_invoice_document_ids.sat_state',
                 'l10n_mx_edi_payment_document_ids.state', 'l10n_mx_edi_payment_document_ids.sat_state')
    def _compute_l10n_mx_edi_document_ids(self):
        for move in self:
            if move.is_invoice():
                move.l10n_mx_edi_document_ids = [Command.set(move.l10n_mx_edi_invoice_document_ids.ids)]
            elif move._l10n_mx_edi_is_cfdi_payment():
                move.l10n_mx_edi_document_ids = [Command.set(move.l10n_mx_edi_payment_document_ids.ids)]
            else:
                move.l10n_mx_edi_document_ids = [Command.clear()]

    @api.depends('l10n_mx_edi_invoice_document_ids.state', 'l10n_mx_edi_invoice_document_ids.sat_state',
                 'l10n_mx_edi_payment_document_ids.state', 'l10n_mx_edi_payment_document_ids.sat_state')
    def _compute_l10n_mx_edi_cfdi_state_and_attachment(self):
        for move in self:
            move.l10n_mx_edi_cfdi_sat_state = None
            move.l10n_mx_edi_cfdi_state = None
            move.l10n_mx_edi_cfdi_attachment_id = None
            if move.is_invoice():
                for doc in move.l10n_mx_edi_invoice_document_ids.sorted():
                    if doc.state == 'invoice_sent':
                        move.l10n_mx_edi_cfdi_sat_state = doc.sat_state
                        move.l10n_mx_edi_cfdi_state = 'sent'
                        move.l10n_mx_edi_cfdi_attachment_id = doc.attachment_id
                        break
                    elif doc.state == 'invoice_cancel':
                        move.l10n_mx_edi_cfdi_sat_state = doc.sat_state
                        move.l10n_mx_edi_cfdi_state = 'cancel'
                        break
            elif move._l10n_mx_edi_is_cfdi_payment():
                for doc in move.l10n_mx_edi_payment_document_ids.sorted():
                    if doc.state == 'payment_sent':
                        move.l10n_mx_edi_cfdi_sat_state = doc.sat_state
                        move.l10n_mx_edi_cfdi_state = 'sent'
                        move.l10n_mx_edi_cfdi_attachment_id = doc.attachment_id
                        break
                    elif doc.state == 'payment_cancel':
                        move.l10n_mx_edi_cfdi_sat_state = doc.sat_state
                        move.l10n_mx_edi_cfdi_state = 'cancel'
                        break

    @api.depends('l10n_mx_edi_invoice_document_ids.state')
    def _compute_l10n_mx_edi_update_payments_needed(self):
        payments_diff = self._origin\
            .with_context(bin_size=False)\
            ._l10n_mx_edi_cfdi_invoice_get_payments_diff()
        for move in self:
            move.l10n_mx_edi_update_payments_needed = bool(
                move in payments_diff['to_remove']
                or move in payments_diff['need_update']
                or payments_diff['to_process']
            )

    @api.depends('l10n_mx_edi_payment_document_ids.state')
    def _compute_l10n_mx_edi_force_pue_payment_needed(self):
        for move in self:
            force_pue = False
            if move._l10n_mx_edi_is_cfdi_payment() and not move.l10n_mx_edi_cfdi_state:
                for doc in move.l10n_mx_edi_payment_document_ids.sorted():
                    if doc.state == 'payment_sent_pue':
                        force_pue = True
                        break
            move.l10n_mx_edi_force_pue_payment_needed = force_pue

    @api.depends('l10n_mx_edi_invoice_document_ids.state')
    def _compute_l10n_mx_edi_update_sat_needed(self):
        for move in self:
            if move.is_invoice():
                documents = move.l10n_mx_edi_invoice_document_ids
            elif move._l10n_mx_edi_is_cfdi_payment():
                documents = move.l10n_mx_edi_payment_document_ids
            else:
                move.l10n_mx_edi_update_sat_needed = False
                continue
            move.l10n_mx_edi_update_sat_needed = bool(documents.filtered_domain(
                expression.OR(self.env['l10n_mx_edi.document']._get_update_sat_status_domains())
            ))

    @api.depends('l10n_mx_edi_cfdi_attachment_id')
    def _compute_l10n_mx_edi_cfdi_uuid(self):
        '''Fill the invoice fields from the cfdi values.
        '''
        for move in self:
            if move.l10n_mx_edi_cfdi_attachment_id:
                cfdi_infos = self.env['l10n_mx_edi.document']._decode_cfdi_attachment(move.l10n_mx_edi_cfdi_attachment_id.raw)
                move.l10n_mx_edi_cfdi_uuid = cfdi_infos.get('uuid')
            else:
                move.l10n_mx_edi_cfdi_uuid = None

    @api.depends('l10n_mx_edi_cfdi_attachment_id', 'l10n_mx_edi_cfdi_state')
    def _compute_cfdi_values(self):
        '''Fill the invoice fields from the cfdi values.
        '''
        for move in self:
            cfdi_infos = self.env['l10n_mx_edi.document']._decode_cfdi_attachment(move.l10n_mx_edi_cfdi_attachment_id.raw)
            move.l10n_mx_edi_cfdi_supplier_rfc = cfdi_infos.get('supplier_rfc')
            move.l10n_mx_edi_cfdi_customer_rfc = cfdi_infos.get('customer_rfc')
            move.l10n_mx_edi_cfdi_amount = cfdi_infos.get('amount_total')

    @api.depends('move_type', 'invoice_date_due', 'invoice_date', 'invoice_payment_term_id')
    def _compute_l10n_mx_edi_payment_policy(self):
        for move in self:
            if move.is_invoice(include_receipts=True) \
                and move.l10n_mx_edi_is_cfdi_needed \
                and move.invoice_date_due \
                and move.invoice_date:
                if move.move_type == 'out_invoice':
                    # In CFDI 3.3 - rule 2.7.1.43 which establish that
                    # invoice payment term should be PPD as soon as the due date
                    # is after the last day of  the month (the month of the invoice date).
                    if move.invoice_date_due.month > move.invoice_date.month or \
                       move.invoice_date_due.year > move.invoice_date.year or \
                       len(move.invoice_payment_term_id.line_ids) > 1:  # to be able to force PPD
                        move.l10n_mx_edi_payment_policy = 'PPD'
                    else:
                        move.l10n_mx_edi_payment_policy = 'PUE'
                else:
                    move.l10n_mx_edi_payment_policy = 'PUE'
            else:
                move.l10n_mx_edi_payment_policy = False

    @api.depends('l10n_mx_edi_is_cfdi_needed', 'partner_id')
    def _compute_l10n_mx_edi_cfdi_to_public(self):
        for move in self:
            if move.l10n_mx_edi_cfdi_to_public:
                move.l10n_mx_edi_cfdi_to_public = True
            elif move.l10n_mx_edi_is_cfdi_needed and move.partner_id:
                customer_values = move._l10n_mx_edi_get_customer_cfdi_values(move.partner_id)
                move.l10n_mx_edi_cfdi_to_public = customer_values['rfc'] == 'XAXX010101000'
            else:
                move.l10n_mx_edi_cfdi_to_public = False

    @api.depends('journal_id', 'statement_line_id')
    def _compute_l10n_mx_edi_payment_method_id(self):
        for move in self:
            if move.l10n_mx_edi_payment_method_id:
                move.l10n_mx_edi_payment_method_id = move.l10n_mx_edi_payment_method_id
            elif move.statement_line_id:
                move.l10n_mx_edi_payment_method_id = self.env.ref('l10n_mx_edi.payment_method_transferencia', raise_if_not_found=False)
            elif move.journal_id.l10n_mx_edi_payment_method_id:
                move.l10n_mx_edi_payment_method_id = move.journal_id.l10n_mx_edi_payment_method_id
            else:
                move.l10n_mx_edi_payment_method_id = self.env.ref('l10n_mx_edi.payment_method_otros', raise_if_not_found=False)

    @api.depends('l10n_mx_edi_cfdi_uuid')
    def _compute_l10n_mx_edi_cfdi_cancel_id(self):
        for move in self:
            if move.company_id and move.l10n_mx_edi_cfdi_uuid:
                move.l10n_mx_edi_cfdi_cancel_id = move.search(
                    [
                        ('l10n_mx_edi_cfdi_origin', '=like', f'04|{move.l10n_mx_edi_cfdi_uuid}%'),
                        ('company_id', '=', move.company_id.id)
                    ],
                    limit=1,
                )
            else:
                move.l10n_mx_edi_cfdi_cancel_id = None


    # -------------------------------------------------------------------------
    # CONSTRAINTS
    # -------------------------------------------------------------------------

    @api.constrains('l10n_mx_edi_cfdi_origin')
    def _check_l10n_mx_edi_cfdi_origin(self):
        error_message = _(
            "The following CFDI origin %s is invalid and must match the "
            "<code>|<uuid1>,<uuid2>,...,<uuidn> template.\n"
            "Here are the specification of this value:\n"
            "- 01: Nota de crédito\n"
            "- 02: Nota de débito de los documentos relacionados\n"
            "- 03: Devolución de mercancía sobre facturas o traslados previos\n"
            "- 04: Sustitución de los CFDI previos\n"
            "- 05: Traslados de mercancias facturados previamente\n"
            "- 06: Factura generada por los traslados previos\n"
            "- 07: CFDI por aplicación de anticipo\n"
            "For example: 01|89966ACC-0F5C-447D-AEF3-3EED22E711EE,89966ACC-0F5C-447D-AEF3-3EED22E711EE"
        )

        for move in self:
            if not move.l10n_mx_edi_cfdi_origin:
                continue

            # This method
            decoded_origin = move._l10n_mx_edi_read_cfdi_origin()
            if not decoded_origin:
                raise ValidationError(error_message % move.l10n_mx_edi_cfdi_origin)

    # -------------------------------------------------------------------------
    # CFDI: HELPERS
    # -------------------------------------------------------------------------

    def _get_l10n_mx_edi_issued_address(self):
        self.ensure_one()
        return self.company_id.partner_id.commercial_partner_id

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def _post(self, soft=True):
        # OVERRIDE
        certificate_date = self.env['l10n_mx_edi.certificate'].sudo().get_mx_current_datetime()

        for move in self:

            issued_address = move._get_l10n_mx_edi_issued_address()
            tz = issued_address._l10n_mx_edi_get_cfdi_timezone()
            tz_force = self.env['ir.config_parameter'].sudo().get_param('l10n_mx_edi_tz_%s' % move.journal_id.id, default=None)
            if tz_force:
                tz = timezone(tz_force)

            move.l10n_mx_edi_post_time = fields.Datetime.to_string(datetime.now(tz)) # TODO: issue on demo data

            # Assign time and date coming from a certificate.
            if move.is_invoice() and move.l10n_mx_edi_is_cfdi_needed and not move.invoice_date:
                move.invoice_date = certificate_date.date()

        return super()._post(soft=soft)

    def button_draft(self):
        # OVERRIDE
        for move in self:
            if move.l10n_mx_edi_cfdi_uuid:
                move.l10n_mx_edi_cfdi_origin = move._l10n_mx_edi_write_cfdi_origin('04', [move.l10n_mx_edi_cfdi_uuid])

        return super().button_draft()

    def _need_cancel_request(self):
        # EXTENDS 'account'
        return (
            super()._need_cancel_request()
            or (self.l10n_mx_edi_cfdi_state == 'sent' and self.l10n_mx_edi_cfdi_attachment_id)
        )

    def button_request_cancel(self):
        # EXTENDS 'account'
        super().button_request_cancel()
        self._l10n_mx_edi_cfdi_invoice_try_cancel()
        self._l10n_mx_edi_cfdi_payment_try_cancel()

    def _reverse_moves(self, default_values_list=None, cancel=False):
        # OVERRIDE
        # The '01' code is used to indicate the document is a credit note.
        if not default_values_list:
            default_values_list = [{}] * len(self)

        for default_vals, move in zip(default_values_list, self):
            if move.l10n_mx_edi_cfdi_uuid:
                default_vals['l10n_mx_edi_cfdi_origin'] = move._l10n_mx_edi_write_cfdi_origin('01', [move.l10n_mx_edi_cfdi_uuid])
        return super()._reverse_moves(default_values_list, cancel=cancel)

    @api.model
    def get_invoice_localisation_fields_required_to_invoice(self, country_id):
        res = super().get_invoice_localisation_fields_required_to_invoice(country_id)
        if country_id.code == 'MX':
            res.extend([self.env['ir.model.fields']._get(self._name, 'l10n_mx_edi_usage')])
        return res

    # -------------------------------------------------------------------------
    # CFDI Generation: Generic
    # -------------------------------------------------------------------------

    @api.model
    def _l10n_mx_edi_cfdi_clean_to_legal_name(self, value):
        """ We remove the SA de CV / SL de CV / S de RL de CV as they are never in the official name in the XML.

        :param value: The value to clean.
        :return: The formatted value.
        """
        regex = r"(?i:\s+(s\.?\s?(a\.?)( de c\.?v\.?|)|(s\.?\s?(a\.?s\.?)|s\.? en c\.?( por a\.?)?|s\.?\s?c\.?\s?(l\.?(\s?\(?limitada)?\)?|s\.?(\s?\(?suplementada\)?)?)|s\.? de r\.?l\.?)))\s*$"
        return re.sub(regex, "", value).upper()

    def _l10n_mx_edi_get_customer_cfdi_values(self, partner, to_public=False):
        self.ensure_one()
        customer = partner if partner.type == 'invoice' else partner.commercial_partner_id
        supplier = self.company_id.partner_id.commercial_partner_id
        issued_address = self._get_l10n_mx_edi_issued_address()

        if not customer or customer.country_id.code != 'MX':
            customer_values = {
                'to_public': True,
                'rfc': "XEXX010101000",
                'nombre': self._l10n_mx_edi_cfdi_clean_to_legal_name(customer.name),
                'residencia_fiscal': None,
                'domicilio_fiscal_receptor': issued_address.zip or supplier.zip,
                'regimen_fiscal_receptor': '616',
                'uso_cfdi': 'S01',
            }
        elif to_public or not customer.country_id:
            customer_values = {
                'to_public': True,
                'rfc': "XAXX010101000",
                'nombre': "PUBLICO EN GENERAL",
                'residencia_fiscal': None,
                'domicilio_fiscal_receptor': issued_address.zip or supplier.zip,
                'regimen_fiscal_receptor': '616',
                'uso_cfdi': 'S01',
            }
        else:
            customer_values = {
                'to_public': False,
                'rfc': customer.vat.strip() if customer.vat else None,
                'nombre': self._l10n_mx_edi_cfdi_clean_to_legal_name(customer.name),
                'domicilio_fiscal_receptor': customer.zip,
                'regimen_fiscal_receptor': customer.l10n_mx_edi_fiscal_regime or '616',
                'uso_cfdi': self.l10n_mx_edi_usage if self.l10n_mx_edi_usage != 'P01' else 'S01',
            }
            if customer.country_id.l10n_mx_edi_code == 'MEX':
                customer_values['residencia_fiscal'] = None
            else:
                customer_values['residencia_fiscal'] = customer.country_id.l10n_mx_edi_code

        customer_values['customer'] = customer
        customer_values['issued_address'] = issued_address
        return customer_values

    def _l10n_mx_edi_get_common_cfdi_values(self):
        ''' Generic values to generate a cfdi for a journal entry.
        :param move:    The account.move record to which generate the CFDI.
        :return:        A python dictionary.
        '''
        self.ensure_one()

        company = self.company_id
        certificate = company.l10n_mx_edi_certificate_ids.sudo()._get_valid_certificate()
        currency_precision = self.currency_id.l10n_mx_edi_decimal_places
        supplier = self.company_id.partner_id.commercial_partner_id

        def format_string(text, size):
            """ Replace from text received the characters that are not found in the regex. This regex is taken from SAT
            documentation: https://goo.gl/C9sKH6
            Ex. 'Product ABC (small size)' - 'Product ABC small size'

            :param text: Text to format.
            :param size: The maximum size of the string
            """
            if not text:
                return None
            text = text.replace('|', ' ')
            return text.strip()[:size]

        def format_float(amount, precision=currency_precision):
            if amount is None or amount is False:
                return None
            # Avoid things like -0.0, see: https://stackoverflow.com/a/11010869
            return '%.*f' % (precision, amount if not float_is_zero(amount, precision_digits=precision) else 0.0)

        results = {
            'certificate': certificate,
            'format_string': format_string,
            'format_float': format_float,
            'currency_precision': currency_precision,

            'no_certificado': certificate.serial_number,
            'certificado': certificate.sudo()._get_data()[0].decode('utf-8'),
        }

        # Folio / Serie.
        name_numbers = list(re.finditer(r'\d+', self.name))
        results['folio'] = name_numbers[-1].group().lstrip('0')
        results['serie'] = self.name[:name_numbers[-1].start()]

        # Origin of the document.
        if self.l10n_mx_edi_cfdi_origin:
            origin_type, origin_uuids = self._l10n_mx_edi_read_cfdi_origin()
        else:
            origin_type = None
            origin_uuids = []
        results['tipo_relacion'] = origin_type
        results['cfdi_relationado_list'] = origin_uuids

        # Supplier.
        results['emisor'] = {
            'supplier': supplier,
            'rfc': supplier.vat,
            'nombre': self._l10n_mx_edi_cfdi_clean_to_legal_name(self.company_id.name),
            'regimen_fiscal': self.company_id.l10n_mx_edi_fiscal_regime,
        }

        return results

    # -------------------------------------------------------------------------
    # CFDI Generation: Invoices
    # -------------------------------------------------------------------------

    def _l10n_mx_edi_cfdi_check_invoice_config(self):
        """ Prepare the CFDI xml for the invoice. """
        self.ensure_one()
        errors = []

        # == Check the 'l10n_mx_edi_decimal_places' field set on the currency  ==
        currency_precision = self.currency_id.l10n_mx_edi_decimal_places
        if currency_precision is False:
            errors.append(_(
                "The SAT does not provide information for the currency %s.\n"
                "You must get manually a key from the PAC to confirm the "
                "currency rate is accurate enough.",
                self.currency_id,
            ))

        # == Check the invoice ==
        negative_lines = self.invoice_line_ids.filtered(lambda line: line.price_subtotal < 0)
        if negative_lines:
            # Line having a negative amount is not allowed.
            if not self._l10n_mx_edi_is_managing_invoice_negative_lines_allowed():
                errors.append(_(
                    "Invoice lines having a negative amount are not allowed to generate the CFDI. "
                    "Please create a credit note instead.",
                ))
            # Discount line without taxes is not allowed.
            if negative_lines.filtered(lambda line: not line.tax_ids):
                errors.append(_(
                    "Invoice lines having a negative amount without a tax set is not allowed to "
                    "generate the CFDI.",
                ))
        invalid_unspcs_products = self.invoice_line_ids.product_id.filtered(lambda product: not product.unspsc_code_id)
        if invalid_unspcs_products:
            errors.append(_(
                "You need to define an 'UNSPSC Product Category' on the following products: %s",
                ', '.join(invalid_unspcs_products.mapped('display_name')),
            ))
        return errors

    @api.model
    def _l10n_mx_edi_is_managing_invoice_negative_lines_allowed(self):
        """ Negative lines are not allowed by the Mexican government making some features unavailable like sale_coupon
        or global discounts. This method allows odoo to distribute the negative discount lines to each others making
        such features available even for Mexican people.

        :return: True if odoo needs to distribute the negative discount lines, False otherwise.
        """
        param_name = 'l10n_mx_edi.manage_invoice_negative_lines'
        return bool(self.env['ir.config_parameter'].sudo().get_param(param_name))

    def _l10n_mx_edi_invoice_cfdi_preprocess_lines(self, tax_details_transferred, tax_details_withholding):
        """ Decode the current invoice lines into dictionaries and try to distribute the negative ones across the
        others since negative lines are not allowed in the CFDI.

        :param tax_details_transferred: The computed taxes results for transferred taxes.
        :param tax_details_withholding: The computed taxes results for withholding taxes.
        :return: A list of dictionaries representing the invoice lines values to consider for the CFDI.
        """
        self.ensure_one()

        prepared_line_values_list = []
        for line in self.invoice_line_ids.filtered(lambda line: line.display_type == 'product'):

            if line.discount == 100.0:
                gross_price_subtotal_before_discount = line.currency_id.round(line.price_unit * line.quantity)
            else:
                gross_price_subtotal_before_discount = line.currency_id.round(line.price_subtotal / (1 - line.discount / 100.0))

            discount = gross_price_subtotal_before_discount - line.price_subtotal

            line_values = {
                'line': line,
                'gross_price_subtotal': gross_price_subtotal_before_discount,
                'discount': discount,
            }

            # Taxes.
            line_values['transferred_values_list'] = transferred_values_list = []
            for tax_details in tax_details_transferred['tax_details_per_record'][line]['tax_details'].values():
                tax_values = {
                    'base': tax_details['base_amount_currency'],
                    'importe': tax_details['tipo_factor'] != 'Exento' and tax_details['tax_amount_currency'],
                    'impuesto': tax_details['impuesto'],
                    'tipo_factor': tax_details['tipo_factor'],
                }

                if tax_details['tipo_factor'] != 'Exento' and line.currency_id.is_zero(tax_values['importe']):
                    continue

                if tax_details['tipo_factor'] == 'Tasa':
                    tax_values['tasa_o_cuota'] = tax_details['tax_amount_field'] / 100.0
                elif tax_details['tipo_factor'] == 'Cuota':
                    tax_values['tasa_o_cuota'] = tax_values['importe'] / tax_values['base']
                else:
                    tax_values['tasa_o_cuota'] = None

                transferred_values_list.append(tax_values)

            line_values['withholding_values_list'] = withholding_values_list = []
            for tax_details in tax_details_withholding['tax_details_per_record'][line]['tax_details'].values():
                tax_values = {
                    'base': tax_details['base_amount_currency'],
                    'importe': tax_details['tipo_factor'] != 'Exento' and -tax_details['tax_amount_currency'],
                    'impuesto': tax_details['impuesto'],
                    'tipo_factor': tax_details['tipo_factor'],
                }

                if tax_details['tipo_factor'] != 'Exento' and line.currency_id.is_zero(tax_values['importe']):
                    continue

                if tax_details['tipo_factor'] == 'Tasa':
                    tax_values['tasa_o_cuota'] = -tax_details['tax_amount_field'] / 100.0
                elif tax_details['tipo_factor'] == 'Cuota':
                    tax_values['tasa_o_cuota'] = tax_values['importe'] / tax_values['base']
                else:
                    tax_values['tasa_o_cuota'] = None

                withholding_values_list.append(tax_values)

            prepared_line_values_list.append(line_values)

        if not self._l10n_mx_edi_is_managing_invoice_negative_lines_allowed():
            return prepared_line_values_list

        to_distribute = []
        distributed_lines = set()
        to_keep = []
        for line_values in prepared_line_values_list:
            if line_values['line'].price_subtotal < 0.0:
                to_distribute.append(line_values)
            else:
                to_keep.append(line_values)

        # Try to distribute on the others lines.
        # Put the discount on the biggest lines first.
        to_keep = sorted(to_keep, key=lambda line_values: line_values['line'].price_subtotal, reverse=True)

        for line_values in to_distribute:
            line = line_values['line']
            for other_line_values in to_keep:
                other_line = other_line_values['line']

                # Check if it's a candidate to distribute.
                if line.tax_ids.flatten_taxes_hierarchy() != other_line.tax_ids.flatten_taxes_hierarchy():
                    continue

                net_price_subtotal = line_values['discount'] - line_values['gross_price_subtotal']
                other_net_price_subtotal = other_line_values['gross_price_subtotal'] - other_line_values['discount']
                discount_to_distribute = min(other_net_price_subtotal, net_price_subtotal)

                other_line_values['discount'] += discount_to_distribute
                line_values['discount'] -= discount_to_distribute

                remaining_to_distribute = line_values['discount'] - line_values['gross_price_subtotal']
                is_zero = line.currency_id.is_zero(remaining_to_distribute)

                def get_tax_key(tax_values):
                    return frozendict({k: v for k, v in tax_values.items() if k not in ('base', 'importe')})

                for key in ('transferred_values_list', 'withholding_values_list'):
                    for tax_values in line_values[key]:
                        if is_zero:
                            base = tax_values['base']
                            tax = tax_values['importe']
                        else:
                            distribute_ratio = abs(discount_to_distribute / remaining_to_distribute)
                            base = line.currency_id.round(tax_values['base'] * distribute_ratio)
                            tax = line.currency_id.round(tax_values['tax'] * distribute_ratio)

                        tax_key = get_tax_key(tax_values)
                        other_tax_values = [x for x in other_line_values[key] if get_tax_key(x) == tax_key][0]
                        other_tax_values['base'] += base
                        other_tax_values['importe'] += tax
                        tax_values['base'] -= base
                        tax_values['importe'] -= tax

                if is_zero:
                    distributed_lines.add(line)
                    break

        return [x for x in prepared_line_values_list if x['line'] not in distributed_lines]

    def _l10n_mx_edi_get_invoice_cfdi_values(self, percentage_paid=None):
        self.ensure_one()

        cfdi_values = self._l10n_mx_edi_get_common_cfdi_values()
        cfdi_values['invoice'] = self
        format_string = cfdi_values['format_string']

        # Customer.
        customer_values = self._l10n_mx_edi_get_customer_cfdi_values(self.partner_id, to_public=self.l10n_mx_edi_cfdi_to_public)
        customer = customer_values['customer']
        cfdi_values['receptor'] = customer_values
        cfdi_values['lugar_expedicion'] = customer_values['domicilio_fiscal_receptor']

        # Date.
        if self.invoice_date >= fields.Date.context_today(self) and self.invoice_date == self.l10n_mx_edi_post_time.date():
            cfdi_values['fecha'] = self.l10n_mx_edi_post_time.strftime('%Y-%m-%dT%H:%M:%S')
        else:
            cfdi_time = datetime.strptime('23:59:00', '%H:%M:%S').time()
            cfdi_values['fecha'] = datetime\
                .combine(
                    fields.Datetime.from_string(self.invoice_date),
                    cfdi_time,
                )\
                .strftime('%Y-%m-%dT%H:%M:%S')

        # Payment terms.
        cfdi_values['metodo_pago'] = self.l10n_mx_edi_payment_policy
        if self.l10n_mx_edi_payment_policy == 'PPD':
            cfdi_values['forma_pago'] = '99'
        else:
            cfdi_values['forma_pago'] = (self.l10n_mx_edi_payment_method_id.code or '').replace('NA', '99')
        cfdi_values['condiciones_de_pago'] = format_string(self.invoice_payment_term_id.name, size=1000)

        # Currency.
        cfdi_values['moneda'] = self.currency_id.name
        if self.currency_id.name == 'MXN':
            cfdi_values['tipo_cambio'] = None
        else: # CFDI is only enabled for companies having MXN as currency.
            cfdi_values['tipo_cambio'] = abs(self.amount_total_signed / self.amount_total) if self.amount_total else 1.0

        # Misc.
        cfdi_values['tipo_de_comprobante'] = 'I' if self.move_type == 'out_invoice' else 'E'
        cfdi_values['exportacion'] = '01'

        # Prepare taxes amounts.

        def filter_invl_to_apply(inv_line):
            return inv_line.discount != 100.0

        def filter_tax_transferred(base_line, tax_values):
            tax = tax_values['tax_repartition_line'].tax_id
            return tax.amount >= 0.0

        def grouping_key_generator(_base_line, tax_values):
            tax_rep = tax_values['tax_repartition_line']
            tax = tax_rep.tax_id
            tags = tax_rep.tag_ids
            if len(tags) == 1:
                tag_name = {'ISR': '001', 'IVA': '002', 'IEPS': '003'}.get(tags[0].name)
            elif tax.l10n_mx_tax_type == 'Exento':
                tag_name = '002'
            else:
                tag_name = None
            return {
                'tipo_factor': tax.l10n_mx_tax_type,
                'impuesto': tag_name,
                'tax_amount_field': tax.amount,
            }

        tax_details_transferred = self._prepare_invoice_aggregated_taxes(
            filter_invl_to_apply=filter_invl_to_apply,
            filter_tax_values_to_apply=filter_tax_transferred,
            grouping_key_generator=grouping_key_generator,
        )

        def filter_tax_withholding(_base_line, tax_values):
            tax = tax_values['tax_repartition_line'].tax_id
            return tax.amount < 0.0

        tax_details_withholding = self._prepare_invoice_aggregated_taxes(
            filter_invl_to_apply=filter_invl_to_apply,
            filter_tax_values_to_apply=filter_tax_withholding,
            grouping_key_generator=grouping_key_generator,
        )

        if customer.l10n_mx_edi_no_tax_breakdown:
            # Tax exempted.
            tax_objected = '03'
        elif not self.invoice_line_ids.tax_ids:
            tax_objected = '01'
        else:
            tax_objected = '02'

        # Prepare invoice lines and distribution of negative lines accross the others.
        invoice_lines = self._l10n_mx_edi_invoice_cfdi_preprocess_lines(tax_details_transferred, tax_details_withholding)

        # Invoice lines.
        cfdi_values['conceptos_list'] = line_values_list = []
        for line_values in invoice_lines:
            line = line_values['line']

            if percentage_paid:
                for key in ('transferred_values_list', 'withholding_values_list'):
                    for tax_values in line_values[key]:
                        tax_values['base'] = line.currency_id.round(tax_values['base'] * percentage_paid)
                        tax_values['importe'] = line.currency_id.round(tax_values['importe'] * percentage_paid)

            transferred_values_list = line_values['transferred_values_list']
            withholding_values_list = line_values['withholding_values_list']

            cfdi_line_values = {
                'line': line,
                'clave_prod_serv': line.product_id.unspsc_code_id.code,
                'no_identificacion': line.product_id.default_code,
                'cantidad': line.quantity,
                'clave_unidad': line.product_uom_id.unspsc_code_id.code,
                'unidad': (line.product_uom_id.name or '').upper(),
                'description': line.name,
                'traslados_list': [],
                'retenciones_list': [],
                'total_impuestos_trasladados': 0.0,
                'total_impuestos_retenciones': 0.0,
            }

            # Discount.
            discount = line_values['discount']
            if line.currency_id.is_zero(discount):
                discount = None
            cfdi_line_values['descuento'] = discount

            # Misc.
            cfdi_line_values['objeto_imp'] = tax_objected if transferred_values_list or withholding_values_list else '01'
            cfdi_line_values['importe'] = line_values['gross_price_subtotal']
            if cfdi_line_values['objeto_imp'] == '02':
                cfdi_line_values['traslados_list'] = transferred_values_list
                cfdi_line_values['retenciones_list'] = withholding_values_list
            else:
                cfdi_line_values['importe'] += sum(x['importe'] for x in transferred_values_list)\
                                               - sum(x['importe'] for x in withholding_values_list)
            cfdi_line_values['valor_unitario'] = cfdi_line_values['importe'] / cfdi_line_values['cantidad']

            line_values_list.append(cfdi_line_values)

        # Taxes.
        withholding_values_map = defaultdict(lambda: {'base': 0.0, 'importe': 0.0})
        withholding_reduced_values_map = defaultdict(lambda: {'base': 0.0, 'importe': 0.0})
        transferred_values_map = defaultdict(lambda: {'base': 0.0, 'importe': 0.0})
        for cfdi_line_values in line_values_list:
            for tax_values in cfdi_line_values['retenciones_list']:
                key = frozendict({'impuesto': tax_values['impuesto']})
                withholding_reduced_values_map[key]['importe'] += tax_values['importe']
            for result_dict, key in ((withholding_values_map, 'retenciones_list'), (transferred_values_map, 'traslados_list')):
                for tax_values in cfdi_line_values[key]:
                    key = frozendict({
                        'impuesto': tax_values['impuesto'],
                        'tipo_factor': tax_values['tipo_factor'],
                        'tasa_o_cuota': tax_values['tasa_o_cuota']
                    })
                    result_dict[key]['base'] += tax_values['base']
                    result_dict[key]['importe'] += tax_values['importe']
        cfdi_values['retenciones_list'] = [
            {**k, **v}
            for k, v in withholding_values_map.items()
        ]
        cfdi_values['retenciones_reduced_list'] = [
            {**k, **v}
            for k, v in withholding_reduced_values_map.items()
        ]
        cfdi_values['traslados_list'] = [
            {**k, **v}
            for k, v in transferred_values_map.items()
        ]

        # Totals.
        cfdi_values['objeto_imp'] = tax_objected
        cfdi_values['total_impuestos_trasladados'] = sum(x['importe'] for x in cfdi_values['traslados_list'])
        cfdi_values['total_impuestos_retenidos'] = sum(x['importe'] for x in cfdi_values['retenciones_list'])
        cfdi_values['subtotal'] = sum(x['importe'] for x in line_values_list)
        cfdi_values['descuento'] = sum(x['descuento'] for x in line_values_list if x['descuento'])
        cfdi_values['total'] = cfdi_values['subtotal'] \
                             - cfdi_values['descuento'] \
                             + cfdi_values['total_impuestos_trasladados'] \
                             - cfdi_values['total_impuestos_retenidos']
        if self.currency_id.is_zero(cfdi_values['descuento']):
            cfdi_values['descuento'] = None
        if self.currency_id.is_zero(cfdi_values['total_impuestos_trasladados']):
            cfdi_values['total_impuestos_trasladados'] = None
        if self.currency_id.is_zero(cfdi_values['total_impuestos_retenidos']):
            cfdi_values['total_impuestos_retenidos'] = None

        return cfdi_values

    def _l10n_mx_edi_get_invoice_cfdi_filename(self):
        """ Get the filename of the CFDI.

        :return: The filename as a string.
        """
        self.ensure_one()
        return f"{self.journal_id.code}-{self.name}-MX-Invoice-4.0.xml".replace('/', '')

    @api.model
    def _l10n_mx_edi_prepare_invoice_cfdi_templates(self):
        """ Hook to be overridden in case the CFDI version changes.

        :return: a tuple (<qweb_template>, <xsd_attachment_name>)
        """
        return 'l10n_mx_edi.cfdiv40', 'cfdv40.xsd'

    def _l10n_mx_edi_prepare_invoice_cfdi(self):
        """ Prepare the CFDI for the current invoice.

        :return: a dictionary containing:
            * error: An optional error message.
            * cfdi_str: An optional xml as str.
        """
        self.ensure_one()

        # == Check the config ==
        errors = self.company_id._l10n_mx_edi_cfdi_check_config() + self._l10n_mx_edi_cfdi_check_invoice_config()
        if errors:
            return {'errors': errors}

        # == CFDI values ==
        cfdi_values = self._l10n_mx_edi_get_invoice_cfdi_values()
        qweb_template, _xsd_attachment_name = self._l10n_mx_edi_prepare_invoice_cfdi_templates()

        # == Generate the CFDI ==
        cfdi = self.env['ir.qweb']._render(qweb_template, cfdi_values)
        cfdi_infos = self.env['l10n_mx_edi.document']._decode_cfdi_attachment(cfdi)
        cfdi_cadena_crypted = cfdi_values['certificate'].sudo()._get_encrypted_cadena(cfdi_infos['cadena'])
        cfdi_infos['cfdi_node'].attrib['Sello'] = cfdi_cadena_crypted

        # == Check the CFDI ==
        cfdi_str = etree.tostring(cfdi_infos['cfdi_node'], pretty_print=True, xml_declaration=True, encoding='UTF-8')
        results = {
            'cfdi_filename': self._l10n_mx_edi_get_invoice_cfdi_filename(),
            'cfdi_str': cfdi_str,
        }

        # TODO: the XSD are not working if l10n_mx_edi_extended is installed. In that case, we need another XSD to check it
        # TODO: etree doesn't support multiple XSD like the 'xmlschema' library. Should we remove the whole XSD part?
        # try:
        #     tools.validate_xml_from_attachment(self.env, cfdi_infos['cfdi_node'], xsd_attachment_name, prefix='l10n_mx_edi')
        # except UserError as error:
        #     results['errors'] = str(error).split('\\n')
        return results

    # -------------------------------------------------------------------------
    # CFDI Generation: Payments
    # -------------------------------------------------------------------------

    def _l10n_mx_edi_get_payment_cfdi_values(self, pay_results):
        """ Prepare the values to render the payment cfdi.

        :param pay_results: The amounts to consider for each invoice.
                            See '_l10n_mx_edi_cfdi_payment_get_reconciled_invoice_values'.
        :return: The dictionary to render the xml.
        """
        self.ensure_one()
        cfdi_values = self._l10n_mx_edi_get_common_cfdi_values()
        company_curr = self.company_currency_id

        # Date.
        cfdi_date = datetime.combine(fields.Datetime.from_string(self.date), datetime.strptime('12:00:00', '%H:%M:%S').time())
        cfdi_values['fecha'] = self.l10n_mx_edi_post_time.strftime('%Y-%m-%dT%H:%M:%S')
        cfdi_values['fecha_pago'] = cfdi_date.strftime('%Y-%m-%dT%H:%M:%S')

        # Misc.
        cfdi_values['exportacion'] = '01'
        cfdi_values['forma_de_pago'] = (self.l10n_mx_edi_payment_method_id.code or '').replace('NA', '99')
        cfdi_values['moneda'] = self.currency_id.name
        cfdi_values['num_operacion'] = self.ref

        # Amounts.
        total_in_payment_curr = sum(x['payment_amount_currency'] for x in pay_results['invoice_results'])
        total_in_company_curr = sum(x['balance'] + x['payment_exchange_balance'] for x in pay_results['invoice_results'])
        if self.currency_id == company_curr:
            cfdi_values['monto'] = total_in_company_curr
        else:
            cfdi_values['monto'] = total_in_payment_curr

        # Exchange rate.
        # 'tipo_cambio' is a conditional attribute used to express the exchange rate of the currency on the date the
        # payment was made.
        # The value must reflect the number of Mexican pesos that are equivalent to a unit of the currency indicated
        # in the 'moneda' attribute.
        # It is required when the MonedaP attribute is different from MXN.
        if self.currency_id == company_curr:
            payment_rate = None
        else:
            payment_rate = abs(total_in_company_curr / total_in_payment_curr) if total_in_payment_curr else 0.0
        cfdi_values['tipo_cambio'] = payment_rate

        # === Create the list of invoice data ===
        invoice_values_list = []
        for invoice_values in pay_results['invoice_results']:
            invoice = invoice_values['invoice']
            if invoice.amount_total:
                percentage_paid = abs(invoice_values['reconciled_amount'] / invoice.amount_total)
            else:
                percentage_paid = 0.0
            inv_cfdi_values = invoice._l10n_mx_edi_get_invoice_cfdi_values(percentage_paid=percentage_paid)

            # 'equivalencia' (rate) is a conditional attribute used to express the exchange rate according to the currency
            # registered in the document related. It is required when the currency of the related document is different
            # from the payment currency.
            # The number of units of the currency must be recorded indicated in the related document that are
            # equivalent to a unit of the currency of the payment.
            if invoice.currency_id == self.currency_id:
                # Same currency.
                rate = None
            elif invoice.currency_id == company_curr != self.currency_id:
                # Adapt the payment rate to find the reconciled amount of the invoice but expressed in payment currency.
                balance = invoice_values['balance'] + invoice_values['invoice_exchange_balance']
                amount_currency = invoice_values['payment_amount_currency']
                rate = abs(balance / amount_currency) if amount_currency else 0.0
            elif self.currency_id == company_curr != invoice.currency_id:
                # Adapt the invoice rate to find the reconciled amount of the payment but expressed in invoice currency.
                balance = invoice_values['balance'] + invoice_values['payment_exchange_balance']
                rate = abs(invoice_values['invoice_amount_currency'] / balance) if balance else 0.0
            elif invoice_values['payment_amount_currency']:
                # Both are expressed in different currencies.
                rate = abs(invoice_values['invoice_amount_currency'] / invoice_values['payment_amount_currency'])
            else:
                rate = 0.0

            invoice_values_list.append({
                **inv_cfdi_values,
                'id_documento': invoice.l10n_mx_edi_cfdi_uuid,
                'equivalencia': rate,
                'num_parcialidad': invoice_values['number_of_payments'],
                'imp_pagado': invoice_values['reconciled_amount'],
                'imp_saldo_ant': invoice_values['amount_residual_before'],
                'imp_saldo_insoluto': invoice_values['amount_residual_after'],
            })
        cfdi_values['docto_relationado_list'] = invoice_values_list

        # Customer.
        rfcs = set(x['receptor']['rfc'] for x in invoice_values_list)
        if len(rfcs) > 1:
            return {'errors': [_("You can't register a payment for invoices having different RFCs.")]}

        customer_values = invoice_values_list[0]['receptor']
        customer = customer_values['customer']
        cfdi_values['receptor'] = customer_values
        cfdi_values['lugar_expedicion'] = customer_values['domicilio_fiscal_receptor']

        # Bank information.
        payment_method_code = self.l10n_mx_edi_payment_method_id.code
        is_payment_code_emitter_ok = payment_method_code in ('02', '03', '04', '05', '06', '28', '29', '99')
        is_payment_code_receiver_ok = payment_method_code in ('02', '03', '04', '05', '28', '29', '99')
        is_payment_code_bank_ok = payment_method_code in ('02', '03', '04', '28', '29', '99')

        bank_account = customer.bank_ids.filtered(lambda x: x.company_id.id in (False, self.company_id.id))[:1]

        partner_bank = bank_account.bank_id
        if partner_bank.country and partner_bank.country.code != 'MX':
            partner_bank_vat = 'XEXX010101000'
        else:  # if no partner_bank (e.g. cash payment), partner_bank_vat is not set.
            partner_bank_vat = partner_bank.l10n_mx_edi_vat

        payment_account_ord = re.sub(r'\s+', '', bank_account.acc_number or '') or None
        payment_account_receiver = re.sub(r'\s+', '', self.journal_id.bank_account_id.acc_number or '') or None

        cfdi_values.update({
            'rfc_emisor_cta_ord': is_payment_code_emitter_ok and partner_bank_vat,
            'nom_banco_ord_ext': is_payment_code_bank_ok and partner_bank.name,
            'cta_ordenante': is_payment_code_emitter_ok and payment_account_ord,
            'rfc_emisor_cta_ben': is_payment_code_receiver_ok and self.journal_id.bank_account_id.bank_id.l10n_mx_edi_vat,
            'cta_beneficiario': is_payment_code_receiver_ok and payment_account_receiver,
        })

        # Taxes.
        cfdi_values.update({
            'total_traslados_base_iva0': None,
            'total_traslados_impuesto_iva0': None,
            'total_traslados_base_iva_exento': None,
            'total_traslados_base_iva8': None,
            'total_traslados_impuesto_iva8': None,
            'total_traslados_base_iva16': None,
            'total_traslados_impuesto_iva16': None,
            'total_retenciones_isr': None,
            'total_retenciones_iva': None,
            'total_retenciones_ieps': None,
            'monto_total_pagos': total_in_company_curr,
            'mxn_digits': company_curr.decimal_places,
        })

        def update_tax_amount(key, amount):
            if cfdi_values[key] is None:
                cfdi_values[key] = 0.0
            cfdi_values[key] += amount

        def check_transferred_tax_values(tax_values, tag, tax_class, amount):
            return (
                tax_values['impuesto'] == tag
                and tax_values['tipo_factor'] == tax_class
                and company_curr.compare_amounts(tax_values['tasa_o_cuota'], amount) == 0
            )

        withholding_values_map = defaultdict(lambda: {'importe': 0.0})
        transferred_values_map = defaultdict(lambda: {'base': 0.0, 'importe': 0.0})
        pay_rate = cfdi_values['tipo_cambio'] or 1.0
        for cfdi_inv_values in invoice_values_list:
            inv_rate = cfdi_inv_values['equivalencia'] or 1.0
            to_mxn_rate = pay_rate / inv_rate
            for tax_values in cfdi_inv_values['retenciones_list']:
                key = frozendict({'impuesto': tax_values['impuesto']})
                withholding_values_map[key]['importe'] += self.currency_id.round(tax_values['importe'] / inv_rate)

                tax_amount_mxn = company_curr.round(tax_values['importe'] * to_mxn_rate)
                if tax_values['impuesto'] == '001':
                    update_tax_amount('total_retenciones_isr', tax_amount_mxn)
                elif tax_values['impuesto'] == '002':
                    update_tax_amount('total_retenciones_iva', tax_amount_mxn)
                elif tax_values['impuesto'] == '003':
                    update_tax_amount('total_retenciones_ieps', tax_amount_mxn)

            for tax_values in cfdi_inv_values['traslados_list']:
                key = frozendict({
                    'impuesto': tax_values['impuesto'],
                    'tipo_factor': tax_values['tipo_factor'],
                    'tasa_o_cuota': tax_values['tasa_o_cuota']
                })
                transferred_values_map[key]['base'] += self.currency_id.round(tax_values['base'] / inv_rate)
                transferred_values_map[key]['importe'] += self.currency_id.round(tax_values['importe'] / inv_rate)

                base_amount_mxn = company_curr.round(tax_values['base'] * to_mxn_rate)
                tax_amount_mxn = company_curr.round(tax_values['importe'] * to_mxn_rate)
                if check_transferred_tax_values(tax_values, '001', 'Tasa', 0.0):
                    update_tax_amount('total_traslados_base_iva0', base_amount_mxn)
                    update_tax_amount('total_traslados_impuesto_iva0', tax_amount_mxn)
                elif check_transferred_tax_values(tax_values, '002', 'Exento', 0.0):
                    update_tax_amount('total_traslados_base_iva_exento', base_amount_mxn)
                elif check_transferred_tax_values(tax_values, '002', 'Tasa', 0.08):
                    update_tax_amount('total_traslados_base_iva8', base_amount_mxn)
                    update_tax_amount('total_traslados_impuesto_iva8', tax_amount_mxn)
                elif check_transferred_tax_values(tax_values, '002', 'Tasa', 0.16):
                    update_tax_amount('total_traslados_base_iva16', base_amount_mxn)
                    update_tax_amount('total_traslados_impuesto_iva16', tax_amount_mxn)
        cfdi_values['retenciones_list'] = [
            {**k, **v}
            for k, v in withholding_values_map.items()
        ]
        cfdi_values['traslados_list'] = [
            {**k, **v}
            for k, v in transferred_values_map.items()
        ]
        return cfdi_values

    def _l10n_mx_edi_get_payment_cfdi_filename(self):
        """ Get the filename of the CFDI.

        :return: The filename as a string.
        """
        self.ensure_one()
        return f'{self.journal_id.code}-{self.name}-MX-Payment-20.xml'.replace('/', '')

    @api.model
    def _l10n_mx_edi_prepare_payment_cfdi_template(self):
        return 'l10n_mx_edi.payment20'

    def _l10n_mx_edi_prepare_payment_cfdi(self, pay_results):
        """ Prepare the CFDI for the current payment.

        :param pay_results: The amounts to consider for each invoice.
                            See '_l10n_mx_edi_cfdi_payment_get_reconciled_invoice_values'.
        :return: a dictionary containing:
            * error: An optional error message.
            * cfdi_str: An optional xml as str.
        """
        self.ensure_one()

        # == Check the config ==
        errors = self.company_id._l10n_mx_edi_cfdi_check_config()
        if errors:
            return {'errors': errors}

        # == CFDI values ==
        cfdi_values = self._l10n_mx_edi_get_payment_cfdi_values(pay_results)
        if cfdi_values.get('errors'):
            return {'errors': cfdi_values['errors']}
        qweb_template = self._l10n_mx_edi_prepare_payment_cfdi_template()

        # == Generate the CFDI ==
        cfdi = self.env['ir.qweb']._render(qweb_template, cfdi_values)
        cfdi_infos = self.env['l10n_mx_edi.document']._decode_cfdi_attachment(cfdi)
        cfdi_cadena_crypted = cfdi_values['certificate'].sudo()._get_encrypted_cadena(cfdi_infos['cadena'])
        cfdi_infos['cfdi_node'].attrib['Sello'] = cfdi_cadena_crypted
        cfdi_str = etree.tostring(cfdi_infos['cfdi_node'], pretty_print=True, xml_declaration=True, encoding='UTF-8')

        return {
            'cfdi_filename': self._l10n_mx_edi_get_payment_cfdi_filename(),
            'cfdi_str': cfdi_str,
            'sello': cfdi_cadena_crypted,
        }

    # -------------------------------------------------------------------------
    # CFDI: DOCUMENTS
    # -------------------------------------------------------------------------

    def _l10n_mx_edi_cfdi_invoice_document_sent_failed(self, error, cfdi_filename=None, cfdi_str=None):
        """ Create/update the invoice document for 'sent_failed'.
        The parameters are provided by '_l10n_mx_edi_prepare_invoice_cfdi'.

        :param error:           The error.
        :param cfdi_filename:   The optional filename of the cfdi.
        :param cfdi_str:        The optional content of the cfdi.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(self.ids)],
            'state': 'invoice_sent_failed',
            'sat_state': None,
            'message': error,
        }
        if cfdi_filename and cfdi_str:
            document_values['attachment_id'] = {
                'name': cfdi_filename,
                'raw': cfdi_str,
            }
        return self.env['l10n_mx_edi.document']._create_update_invoice_document(self, document_values)

    def _l10n_mx_edi_cfdi_invoice_document_sent(self, cfdi_filename, cfdi_str):
        """ Create/update the invoice document for 'sent'.
        The parameters are provided by '_l10n_mx_edi_prepare_invoice_cfdi'.

        :param cfdi_filename:   The filename of the cfdi.
        :param cfdi_str:        The content of the cfdi.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(self.ids)],
            'state': 'invoice_sent',
            'sat_state': 'not_defined',
            'message': None,
            'attachment_id': {
                'name': cfdi_filename,
                'raw': cfdi_str,
                'description': "CFDI",
            },
        }
        return self.env['l10n_mx_edi.document']._create_update_invoice_document(self, document_values)

    def _l10n_mx_edi_cfdi_invoice_document_cancel_failed(self, error):
        """ Create/update the invoice document for 'cancel_failed'.

        :param error: The error.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(self.ids)],
            'state': 'invoice_cancel_failed',
            'sat_state': None,
            'message': error,
        }
        return self.env['l10n_mx_edi.document']._create_update_invoice_document(self, document_values)

    def _l10n_mx_edi_cfdi_invoice_document_cancel(self):
        """ Create/update the invoice document for 'cancel'. """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(self.ids)],
            'state': 'invoice_cancel',
            'sat_state': 'not_defined',
            'message': None,
            'attachment_id': self.l10n_mx_edi_cfdi_attachment_id.id,
        }
        return self.env['l10n_mx_edi.document']._create_update_invoice_document(self, document_values)

    def _l10n_mx_edi_cfdi_payment_document_sent_pue(self, invoices):
        """ Create/update the invoice document for 'sent_pue'.
        The parameters are provided by '_l10n_mx_edi_prepare_invoice_cfdi'.

        :param invoices: The invoices reconciled with the payment and sent to the government.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(invoices.ids)],
            'state': 'payment_sent_pue',
            'sat_state': None,
            'message': None,
        }
        return self.env['l10n_mx_edi.document']._create_update_payment_document(self, document_values)

    def _l10n_mx_edi_cfdi_payment_document_sent_failed(self, error, invoices, cfdi_filename=None, cfdi_str=None):
        """ Create/update the invoice document for 'sent_failed'.
        The parameters are provided by '_l10n_mx_edi_prepare_invoice_cfdi'.

        :param error:           The error.
        :param invoices:        The invoices reconciled with the payment and sent to the government.
        :param cfdi_filename:   The optional filename of the cfdi.
        :param cfdi_str:        The optional content of the cfdi.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(invoices.ids)],
            'state': 'payment_sent_failed',
            'sat_state': None,
            'message': error,
        }
        if cfdi_filename and cfdi_str:
            document_values['attachment_id'] = {
                'name': cfdi_filename,
                'raw': cfdi_str,
            }
        return self.env['l10n_mx_edi.document']._create_update_payment_document(self, document_values)

    def _l10n_mx_edi_cfdi_payment_document_sent(self, invoices, cfdi_filename, cfdi_str):
        """ Create/update the invoice document for 'sent'.
        The parameters are provided by '_l10n_mx_edi_prepare_invoice_cfdi'.

        :param invoices:        The invoices reconciled with the payment and sent to the government.
        :param cfdi_filename:   The filename of the cfdi.
        :param cfdi_str:        The content of the cfdi.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(invoices.ids)],
            'state': 'payment_sent',
            'sat_state': 'not_defined',
            'message': None,
            'attachment_id': {
                'name': cfdi_filename,
                'raw': cfdi_str,
                'description': "CFDI",
            },
        }
        return self.env['l10n_mx_edi.document']._create_update_payment_document(self, document_values)

    def _l10n_mx_edi_cfdi_payment_document_cancel_failed(self, error, invoices):
        """ Create/update the payment document for 'cancel_failed'.

        :param error:       The error.
        :param invoices:    The invoices reconciled with the payment and sent to the government.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(invoices.ids)],
            'state': 'payment_cancel_failed',
            'sat_state': None,
            'message': error,
        }
        return self.env['l10n_mx_edi.document']._create_update_payment_document(self, document_values)

    def _l10n_mx_edi_cfdi_payment_document_cancel(self, invoices, attachment):
        """ Create/update the payment document for 'cancel'.

        :param invoices:    The invoices reconciled with the payment and sent to the government.
        :param attachment:  The currently signed attachment.
        """
        self.ensure_one()

        document_values = {
            'move_id': self.id,
            'invoice_ids': [Command.set(invoices.ids)],
            'state': 'payment_cancel',
            'sat_state': 'not_defined',
            'message': None,
            'attachment_id': attachment.id,
        }
        return self.env['l10n_mx_edi.document']._create_update_payment_document(self, document_values)

    # -------------------------------------------------------------------------
    # CFDI: FLOWS
    # -------------------------------------------------------------------------

    def _l10n_mx_edi_cfdi_invoice_try_send(self):
        """ Try to generate and send the CFDI for the current invoice. """
        self.ensure_one()
        if self.state != 'posted':
            return

        # == Check xml ==
        results = self._l10n_mx_edi_prepare_invoice_cfdi()
        if results.get('errors'):
            self._l10n_mx_edi_cfdi_invoice_document_sent_failed(
                "\n".join(results['errors']),
                cfdi_filename=results.get('cfdi_filename'),
                cfdi_str=results.get('cfdi_str'),
            )
            return

        company = self.company_id
        pac_name = company.l10n_mx_edi_pac

        # == Check credentials ==
        credentials = getattr(self.env['l10n_mx_edi.document'], f'_get_{pac_name}_credentials')(company)
        if credentials.get('errors'):
            self._l10n_mx_edi_cfdi_invoice_document_sent_failed(
                "\n".join(credentials['errors']),
                cfdi_filename=results.get('cfdi_filename'),
                cfdi_str=results.get('cfdi_str'),
            )
            return

        # == Check PAC ==
        sign_results = getattr(self.env['l10n_mx_edi.document'], f'_{pac_name}_sign')(credentials, results['cfdi_str'])
        if sign_results.get('errors'):
            self._l10n_mx_edi_cfdi_invoice_document_sent_failed(
                "\n".join(sign_results['errors']),
                cfdi_filename=results['cfdi_filename'],
                cfdi_str=results['cfdi_str'],
            )
            return

        # == Append the addenda ==
        addenda = self.partner_id.l10n_mx_edi_addenda or self.commercial_partner_id.l10n_mx_edi_addenda
        if addenda:
            sign_results['cfdi_str'] = self._l10n_mx_edi_cfdi_invoice_append_addenda(sign_results['cfdi_str'], addenda)

        # == Success ==
        document = self._l10n_mx_edi_cfdi_invoice_document_sent(results['cfdi_filename'], sign_results['cfdi_str'])

        # == Chatter ==
        self\
            .with_context(no_new_invoice=True)\
            .message_post(
                body=_("The CFDI document was successfully created and signed by the government."),
                attachment_ids=document.attachment_id.ids,
            )

    def _l10n_mx_edi_cfdi_invoice_try_cancel(self):
        """ Try to cancel the CFDI for the current invoice. """
        self.ensure_one()
        if self.state != 'posted' or self.l10n_mx_edi_cfdi_state != 'sent':
            return

        company = self.company_id
        pac_name = company.l10n_mx_edi_pac

        # == Check the config ==
        errors = self.company_id._l10n_mx_edi_cfdi_check_config() + self._l10n_mx_edi_cfdi_check_invoice_config()
        if errors:
            self._l10n_mx_edi_cfdi_invoice_document_cancel_failed(
                "\n".join(errors),
            )
            return

        # == Check credentials ==
        credentials = getattr(self.env['l10n_mx_edi.document'], f'_get_{pac_name}_credentials')(company)
        if credentials.get('errors'):
            self._l10n_mx_edi_cfdi_invoice_document_cancel_failed(
                "\n".join(credentials['errors']),
            )
            return

        # == Check PAC ==
        cancel_results = getattr(self.env['l10n_mx_edi.document'], f'_{pac_name}_cancel')(
            self.company_id,
            credentials,
            self.l10n_mx_edi_cfdi_uuid,
            uuid_replace=self.l10n_mx_edi_cfdi_cancel_id.l10n_mx_edi_cfdi_uuid,
        )
        if cancel_results.get('errors'):
            self._l10n_mx_edi_cfdi_invoice_document_cancel_failed(
                "\n".join(cancel_results['errors']),
            )
            return

        # == Success ==
        self._l10n_mx_edi_cfdi_invoice_document_cancel()

        # == Chatter ==
        self\
            .with_context(no_new_invoice=True)\
            .message_post(body=_("The CFDI document has been successfully cancelled."))

        self.button_draft()
        self.button_cancel()

    def l10n_mx_edi_cfdi_try_sat(self):
        self.ensure_one()
        if self.is_invoice():
            documents = self.l10n_mx_edi_invoice_document_ids
        elif self._l10n_mx_edi_is_cfdi_payment():
            documents = self.l10n_mx_edi_payment_document_ids
        else:
            return

        self.env['l10n_mx_edi.document']._fetch_and_update_sat_status(extra_domain=[('id', 'in', documents.ids)])

    def _l10n_mx_edi_cfdi_invoice_get_reconciled_payments_values(self):
        """ Compute the residual amounts before/after each payment reconciled with the current invoices.

        :return: A mapping invoice => dictionary containing:
            * payment:                  The account.move of the payment.
            * reconciled_amount:        The reconciled amount.
            * amount_residual_before:   The residual amount before reconciliation.
            * amount_residual_after:    The residual_amount after reconciliation.
        """
        # Only consider the invoices already signed.
        invoices = self.filtered(lambda x: x.is_invoice() and x.l10n_mx_edi_cfdi_state == 'sent')

        # Collect the reconciled amounts.
        reconciliation_values = {}
        for invoice in invoices:
            pay_rec_lines = invoice.line_ids\
                .filtered(lambda line: line.account_type in ('asset_receivable', 'liability_payable'))
            exchange_move_map = {}
            reconciliation_values[invoice] = {
                'payments': defaultdict(lambda: {
                    'invoice_amount_currency': 0.0,
                    'balance': 0.0,
                    'invoice_exchange_balance': 0.0,
                    'payment_amount_currency': 0.0,
                }),
            }
            for field1, field2 in (('credit', 'debit'), ('debit', 'credit')):
                for partial in pay_rec_lines[f'matched_{field1}_ids'].sorted(lambda x: not x.exchange_move_id):
                    counterpart_line = partial[f'{field1}_move_id']
                    counterpart_move = counterpart_line.move_id

                    if partial.exchange_move_id:
                        exchange_move_map[partial.exchange_move_id] = counterpart_move

                    if counterpart_move._l10n_mx_edi_is_cfdi_payment():
                        pay_results = reconciliation_values[invoice]['payments'][counterpart_move]
                        pay_results['invoice_amount_currency'] += partial[f'{field2}_amount_currency']
                        pay_results['payment_amount_currency'] += partial[f'{field1}_amount_currency']
                        pay_results['balance'] += partial.amount
                    elif counterpart_move in exchange_move_map:
                        pay_results = reconciliation_values[invoice]['payments'][exchange_move_map[counterpart_move]]
                        pay_results['invoice_exchange_balance'] += partial.amount

        # Compute the chain of payments.
        results = {}
        for invoice, invoice_values in reconciliation_values.items():
            payment_values = invoice_values['payments']
            invoice_results = results[invoice] = []
            residual = invoice.amount_total
            for pay, pay_results in sorted(list(payment_values.items()), key=lambda x: x[0].date, reverse=True):
                reconciled_invoice_amount = pay_results['invoice_amount_currency']
                if invoice.currency_id == invoice.company_currency_id:
                    reconciled_invoice_amount += pay_results['invoice_exchange_balance']
                invoice_results.append({
                    **pay_results,
                    'payment': pay,
                    'invoice': invoice,
                    'number_of_payments': len(payment_values),
                    'reconciled_amount': reconciled_invoice_amount,
                    'amount_residual_before': residual,
                    'amount_residual_after': residual - reconciled_invoice_amount,
                })
                residual -= reconciled_invoice_amount

        return results

    def _l10n_mx_edi_cfdi_payment_get_reconciled_invoice_values(self):
        """ Compute the amounts to send to the PAC from the current payments.

        :return: A mapping payment => dictionary containing:
            * invoices:         The reconciled invoices.
            * invoice_results:  A list of payment values, see '_l10n_mx_edi_cfdi_invoice_get_reconciled_payments_values'.
        """
        # Find all invoices linked to the current payments.
        results = {}
        payments = self.filtered(lambda x: x._l10n_mx_edi_is_cfdi_payment() and x.l10n_mx_edi_cfdi_state != 'cancel')
        all_invoices = self.env['account.move']
        exchange_move_map = {}
        exchange_move_balances = defaultdict(lambda: defaultdict(lambda: 0.0))
        for payment in payments:
            # Only the fully reconciled payments need to be sent.
            pay_rec_lines = payment.line_ids\
                .filtered(lambda line: line.account_type in ('asset_receivable', 'liability_payable'))
            if any(not x.reconciled for x in pay_rec_lines):
                continue

            # The payments must only be sent when all reconciled invoices are sent.
            skip = False
            invoices = self.env['account.move']
            for field in ('debit', 'credit'):
                for partial in pay_rec_lines[f'matched_{field}_ids'].sorted(lambda x: not x.exchange_move_id):
                    counterpart_line = partial[f'{field}_move_id']
                    counterpart_move = counterpart_line.move_id

                    if counterpart_move in exchange_move_map:
                        exchange_move_balances[payment][exchange_move_map[counterpart_move]] += partial.amount
                        continue

                    if not counterpart_move.is_invoice() or not counterpart_move.l10n_mx_edi_cfdi_state:
                        skip = True
                        break

                    if partial.exchange_move_id:
                        exchange_move_map[partial.exchange_move_id] = counterpart_move

                    invoices |= counterpart_move

            if skip:
                continue

            all_invoices |= invoices

            reconciled_amls = pay_rec_lines.matched_debit_ids.debit_move_id \
                              + pay_rec_lines.matched_credit_ids.credit_move_id
            invoices = reconciled_amls.move_id.filtered(lambda x: x.l10n_mx_edi_is_cfdi_needed and x.is_invoice())
            if any(
                not invoice.l10n_mx_edi_cfdi_state or invoice.l10n_mx_edi_cfdi_customer_rfc == 'XAXX010101000'
                for invoice in invoices
            ):
                continue

            all_invoices |= invoices
            results[payment] = {
                'invoices': invoices,
                'invoice_results': [],
            }

        # Compute the amounts to send for each invoice.
        reconciled_invoice_values = all_invoices._l10n_mx_edi_cfdi_invoice_get_reconciled_payments_values()
        for invoice, pay_results_list in reconciled_invoice_values.items():
            for pay_results in pay_results_list:
                payment = pay_results['payment']
                if payment not in results:
                    continue

                pay_results['payment_exchange_balance'] = exchange_move_balances[payment][invoice]

                results[payment]['invoice_results'].append(pay_results)

        return results

    def l10n_mx_edi_cfdi_invoice_try_update_payment(self, pay_results, force_cfdi=False):
        """ Update the CFDI state of the current payment.

        :param pay_results: The amounts to consider for each invoice.
                            See '_l10n_mx_edi_cfdi_payment_get_reconciled_invoice_values'.
        :param force_cfdi:  Force the sending of the CFDI if the payment is PUE.
        """
        self.ensure_one()

        last_document = self.l10n_mx_edi_payment_document_ids.sorted()[:1]
        invoices = pay_results['invoices']

        # == Check PUE/PPD ==
        if (
            not last_document
            and not force_cfdi
            and 'PPD' not in set(invoices.mapped('l10n_mx_edi_payment_policy'))
        ):
            self._l10n_mx_edi_cfdi_payment_document_sent_pue(invoices)
            return

        # == Retry a cancellation flow ==
        if last_document.state == 'payment_cancel_failed':
            self.l10n_mx_edi_cfdi_invoice_try_cancel_payment(invoices)
            return

        # == Check xml ==
        results = self._l10n_mx_edi_prepare_payment_cfdi(pay_results)
        if results.get('errors'):
            self._l10n_mx_edi_cfdi_payment_document_sent_failed(
                "\n".join(results['errors']),
                invoices,
                cfdi_filename=results.get('cfdi_filename'),
                cfdi_str=results.get('cfdi_str'),
            )
            return

        company = self.company_id
        pac_name = company.l10n_mx_edi_pac

        # == Check credentials ==
        credentials = getattr(self.env['l10n_mx_edi.document'], f'_get_{pac_name}_credentials')(company)
        if credentials.get('errors'):
            self._l10n_mx_edi_cfdi_payment_document_sent_failed(
                "\n".join(credentials['errors']),
                invoices,
                cfdi_filename=results.get('cfdi_filename'),
                cfdi_str=results.get('cfdi_str'),
            )
            return

        # == Check PAC ==
        sign_results = getattr(self.env['l10n_mx_edi.document'], f'_{pac_name}_sign')(credentials, results['cfdi_str'])
        if sign_results.get('errors'):
            self._l10n_mx_edi_cfdi_payment_document_sent_failed(
                "\n".join(sign_results['errors']),
                invoices,
                cfdi_filename=results['cfdi_filename'],
                cfdi_str=results['cfdi_str'],
            )
            return

        # == Success ==
        self._l10n_mx_edi_cfdi_payment_document_sent(
            invoices,
            results['cfdi_filename'],
            sign_results['cfdi_str'],
        )

    def l10n_mx_edi_cfdi_invoice_try_cancel_payment(self, invoices):
        self.ensure_one()

        # == Check the config ==
        errors = self.company_id._l10n_mx_edi_cfdi_check_config()
        if errors:
            return {'errors': errors}

        # == Check credentials ==
        company = self.company_id
        pac_name = company.l10n_mx_edi_pac
        credentials = getattr(self.env['l10n_mx_edi.document'], f'_get_{pac_name}_credentials')(company)
        if credentials.get('errors'):
            self._l10n_mx_edi_cfdi_payment_document_cancel_failed(
                "\n".join(credentials['errors']),
                invoices,
            )
            return

        # == Check PAC ==
        cfdi_infos = self.env['l10n_mx_edi.document']._decode_cfdi_attachment(self.l10n_mx_edi_cfdi_attachment_id.raw)
        cancel_results = getattr(self.env['l10n_mx_edi.document'], f'_{pac_name}_cancel')(
            self.company_id,
            credentials,
            cfdi_infos['uuid'],
            uuid_replace=self.l10n_mx_edi_cfdi_cancel_id.l10n_mx_edi_cfdi_uuid,
        )
        if cancel_results.get('errors'):
            self._l10n_mx_edi_cfdi_payment_document_cancel_failed(
                "\n".join(cancel_results['errors']),
                invoices,
            )
            return

        # == Success ==
        self._l10n_mx_edi_cfdi_payment_document_cancel(invoices, self.l10n_mx_edi_cfdi_attachment_id)

        self.button_draft()
        self.button_cancel()

    def _l10n_mx_edi_cfdi_invoice_get_payments_diff(self):
        results = {
            'to_remove': defaultdict(list),
            'to_process': [],
            'need_update': set(),
        }

        # Find the payments reconciled with the current invoices.
        reconciled_invoice_values = self._l10n_mx_edi_cfdi_invoice_get_reconciled_payments_values()

        # Collect the reconciled invoices for each payment that have been sent to the SAT.
        sat_sent_payments = defaultdict(set)

        # All payments currently reconciled with the current invoices.
        all_payments = self.env['account.move']
        for invoice, pay_results_list in reconciled_invoice_values.items():
            payments = self.env['account.move']
            for pay_results in pay_results_list:
                payments |= pay_results['payment']
            all_payments |= payments

            commands = []
            for doc in invoice.l10n_mx_edi_invoice_document_ids:
                # Collect the payments that are no longer reconciled with the invoices.
                if (
                    doc.state.startswith('payment_')
                    and doc.state not in ('payment_sent', 'payment_cancel')
                    and doc.move_id not in payments
                ):
                    commands.append(Command.delete(doc.id))

                # Track the payment previously sent to the SAT.
                if doc.move_id not in sat_sent_payments and doc.state in ('payment_sent', 'payment_sent_pue', 'payment_cancel'):
                    sat_sent_payments[doc.move_id] = set(doc.invoice_ids)
            if commands:
                results['to_remove'][invoice] = commands

        # Update the payments.
        reconciled_payment_values = all_payments._l10n_mx_edi_cfdi_payment_get_reconciled_invoice_values()
        for payment, pay_results in reconciled_payment_values.items():
            last_document = payment.l10n_mx_edi_payment_document_ids.sorted()[:1]
            invoices = pay_results['invoices']

            if last_document.state == 'payment_sent_pue':
                continue

            # Check if a reconciliation is missing.
            if set(invoices) != sat_sent_payments[payment]:
                for invoice in sat_sent_payments[payment]:
                    results['need_update'].add(invoice)

            # Check if something changed in the already sent payment.
            if last_document.state == 'payment_sent':
                current_uuids = set(invoices.mapped('l10n_mx_edi_cfdi_uuid'))
                previous_uuids = set()
                cfdi_node = etree.fromstring(last_document.attachment_id.raw)
                for node in cfdi_node.xpath("//*[local-name()='DoctoRelacionado']"):
                    previous_uuids.add(node.attrib['IdDocumento'])
                if current_uuids == previous_uuids:
                    continue

            results['to_process'].append((payment, pay_results))

        return results

    def l10n_mx_edi_cfdi_invoice_try_update_payments(self):
        """ Try to update the state of payments for the current invoices. """
        payments_diff = self._l10n_mx_edi_cfdi_invoice_get_payments_diff()

        # Cleanup the payments that are no longer reconciled with the invoices.
        for invoice, commands in payments_diff['to_remove'].items():
            invoice.l10n_mx_edi_invoice_document_ids = commands

        # Update the payments.
        for payment, pay_results in payments_diff['to_process']:
            payment.l10n_mx_edi_cfdi_invoice_try_update_payment(pay_results)

    def _l10n_mx_edi_cfdi_payment_try_send(self, force_cfdi=False):
        """ Force the sending of the current payment.

        :param force_cfdi: Force the sending of the payment, even if the payment is PUE.
        """
        self.ensure_one()
        reconciled_payment_values = self._l10n_mx_edi_cfdi_payment_get_reconciled_invoice_values()
        for payment, pay_results in reconciled_payment_values.items():
            payment.l10n_mx_edi_cfdi_invoice_try_update_payment(pay_results, force_cfdi=force_cfdi)

    def l10n_mx_edi_cfdi_payment_force_try_send(self):
        self._l10n_mx_edi_cfdi_payment_try_send(force_cfdi=True)

    def _l10n_mx_edi_cfdi_payment_try_cancel(self):
        self.ensure_one()
        for doc in self.l10n_mx_edi_payment_document_ids:
            if doc.state == 'payment_sent':
                self.l10n_mx_edi_cfdi_invoice_try_cancel_payment(doc.invoice_ids)
                break
