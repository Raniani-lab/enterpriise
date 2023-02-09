# -*- coding: utf-8 -*-

from odoo.tests import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingHttpCommon


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestUi(AccountTestInvoicingHttpCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref="mx"):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.env.company.country_id = cls.env.ref('base.mx')

        payment_method = cls.env['pos.payment.method'].create({
            'name': "Cash",
            'journal_id': cls.company_data['default_journal_cash'].id,
        })

        cls.env['pos.config'].create({
            'name': "MX Pos config",
            'payment_method_ids': payment_method.ids,
        })

    def test_mx_pos_invoice_order(self):
        self.start_tour("/web", "l10n_mx_edi_pos.tour_invoice_order", login=self.env.user.login)

    def test_mx_pos_invoice_previous_order(self):
        self.start_tour("/web", "l10n_mx_edi_pos.tour_invoice_previous_order", login=self.env.user.login)
