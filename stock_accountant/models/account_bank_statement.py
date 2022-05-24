# -*- coding: utf-8 -*-
from odoo import models
from odoo.osv import expression


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    def _get_default_amls_matching_domain(self):
        # EXTENDS account
        domain = super()._get_default_amls_matching_domain()

        blacklisted_stock_account_ids = set()
        for account_property in [
            'property_stock_account_input',
            'property_stock_account_output',
            'property_stock_account_input_categ_id',
            'property_stock_account_output_categ_id',
        ]:
            account = self.env['ir.property']._get(account_property, "product.category")
            if account:
                blacklisted_stock_account_ids.add(account.id)

        if blacklisted_stock_account_ids:
            return expression.AND([domain, [('account_id', 'not in', tuple(blacklisted_stock_account_ids))]])
        else:
            return domain
