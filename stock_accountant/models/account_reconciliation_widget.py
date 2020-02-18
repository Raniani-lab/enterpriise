# -*- coding: utf-8 -*-

from odoo import api, models
from odoo.osv import expression


class AccountReconciliation(models.AbstractModel):
    _inherit = "account.reconciliation.widget"

    @api.model
    def _get_query_reconciliation_widget_miscellaneous_matching_lines(self, statement_line, domain=[]):
        # OVERRIDE
        account_properties = (
            'property_stock_account_input',
            'property_stock_account_output',
            'property_stock_account_input_categ_id',
            'property_stock_account_output_categ_id',
        )
        value_references = self.env['ir.property'].sudo()\
            .search([('name', 'in', account_properties), ('value_reference', '!=', False)])\
            .mapped('value_reference')

        account_ids = []
        for value_reference in value_references:
            try:
                account_ids.append(int(value_reference.split(',')[-1]))
            except:
                pass
        if account_ids:
            domain.append(('account_id', 'not in', tuple(account_ids)))
        return super()._get_query_reconciliation_widget_miscellaneous_matching_lines(statement_line, domain=domain)
