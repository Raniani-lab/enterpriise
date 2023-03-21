# -*- coding: utf-8 -*-
from .common import TestMXEdiStockCommon
from odoo.tests import tagged

from freezegun import freeze_time


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestCFDIPickingXml(TestMXEdiStockCommon):

    def test_delivery_guide(self):
        with freeze_time(self.frozen_today), self.with_mocked_pac_sign_success():
            picking = self._create_picking()
            picking.l10n_mx_edi_cfdi_try_send()

            self._assert_picking_cfdi(picking, 'test_delivery_guide')
