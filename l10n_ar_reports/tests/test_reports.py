# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.tools import date_utils
from odoo.modules.module import get_module_resource
from dateutil.relativedelta import relativedelta
import logging
import codecs

_logger = logging.getLogger(__name__)


class TestReports(TestAccountReportsCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_ar.l10nar_ri_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.maxDiff = None

        # TODO these test cases depend on demo data that could be modified by the user before
        # running the tests
        # Login to (AR) Responsable Inscripto company
        company_ri = cls.env.ref('l10n_ar.company_ri')
        cls.env.user.write({'company_ids': [(4, company_ri.id)]})
        context = dict(cls.env.context, allowed_company_ids=[company_ri.id])
        cls.env = cls.env(context=context)

        cls.vat_book = cls.env['l10n_ar.vat.book']
        today = fields.Date.today()
        cls.options = cls._init_options(
            cls,
            cls.vat_book,
            today + relativedelta(years=0, month=1, day=1),
            today + relativedelta(years=0, month=12, day=31),
        )

    def _test_txt_file(self, filename):
        out_txt = self.vat_book.get_txt(self.options).decode('ISO-8859-1')
        res_file = codecs.open(get_module_resource('l10n_ar_reports', 'tests', filename), 'r', encoding='ISO-8859-1').read()

        # The example files where generate from 2020-05-01 to 2020-05-31, we need to update this files dates to ensure
        # that will match the date where this test is running
        today = fields.Date.today()
        # Replace last date of month with last date of the last date of the next month
        res_file = res_file.replace('20200630', (fields.Date.end_of(date_utils.add(today, months=1), 'month')).strftime('%Y%m%d'))
        # change 20200514 for today's date to avoid mismatch date when creating the credit notes
        res_file = res_file.replace('20200514', today.strftime('%Y%m%d'))
        # change all 202005xx dates to the current month
        res_file = res_file.replace('202005', today.strftime('%Y%m'))

        self.assertEqual(out_txt, res_file)

    def test_01_sale_vat_book_aliquots(self):
        self.vat_book.with_context({'journal_type': 'sale'}).print_aliquots(self.options)
        self._test_txt_file('Aliquots_sale_2020-05-31.txt')

    def test_02_sale_vat_book_vouchers(self):
        self.vat_book.with_context({'journal_type': 'sale'}).print_vouchers(self.options)
        self._test_txt_file('Vouchers_sale_2020-05-31.txt')

    def test_03_purchase_vat_book_aliquots(self):
        self.vat_book.with_context({'journal_type': 'purchase'}).print_aliquots(self.options)
        self._test_txt_file('Aliquots_purchase_2020-05-31.txt')

    def test_04_purchase_vat_book_import_aliquots(self):
        self.vat_book.with_context({'journal_type': 'purchase'}).print_aliquots_import(self.options)
        self._test_txt_file('Import_Aliquots_purchase_2020-05-31.txt')

    def test_05_purchase_vat_book_vouchers(self):
        self.vat_book.with_context({'journal_type': 'purchase'}).print_vouchers(self.options)
        self._test_txt_file('Vouchers_purchase_2020-05-31.txt')
