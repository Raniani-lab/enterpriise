# -*- coding: utf-8 -*-
import odoo
from odoo.addons.account.tests.account_test_xml import AccountTestEdiCommon
from odoo.tests import tagged
from odoo.tools import misc
from odoo.exceptions import ValidationError

import base64
import os
import datetime
from freezegun import freeze_time
from pytz import timezone


@tagged('post_install', '-at_install')
class TestEdiResults(AccountTestEdiCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_mx.mx_coa'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.frozen_today = datetime.datetime(year=2017, month=1, day=1, hour=0, minute=0, second=0, tzinfo=timezone('utc'))

        # Allow to see the full result of AssertionError.
        cls.maxDiff = None

        # ==== Config ====

        cls.certificate = cls.env['l10n_mx_edi.certificate'].create({
            'content': base64.encodebytes(misc.file_open(os.path.join('l10n_mx_edi', 'demo', 'pac_credentials', 'certificate.cer'), 'rb').read()),
            'key': base64.encodebytes(misc.file_open(os.path.join('l10n_mx_edi', 'demo', 'pac_credentials', 'certificate.key'), 'rb').read()),
            'password': '12345678a',
        })
        cls.certificate.write({
            'date_start': '2016-01-01 01:00:00',
            'date_end': '2018-01-01 01:00:00',
        })

        cls.company_data['company'].write({
            'vat': 'EKU9003173C9',
            'street_name': 'Campobasso Norte',
            'street2': 'Fraccionamiento Montecarlo',
            'street_number': '3206',
            'street_number2': '9000',
            'zip': '85134',
            'city': 'Ciudad Obregón',
            'country_id': cls.env.ref('base.mx').id,
            'state_id': cls.env.ref('base.state_mx_son').id,
            'l10n_mx_edi_pac': 'solfact',
            'l10n_mx_edi_pac_test_env': True,
            'l10n_mx_edi_fiscal_regime': '601',
            'l10n_mx_edi_locality_id': cls.env.ref('l10n_mx_edi.res_locality_mx_son_04').id,
            'l10n_mx_edi_certificate_ids': [(6, 0, cls.certificate.ids)],
        })

        cls.currency_data['currency'].l10n_mx_edi_decimal_places = 3

        # Replace the USD by Gol to test external trade.
        cls.fake_usd_data = cls.setup_multi_currency_data(default_values={
            'name': 'FUSD',
            'symbol': '$',
            'rounding': '0.01',
            'l10n_mx_edi_decimal_places': 2,
        }, rate2016=6.0, rate2017=4.0)
        cls.cr.execute('''
            UPDATE ir_model_data
            SET res_id = %s
            WHERE module = %s AND name = %s
        ''', [cls.fake_usd_data['currency'].id, 'base', 'USD'])

        # Prevent the xsd validation because it could lead to a not-deterministic behavior since the xsd is downloaded
        # by a CRON.
        xsd_attachment = cls.env.ref('l10n_mx_edi.xsd_cached_cfdv33_xsd', False)
        if xsd_attachment:
            xsd_attachment.unlink()

        # ==== Business ====

        cls.tax_16 = cls.env['account.tax'].create({
            'name': 'tax_16',
            'amount_type': 'percent',
            'amount': 16,
            'type_tax_use': 'sale',
            'l10n_mx_cfdi_tax_type': 'Tasa',
        })

        cls.tax_10_negative = cls.env['account.tax'].create({
            'name': 'tax_10_negative',
            'amount_type': 'percent',
            'amount': -10,
            'type_tax_use': 'sale',
            'l10n_mx_cfdi_tax_type': 'Tasa',
        })

        cls.tax_group = cls.env['account.tax'].create({
            'name': 'tax_group',
            'amount_type': 'group',
            'amount': 0.0,
            'type_tax_use': 'sale',
            'children_tax_ids': [(6, 0, (cls.tax_16 + cls.tax_10_negative).ids)],
        })

        cls.product = cls.env['product.product'].create({
            'name': 'product_mx',
            'weight': 2,
            'uom_po_id': cls.env.ref('uom.product_uom_kgm').id,
            'uom_id': cls.env.ref('uom.product_uom_kgm').id,
            'lst_price': 1000.0,
            'property_account_income_id': cls.company_data['default_account_revenue'].id,
            'property_account_expense_id': cls.company_data['default_account_expense'].id,
            'unspsc_code_id': cls.env.ref('product_unspsc.unspsc_code_01010101').id,
            'l10n_mx_edi_tariff_fraction_id': cls.env.ref('l10n_mx_edi_external_trade.tariff_fraction_72123099').id,
            'l10n_mx_edi_umt_aduana_id': cls.env.ref('uom.product_uom_unit').id,
        })

        cls.payment_term = cls.env['account.payment.term'].create({
            'name': 'test l10n_mx_edi',
            'line_ids': [(0, 0, {
                'value': 'balance',
                'value_amount': 0.0,
                'days': 90,
                'option': 'day_after_invoice_date',
            })],
        })

        cls.partner_a.write({
            'property_supplier_payment_term_id': cls.payment_term.id,
            'country_id': cls.env.ref('base.us').id,
            'state_id': cls.env.ref('base.state_us_23').id,
            'zip': 39301,
            'vat': '123456789',
            'l10n_mx_edi_external_trade': True,
        })

        # ==== Records needing CFDI ====

        cls.invoice = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'currency_id': cls.currency_data['currency'].id,
            'invoice_incoterm_id': cls.env.ref('account.incoterm_FCA').id,
            'invoice_line_ids': [(0, 0, {
                'product_id': cls.product.id,
                'price_unit': 2000.0,
                'quantity': 5,
                'discount': 20.0,
                'tax_ids': [(6, 0, (cls.tax_16 + cls.tax_10_negative).ids)],
            })],
        })

        cls.expected_invoice_cfdi_values = '''
            <Comprobante
                Certificado="___ignore___"
                Fecha="2017-01-01T17:00:00"
                Folio="1"
                FormaPago="99"
                LugarExpedicion="85134"
                MetodoPago="PUE"
                Moneda="Gol"
                NoCertificado="''' + cls.certificate.serial_number + '''"
                Serie="INV/2017/01/"
                Sello="___ignore___"
                Descuento="2000.000"
                SubTotal="10000.000"
                Total="8480.000"
                TipoCambio="0.500000"
                TipoDeComprobante="I"
                Version="3.3">
                <Emisor
                    Rfc="EKU9003173C9"
                    Nombre="company_1_data"
                    RegimenFiscal="601"/>
                <Receptor
                    Rfc="XEXX010101000"
                    Nombre="partner_a"
                    UsoCFDI="P01"/>
                <Conceptos>
                    <Concepto
                        Cantidad="5.000000"
                        ClaveProdServ="01010101"
                        Descripcion="product_mx"
                        Importe="10000.000"
                        Descuento="2000.000"
                        ValorUnitario="2000.000">
                        <Impuestos>
                            <Traslados>
                                <Traslado
                                    Base="8000.000"
                                    Importe="1280.00"
                                    TasaOCuota="0.160000"
                                    TipoFactor="Tasa"/>
                            </Traslados>
                            <Retenciones>
                                <Retencion
                                    Base="8000.000"
                                    Importe="800.00"
                                    TasaOCuota="0.100000"
                                    TipoFactor="Tasa"/>
                            </Retenciones>
                        </Impuestos>
                    </Concepto>
                </Conceptos>
                <Impuestos
                    TotalImpuestosRetenidos="800.000"
                    TotalImpuestosTrasladados="1280.000">
                    <Retenciones>
                        <Retencion
                            Importe="800.000"/>
                    </Retenciones>
                    <Traslados>
                        <Traslado
                            Importe="1280.000"
                            TasaOCuota="0.160000"
                            TipoFactor="Tasa"/>
                    </Traslados>
                </Impuestos>
            </Comprobante>
        '''

        cls.payment = cls.env['account.payment'].create({
            'date': '2017-01-01',
            'amount': cls.invoice.amount_total,
            'payment_type': 'inbound',
            'partner_type': 'customer',
            'partner_id': cls.partner_a.id,
            'currency_id': cls.currency_data['currency'].id,
            'payment_method_id': cls.env.ref('account.account_payment_method_manual_out').id,
            'journal_id': cls.company_data['default_journal_bank'].id,
        })

        # payment done on 2017-01-01 00:00:00 UTC is expected to be signed on 2016-12-31 17:00:00 in Mexico tz
        cls.expected_payment_cfdi_values = '''
            <Comprobante
                Certificado="___ignore___"
                Fecha="2016-12-31T17:00:00"
                Folio="1"
                LugarExpedicion="85134"
                Moneda="XXX"
                NoCertificado="''' + cls.certificate.serial_number + '''"
                Serie="BNK1/2017/01/"
                Sello="___ignore___"
                SubTotal="0"
                Total="0"
                TipoDeComprobante="P"
                Version="3.3">
                <Emisor
                    Rfc="EKU9003173C9"
                    Nombre="company_1_data"
                    RegimenFiscal="601"/>
                <Receptor
                    Rfc="XEXX010101000"
                    Nombre="partner_a"
                    ResidenciaFiscal="USA"
                    UsoCFDI="P01"/>
                <Conceptos>
                    <Concepto
                        Cantidad="1"
                        ClaveProdServ="84111506"
                        ClaveUnidad="ACT"
                        Descripcion="Pago"
                        Importe="0"
                        ValorUnitario="0"/>
                </Conceptos>
                <Complemento>
                    <Pagos
                        Version="1.0">
                        <Pago
                            FechaPago="2017-01-01T12:00:00"
                            MonedaP="Gol"
                            Monto="8480.00"
                            TipoCambioP="0.500000">
                            <DoctoRelacionado
                                Folio="1"
                                IdDocumento="123456789"
                                ImpPagado="8480.00"
                                ImpSaldoAnt="8480.00"
                                ImpSaldoInsoluto="0.00"
                                MetodoDePagoDR="PUE"
                                MonedaDR="Gol"
                                NumParcialidad="1"
                                Serie="INV/2017/01/"/>
                        </Pago>
                    </Pagos>
                </Complemento>
            </Comprobante>
        '''

    def without_web_services(self):
        ''' Helper to avoid calling the web-services because the purpose of these tests are to check the rendering of
        the CFDI template.

        :param invoices:    An account.move recordset.
        :return:            A context manager preventing calls to web-services.
        '''

        # Ensure SolFact can't be called by breaking the SOAP request.
        class WithoutSoapRequest:
            def __enter__(self):
                self.Transport = odoo.addons.l10n_mx_edi.models.account_invoice.Transport
                odoo.addons.l10n_mx_edi.models.account_invoice.Transport = None

            def __exit__(self, type, value, traceback):
                odoo.addons.l10n_mx_edi.models.account_invoice.Transport = self.Transport

        return WithoutSoapRequest()

    # -------------------------------------------------------------------------
    # INVOICES
    # -------------------------------------------------------------------------

    def test_invoice_cfdi_no_external_trade(self):
        self.invoice.l10n_mx_edi_external_trade = False
        with freeze_time(self.frozen_today), self.without_web_services():
            self.invoice.action_post()

            edi_vals = self.invoice._l10n_mx_edi_create_cfdi()
            self.assertTrue('cfdi' in edi_vals)

            current_etree = self.get_xml_tree_from_string(edi_vals['cfdi'])
            expected_etree = self.get_xml_tree_from_string(self.expected_invoice_cfdi_values)
            self.assertXmlTreeEqual(current_etree, expected_etree)

    def test_invoice_cfdi_group_of_taxes(self):
        self.invoice.write({
            'l10n_mx_edi_external_trade': False,
            'invoice_line_ids': [(1, self.invoice.invoice_line_ids.id, {'tax_ids': [(6, 0, self.tax_group.ids)]})],
        })

        with freeze_time(self.frozen_today), self.without_web_services():
            self.invoice.action_post()

            edi_vals = self.invoice._l10n_mx_edi_create_cfdi()
            self.assertTrue('cfdi' in edi_vals)

            current_etree = self.get_xml_tree_from_string(edi_vals['cfdi'])
            expected_etree = self.get_xml_tree_from_string(self.expected_invoice_cfdi_values)
            self.assertXmlTreeEqual(current_etree, expected_etree)

    def test_invoice_cfdi_external_trade(self):
        self.invoice.l10n_mx_edi_external_trade = True
        self.invoice.partner_id.l10n_mx_edi_external_trade = True

        with freeze_time(self.frozen_today), self.without_web_services():
            self.invoice.action_post()

            edi_vals = self.invoice._l10n_mx_edi_create_cfdi()
            self.assertTrue('cfdi' in edi_vals)

            current_etree = self.get_xml_tree_from_string(edi_vals['cfdi'])
            expected_etree = self.with_applied_xpath(
                self.get_xml_tree_from_string(self.expected_invoice_cfdi_values),
                '''
                    <xpath expr="//Receptor" position="attributes">
                        <attribute name="NumRegIdTrib">123456789</attribute>
                        <attribute name="ResidenciaFiscal">USA</attribute>
                    </xpath>
                    <xpath expr="//Comprobante" position="inside">
                        <Complemento>
                            <ComercioExterior
                                CertificadoOrigen="0"
                                ClaveDePedimento="A1"
                                Incoterm="FCA"
                                Subdivision="0"
                                TipoCambioUSD="0.250000"
                                TipoOperacion="2"
                                TotalUSD="20000.00"
                                Version="1.1">
                                <Emisor>
                                    <Domicilio
                                        Calle="Campobasso"
                                        CodigoPostal="85134"
                                        Estado="SON"
                                        Localidad="04"
                                        NumeroExterior="Norte 3206"
                                        NumeroInterior="9000"
                                        Pais="MEX"/>
                                </Emisor>
                                <Receptor>
                                    <Domicilio
                                        CodigoPostal="39301"
                                        Estado="NV"
                                        Pais="USA"/>
                                </Receptor>
                                <Mercancias>
                                    <Mercancia
                                        FraccionArancelaria="72123099"
                                        UnidadAduana="06"
                                        ValorDolares="20000.00"
                                        CantidadAduana="0.000"
                                        ValorUnitarioAduana="0.00"/>
                                </Mercancias>
                            </ComercioExterior>
                        </Complemento>
                    </xpath>
                ''',
            )
            self.assertXmlTreeEqual(current_etree, expected_etree)

    def test_invoice_cfdi_addenda(self):
        self.invoice.l10n_mx_edi_external_trade = False

        # Setup an addenda on the partner.
        self.invoice.partner_id.l10n_mx_edi_addenda = self.env['ir.ui.view'].create({
            'name': 'test_invoice_cfdi_addenda',
            'type': 'qweb',
            'arch': """
                <t t-name="l10n_mx_edi.test_invoice_cfdi_addenda">
                    <test info="this is an addenda"/>
                </t>
            """
        })

        with freeze_time(self.frozen_today), self.without_web_services():
            self.invoice.action_post()

            edi_vals = self.invoice._l10n_mx_edi_create_cfdi()
            self.assertTrue('cfdi' in edi_vals)
            cfdi = base64.decodebytes(self.invoice.l10n_mx_edi_append_addenda(base64.encodebytes(edi_vals['cfdi'])))

            current_etree = self.get_xml_tree_from_string(cfdi)
            expected_etree = self.with_applied_xpath(
                self.get_xml_tree_from_string(self.expected_invoice_cfdi_values),
                '''
                    <xpath expr="//Comprobante" position="inside">
                        <Addenda>
                            <test info="this is an addenda"/>
                        </Addenda>
                    </xpath>
                ''',
            )
            self.assertXmlTreeEqual(current_etree, expected_etree)

    def test_invoice_cfdi_customs_number(self):
        self.invoice.l10n_mx_edi_external_trade = False

        # The format of the customs number is incorrect.
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self.invoice.invoice_line_ids.l10n_mx_edi_customs_number = '15  48  30  001234'

        self.invoice.invoice_line_ids.l10n_mx_edi_customs_number = '15  48  3009  0001234,15  48  3009  0001235'

        with freeze_time(self.frozen_today), self.without_web_services():
            self.invoice.action_post()

            edi_vals = self.invoice._l10n_mx_edi_create_cfdi()
            self.assertTrue('cfdi' in edi_vals)

            current_etree = self.get_xml_tree_from_string(edi_vals['cfdi'])
            expected_etree = self.with_applied_xpath(
                self.get_xml_tree_from_string(self.expected_invoice_cfdi_values),
                '''
                    <xpath expr="//Concepto" position="inside">
                        <InformacionAduanera NumeroPedimento="15  48  3009  0001234"/>
                        <InformacionAduanera NumeroPedimento="15  48  3009  0001235"/>
                    </xpath>
                ''',
            )
            self.assertXmlTreeEqual(current_etree, expected_etree)

    # -------------------------------------------------------------------------
    # PAYMENTS
    # -------------------------------------------------------------------------

    def test_payment_cfdi(self):
        with freeze_time(self.frozen_today), self.without_web_services():
            self.invoice.action_post()
            self.payment.action_post()

            # Fake the fact the invoice is signed.
            self.invoice.l10n_mx_edi_cfdi_uuid = '123456789'

            (self.invoice.line_ids + self.payment.line_ids)\
                .filtered(lambda line: line.account_internal_type == 'receivable')\
                .reconcile()

            edi_vals = self.payment._l10n_mx_edi_create_cfdi_payment()
            self.assertTrue('cfdi' in edi_vals)

            current_etree = self.get_xml_tree_from_string(edi_vals['cfdi'])
            expected_etree = self.get_xml_tree_from_string(self.expected_payment_cfdi_values)
            self.assertXmlTreeEqual(current_etree, expected_etree)
