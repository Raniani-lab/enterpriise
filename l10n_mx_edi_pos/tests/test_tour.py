# -*- coding: utf-8 -*-

from odoo.tests import tagged
from odoo.addons.point_of_sale.tests.test_frontend import TestPointOfSaleHttpCommon
from odoo.addons.l10n_mx_edi.tests.common import TestMxEdiCommon


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestUi(TestPointOfSaleHttpCommon, TestMxEdiCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref="mx"):
        super().setUpClass(chart_template_ref=chart_template_ref)

    def test_mx_pos_invoice_order(self):
        self.product.available_in_pos = True
        self.start_tour("/web", "l10n_mx_edi_pos.tour_invoice_order", login=self.env.user.login)

    def test_mx_pos_invoice_previous_order(self):
        self.product.available_in_pos = True
        self.start_tour("/web", "l10n_mx_edi_pos.tour_invoice_previous_order", login=self.env.user.login)
        invoice = self.env['account.move'].search([('move_type', '=', 'out_invoice')], order='id desc', limit=1)
        self.assertEqual(invoice.l10n_mx_edi_usage, 'G03', 'Invoice values not saved')
        self.assertEqual(invoice.l10n_mx_edi_cfdi_to_public, True, 'Invoice values not saved')
