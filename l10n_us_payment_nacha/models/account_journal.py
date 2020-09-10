# coding: utf-8
from odoo import api, fields, models

class AccountJournal(models.Model):
    _inherit = "account.journal"

    nacha_immediate_destination = fields.Char(help="This will be provided by your bank.")
    nacha_destination = fields.Char(help="This will be provided by your bank.")
    nacha_immediate_origin = fields.Char(help="This will be provided by your bank.")
    nacha_company_identification = fields.Char(help="This will be provided by your bank.")
    nacha_origination_dfi_identification = fields.Char(help="This will be provided by your bank.")

    @api.depends('type', 'country_code')
    def _compute_outbound_payment_method_ids(self):
        # OVERRIDE
        res = super()._compute_outbound_payment_method_ids()
        nacha_payment_method = self.env.ref('l10n_us_payment_nacha.account_payment_method_nacha')
        for journal in self:
            if journal.type == 'bank' and journal.country_code == 'US':
                journal.outbound_payment_method_ids |= nacha_payment_method
        return res
