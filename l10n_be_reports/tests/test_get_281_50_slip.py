# -*- coding: utf-8 -*-

from freezegun import freeze_time
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.addons.l10n_be_reports.models.res_partner import format_if_float
from odoo.tests import tagged
from odoo import fields, Command


@tagged('post_install_l10n', 'post_install', '-at_install')
@freeze_time('2022-03-01')
class TestResPartner(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_be.l10nbe_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.invoice = cls.init_invoice('in_invoice')

        cls.product_line_vals_1 = {
            'name': cls.product_a.name,
            'product_id': cls.product_a.id,
            'account_id': cls.product_a.property_account_expense_id.id,
            'partner_id': cls.partner_a.id,
            'product_uom_id': cls.product_a.uom_id.id,
            'quantity': 1.0,
            'discount': 0.0,
            'price_unit': 1000.0,
            'price_subtotal': 1000.0,
            'price_total': 1150,
            'tax_ids': cls.product_a.supplier_taxes_id.ids,
            'tax_line_id': False,
            'currency_id': False,
            'amount_currency': 0.0,
            'debit': 1000.0,
            'credit': 0.0,
            'date_maturity': False,
        }
        cls.tax_line_vals_1 = {
            'name': cls.tax_purchase_a.name,
            'product_id': False,
            'account_id': cls.company_data['default_account_tax_purchase'].id,
            'partner_id': cls.partner_a.id,
            'product_uom_id': False,
            'quantity': 1.0,
            'discount': 0.0,
            'price_unit': 150,
            'price_subtotal': 150,
            'price_total': 150,
            'tax_ids': [],
            'tax_line_id': cls.tax_purchase_a.id,
            'currency_id': False,
            'amount_currency': 0.0,
            'debit': 150,
            'credit': 0.0,
            'date_maturity': False,
        }
        cls.term_line_vals_1 = {
            'name': '',
            'product_id': False,
            'account_id': cls.company_data['default_account_payable'].id,
            'partner_id': cls.partner_a.id,
            'product_uom_id': False,
            'quantity': 1.0,
            'discount': 0.0,
            'price_unit': -1150.0,
            'price_subtotal': -1150.0,
            'price_total': -1150.0,
            'tax_ids': [],
            'tax_line_id': False,
            'currency_id': False,
            'amount_currency': 0.0,
            'debit': 0.0,
            'credit': 1150.0,
            'date_maturity': fields.Date.from_string('2000-05-12'),
        }
        cls.partner_a.write({
            'street': 'Rue du Jacobet, 9',
            'zip': '7100',
            'city': 'La Louvière',
            'country_id': cls.env.ref('base.be').id,
            'vat': 'BE0475646428',
            'is_company': True,
            'category_id': [(4, cls.env.ref('l10n_be_reports.res_partner_tag_281_50').id)]
        })
        cls.partner_a_information = {
            'name': 'partner_a',
            'address': 'Rue du Jacobet, 9',
            'zip': '7100',
            'country_code': 'BE',
            'country_name': 'Belgium',
            'city': 'La Louvière',
            'nature': '2',
            'bce_number': '0475646428',
            'remunerations': {
                'commissions': 1000.0,
                'fees': 0.0,
                'atn': 0.0,
                'exposed_expenses': 0.0,
            },
            'paid_amount': 826.45,
            'total_amount': 1000.0,
            'job_position': False,
            'citizen_identification': False
        }
        cls.wizard_values = {
            'reference_year': '2000',
            'is_test': False,
            'type_sending': '0',
            'type_treatment': '0',
        }
        cls.xml_281_50_value = b"""<?xml version='1.0' encoding='utf-8'?>
            <Verzendingen>
                <Verzending>
                    <v0002_inkomstenjaar>2000</v0002_inkomstenjaar>
                    <v0010_bestandtype>BELCOTAX</v0010_bestandtype>
                    <v0011_aanmaakdatum>01-03-2022</v0011_aanmaakdatum>
                    <v0014_naam>company_1_data</v0014_naam>
                    <v0015_adres>Rue du Laid Burniat 5, </v0015_adres>
                    <v0016_postcode>1348</v0016_postcode>
                    <v0017_gemeente>Ottignies-Louvain-la-Neuve </v0017_gemeente>
                    <v0018_telefoonnummer>+3222903490</v0018_telefoonnummer>
                    <v0021_contactpersoon>Because I am accountman!</v0021_contactpersoon>
                    <v0022_taalcode>2</v0022_taalcode>
                    <v0023_emailadres>accountman@test.com</v0023_emailadres>
                    <v0024_nationaalnr>0477472701</v0024_nationaalnr>
                    <v0025_typeenvoi>0</v0025_typeenvoi>
                    <Aangiften>
                        <Aangifte>
                            <a1002_inkomstenjaar>2000</a1002_inkomstenjaar>
                            <a1005_registratienummer>0477472701</a1005_registratienummer>
                            <a1011_naamnl1>company_1_data</a1011_naamnl1>
                            <a1013_adresnl>Rue du Laid Burniat 5</a1013_adresnl>
                            <a1014_postcodebelgisch>1348</a1014_postcodebelgisch>
                            <a1015_gemeente>Ottignies-Louvain-la-Neuve </a1015_gemeente>
                            <a1016_landwoonplaats>00000</a1016_landwoonplaats>
                            <a1020_taalcode>1</a1020_taalcode>
                            <Opgaven>
                                <Opgave32550>
                                    <Fiche28150>
                                        <f2002_inkomstenjaar>2000</f2002_inkomstenjaar>
                                        <f2005_registratienummer>0477472701</f2005_registratienummer>
                                        <f2008_typefiche>28150</f2008_typefiche>
                                        <f2009_volgnummer>0</f2009_volgnummer>
                                        <f2013_naam>partner_a</f2013_naam>
                                        <f2015_adres>Rue du Jacobet, 9</f2015_adres>
                                        <f2016_postcodebelgisch>7100</f2016_postcodebelgisch>
                                        <f2017_gemeente>La Louvi\xc3\xa8re</f2017_gemeente>
                                        <f2018_landwoonplaats>00000</f2018_landwoonplaats>
                                        <f2028_typetraitement>0</f2028_typetraitement>
                                        <f2029_enkelopgave325>0</f2029_enkelopgave325>
                                        <f2105_birthplace>0</f2105_birthplace>
                                        <f2112_buitenlandspostnummer/>
                                        <f2114_voornamen/>
                                        <f50_2030_aardpersoon>2</f50_2030_aardpersoon>
                                        <f50_2031_nihil>0</f50_2031_nihil>
                                        <f50_2059_totaalcontrole>282645</f50_2059_totaalcontrole>
                                        <f50_2060_commissies>100000</f50_2060_commissies>
                                        <f50_2061_erelonenofvacatie>0</f50_2061_erelonenofvacatie>
                                        <f50_2062_voordelenaardbedrag>0</f50_2062_voordelenaardbedrag>
                                        <f50_2063_kosten>0</f50_2063_kosten>
                                        <f50_2064_totaal>100000</f50_2064_totaal>
                                        <f50_2065_werkelijkbetaaldb>82645</f50_2065_werkelijkbetaaldb>
                                        <f50_2066_sportremuneration>0</f50_2066_sportremuneration>
                                        <f50_2067_managerremuneration>0</f50_2067_managerremuneration>
                                        <f50_2099_comment/>
                                        <f50_2103_advantagenature/>
                                        <f50_2107_uitgeoefendberoep/>
                                        <f50_2109_fiscaalidentificat/>
                                        <f50_2110_kbonbr>0475646428</f50_2110_kbonbr>
                                    </Fiche28150>
                                </Opgave32550>
                            </Opgaven>
                            <r8002_inkomstenjaar>2000</r8002_inkomstenjaar>
                            <r8005_registratienummer>0477472701</r8005_registratienummer>
                            <r8010_aantalrecords>3</r8010_aantalrecords>
                            <r8011_controletotaal>0</r8011_controletotaal>
                            <r8012_controletotaal>282645</r8012_controletotaal>
                        </Aangifte>
                    </Aangiften>
                    <r9002_inkomstenjaar>2000</r9002_inkomstenjaar>
                    <r9010_aantallogbestanden>3</r9010_aantallogbestanden>
                    <r9011_totaalaantalrecords>5</r9011_totaalaantalrecords>
                    <r9012_controletotaal>0</r9012_controletotaal>
                    <r9013_controletotaal>282645</r9013_controletotaal>
                </Verzending>
            </Verzendingen>"""
        cls.tag_281_50_commissions = cls.env.ref('l10n_be_reports.account_tag_281_50_commissions')
        cls.tag_281_50_fees = cls.env.ref('l10n_be_reports.account_tag_281_50_fees')
        cls.tag_281_50_atn = cls.env.ref('l10n_be_reports.account_tag_281_50_atn')
        cls.tag_281_50_exposed_expenses = cls.env.ref('l10n_be_reports.account_tag_281_50_exposed_expenses')

        cls.env.company.vat = 'BE0477472701'
        cls.env.company.phone = '+3222903490'
        cls.env.company.street = 'Rue du Laid Burniat 5'
        cls.env.company.zip = '1348'
        cls.env.company.city = 'Ottignies-Louvain-la-Neuve '
        cls.env.company.country_id = cls.env.ref('base.be').id

    def test_res_partner_get_paid_amount(self):
        '''Checking of the paid total value for a specific partner.'''
        move = self.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': fields.Date.from_string('2000-05-12'),
            'currency_id': self.currency_data['currency'].id,
            'invoice_payment_term_id': self.pay_terms_a.id,
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_line_vals_1['product_id'],
                    'product_uom_id': self.product_line_vals_1['product_uom_id'],
                    'price_unit': self.product_line_vals_1['price_unit'],
                    'tax_ids': [Command.set(self.product_line_vals_1['tax_ids'])],
                }),
            ],
        })
        move.invoice_line_ids.account_id.tag_ids |= self.tag_281_50_commissions
        move.action_post()

        payment_dicts = []
        for i in range(2):
            payment_dicts.append({
                'payment_type': 'outbound',
                'amount': 500,
                'currency_id': self.currency_data['currency'].id,
                'journal_id': self.company_data['default_journal_bank'].id,
                'date': fields.Date.from_string('200%s-05-12' % i),
                'partner_id': self.partner_a.id,
                'payment_method_line_id': self.outbound_payment_method_line.id,
                'partner_type': 'supplier'
            })

        payments = self.env['account.payment'].create(payment_dicts)
        payments.action_post()

        payable_move_lines = move.mapped('line_ids').filtered(lambda x: x.account_internal_type == 'payable')
        payable_move_lines += payments.line_ids.filtered(lambda x: x.account_internal_type == 'payable')
        payable_move_lines.reconcile()

        move.flush()
        payments.flush()

        self.assertEqual(move.amount_residual, 210.0)

        tags = self.env['account.account.tag'] + self.tag_281_50_commissions + self.tag_281_50_fees + self.tag_281_50_atn + self.tag_281_50_exposed_expenses
        paid_amount_per_partner = self.partner_a._get_paid_amount_per_partner('2000', tags)
        paid_amount_for_partner_a = paid_amount_per_partner.get(self.partner_a.id, 0.0)
        self.assertEqual(paid_amount_for_partner_a, 413.22)

        paid_amount_per_partner = self.partner_a._get_paid_amount_per_partner('2001', tags)
        paid_amount_for_partner_a = paid_amount_per_partner.get(self.partner_a.id, 0.0)
        self.assertEqual(paid_amount_for_partner_a, 413.22)

    def test_res_partner_get_partner_information(self):
        '''Checking of all information about a specific partner.'''

        move = self.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': fields.Date.from_string('2000-05-12'),
            'currency_id': self.currency_data['currency'].id,
            'invoice_payment_term_id': self.pay_terms_a.id,
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_line_vals_1['product_id'],
                    'product_uom_id': self.product_line_vals_1['product_uom_id'],
                    'price_unit': self.product_line_vals_1['price_unit'],
                    'tax_ids': [Command.set(self.product_line_vals_1['tax_ids'])],
                }),
            ],
        })
        move.invoice_line_ids.account_id.tag_ids |= self.tag_281_50_commissions
        move.action_post()

        payment = self.env['account.payment'].create({
            'payment_type': 'outbound',
            'amount': 1000,
            'currency_id': self.currency_data['currency'].id,
            'journal_id': self.company_data['default_journal_bank'].id,
            'date': fields.Date.from_string('2000-05-12'),
            'partner_id': self.partner_a.id,
            'payment_method_line_id': self.outbound_payment_method_line.id,
            'partner_type': 'supplier'
        })
        payment.action_post()

        payable_move_lines = move.mapped('line_ids').filtered(lambda x: x.account_internal_type == 'payable')
        payable_move_lines += payment.line_ids.filtered(lambda x: x.account_internal_type == 'payable')
        payable_move_lines.reconcile()

        move.flush()
        payment.flush()

        tags = self.env['account.account.tag'] + self.tag_281_50_commissions + self.tag_281_50_fees + self.tag_281_50_atn + self.tag_281_50_exposed_expenses
        paid_amount_per_partner = self.partner_a._get_paid_amount_per_partner('2000', tags)
        paid_amount_for_partner_a = paid_amount_per_partner.get(self.partner_a.id, 0.0)

        commissions_amounts = self.partner_a._get_balance_per_partner(self.tag_281_50_commissions, '2000')
        commissions_balance_for_partner_a = commissions_amounts.get(self.partner_a.id, 0.0)

        partner_remuneration = {
            'commissions': commissions_balance_for_partner_a,
            'fees': 0.0,
            'atn': 0.0,
            'exposed_expenses': 0.0,
        }
        partner_information = self.partner_a._get_partner_information(partner_remuneration, paid_amount_for_partner_a)
        self.assertEqual(self.partner_a_information, partner_information)

        values_dict = self.partner_a._generate_codes_values(self.wizard_values, partner_information)

        # Check the generated xml
        formated_values_dict = {k: format_if_float(v) for k, v in values_dict.items()}
        xml_value = self.partner_a._generate_281_50_xml(formated_values_dict)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(xml_value),
            self.get_xml_tree_from_string(self.xml_281_50_value),
        )
