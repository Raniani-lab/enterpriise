# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, api, _

from datetime import datetime
from collections import defaultdict


class IntrastatExpiryReport(models.AbstractModel):
    _inherit = 'account.intrastat.report'

    @api.model
    def _fill_missing_values(self, vals, cache=None):
        for val in vals:
            # set transaction_code default value if none, code "1" is expired from 2022-01-01, replaced by code "11"
            if not val['transaction_code']:
                val['transaction_code'] = 1 if val['invoice_date'] < datetime.strptime('2022-01-01', '%Y-%m-%d').date() else 11

        res = super()._fill_missing_values(vals, cache)

        return res
