# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    module_pos_iot = fields.Boolean('IoT Box', related="is_posbox")

    def _get_modules_to_check(self, changed_fields):
        result = super()._get_modules_to_check(changed_fields)
        for field in changed_fields:
            if field == 'is_posbox':
                result.append('iot')
        return result
