# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_reports.tests.account_sales_report_common import AccountSalesReportCommon
from odoo.tests import tagged
from freezegun import freeze_time


@tagged('post_install', '-at_install')
class LuxembourgSalesReportTest(AccountSalesReportCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass('l10n_lu.lu_2011_chart_1')

    @classmethod
    def setup_company_data(cls, company_name, chart_template=None, **kwargs):
        res = super().setup_company_data(company_name, chart_template=chart_template, **kwargs)
        res['company'].update({
            'country_id': cls.env.ref('base.lu').id,
            'vat': 'LU75425064',
            'ecdf_prefix': '1234AB',
            'matr_number': '11111111111',
        })
        return res

    @freeze_time('2019-12-31')
    def test_ec_sales_report(self):
        l_tax = self.env['account.tax'].search([('name', '=', '0-IC-S-G'), ('company_id', '=', self.company_data['company'].id)])[0]
        t_tax = self.env['account.tax'].search([('name', '=', '0-ICT-S-G'), ('company_id', '=', self.company_data['company'].id)])[0]
        s_tax = self.env['account.tax'].search([('name', '=', '0-IC-S-S'), ('company_id', '=', self.company_data['company'].id)])[0]
        self._create_invoices([
            (self.partner_a, l_tax, 300),
            (self.partner_a, l_tax, 300),
            (self.partner_a, t_tax, 500),
            (self.partner_b, t_tax, 500),
            (self.partner_a, s_tax, 700),
            (self.partner_b, s_tax, 700),
        ])
        report = self.env['account.sales.report']
        options = report._get_options(None)
        self.assertEqual(report._get_report_country_code(options), 'LU', "The country chosen for EC Sales list should be Luxembourg")
        lines = report._get_lines(options)
        self.assertLinesValues(
            lines,
            #   Partner                country cod              VAT Number,              Tax    Amount
            [   0,                     1,                       2,                       3,     4],
            [
                (self.partner_a.name,  self.partner_a.vat[:2],  self.partner_a.vat[2:],  'L',  '600.00 €'),
                (self.partner_a.name,  self.partner_a.vat[:2],  self.partner_a.vat[2:],  'T',  '500.00 €'),
                (self.partner_b.name,  self.partner_b.vat[:2],  self.partner_b.vat[2:],  'T',  '500.00 €'),
                (self.partner_a.name,  self.partner_a.vat[:2],  self.partner_a.vat[2:],  'S',  '700.00 €'),
                (self.partner_b.name,  self.partner_b.vat[:2],  self.partner_b.vat[2:],  'S',  '700.00 €'),
            ],
        )

        report.get_report_filename(options)
        file_ref = options['filename']
        expected_xml = f'''
            <eCDFDeclarations xmlns="http://www.ctie.etat.lu/2011/ecdf">
            <FileReference>{file_ref}</FileReference>
            <eCDFFileVersion>2.0</eCDFFileVersion>
            <Interface>MODL5</Interface>
            <Agent>
                <MatrNbr>11111111111</MatrNbr>
                <RCSNbr>NE</RCSNbr>
                <VATNbr>75425064</VATNbr>
            </Agent>
            <Declarations>
                <Declarer>
                    <MatrNbr>11111111111</MatrNbr>
                    <RCSNbr>NE</RCSNbr>
                    <VATNbr>75425064</VATNbr>
                    <Declaration model="1" language="EN" type="TVA_LICM">
                        <Year>2019</Year>
                        <Period>12</Period>
                        <FormData>
                        <NumericField id="04">600,00</NumericField>
                        <NumericField id="08">1000,00</NumericField>
                        <NumericField id="16">0,00</NumericField>
                        <Table>
                            <Line num="1">
                                <TextField id="01">AA</TextField>
                                <TextField id="02">123456789</TextField>
                                <NumericField id="03">600,00</NumericField>
                            </Line>
                        </Table>
                        <Table>
                            <Line num="1">
                                <TextField id="05">AA</TextField>
                                <TextField id="06">123456789</TextField>
                                <NumericField id="07">500,00</NumericField>
                            </Line>
                            <Line num="2">
                                <TextField id="05">BB</TextField>
                                <TextField id="06">123456789</TextField>
                                <NumericField id="07">500,00</NumericField>
                            </Line>
                        </Table>
                        </FormData>
                    </Declaration>
                    <Declaration model="1" language="EN" type="TVA_PSIM">
                        <Year>2019</Year>
                        <Period>12</Period>
                        <FormData>
                        <NumericField id="04">1400,00</NumericField>
                        <NumericField id="16">0,00</NumericField>
                        <Table>
                            <Line num="1">
                                <TextField id="01">AA</TextField>
                                <TextField id="02">123456789</TextField>
                                <NumericField id="03">700,00</NumericField>
                            </Line>
                            <Line num="2">
                                <TextField id="01">BB</TextField>
                                <TextField id="02">123456789</TextField>
                                <NumericField id="03">700,00</NumericField>
                            </Line>
                        </Table>
                        </FormData>
                    </Declaration>
                </Declarer>
            </Declarations>
            </eCDFDeclarations>
            '''
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(report.get_xml(options)),
            self.get_xml_tree_from_string(expected_xml)
        )
