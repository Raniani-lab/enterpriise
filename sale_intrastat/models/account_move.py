# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    intrastat_country_id = fields.Many2one(
        compute='_compute_intrastat_country_id', store=True)

    def _get_invoice_intrastat_country_id(self):
        # OVERRIDE
        self.ensure_one()
        if self.is_sale_document():
            return self.partner_shipping_id.country_id.id
        return super(AccountMove, self)._get_invoice_intrastat_country_id()

    @api.depends('partner_shipping_id')
    def _compute_intrastat_country_id(self):
        for move in self:
            move.intrastat_country_id = move._get_invoice_intrastat_country_id()
