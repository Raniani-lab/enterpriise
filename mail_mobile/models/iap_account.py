# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class IapAccount(models.Model):
    _inherit = 'iap.account'

    def _neutralize(self):
        super()._neutralize()
        self.env.cr.execute("""
            DELETE FROM ir_config_parameter
            WHERE key IN ('odoo_ocn.project_id', 'ocn.uuid')
        """)

    def _get_iap_config_parameters(self):
        return super()._get_iap_config_parameters() + ['odoo_ocn.endpoint']
