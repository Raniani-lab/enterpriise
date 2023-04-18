# -*- coding: utf-8 -*-
from odoo import models, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def get_sii_taxpayer_types(self):
        return self._sii_taxpayer_types
