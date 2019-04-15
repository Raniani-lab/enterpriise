# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class StockRule(models.Model):
    _inherit = 'stock.rule'

    def _make_po_get_domain(self, company_id, values, partner):
        """ Avoid to merge two RFQ for the same MPS replenish. """
        domain = super(StockRule, self)._make_po_get_domain(company_id, values, partner)
        if values.get('skip_lead_time', False) and values.get('date_planned', False):
            domain += (('date_planned', '=', values['date_planned']),)
        return domain
