# -*- coding: utf-8 -*-
from odoo import models, api, _


class ReportCheckRegister(models.Model):
    '''Check Register is an accounting report usually part of the general ledger, used to record
    financial transactions in cash.
    '''
    _inherit = 'account.report'

    def _custom_options_initializer_l10n_us_reports(self, options, previous_options=None):
        self._init_options_journals(options, previous_options=previous_options, additional_journals_domain=[('type', 'in', ('bank', 'cash', 'general'))])
