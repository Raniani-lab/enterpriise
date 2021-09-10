# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models
from odoo.addons.account.models.chart_template import template

class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    @template('co', 'account.tax')
    def _get_co_edi_account_tax(self):
        return {
            'l10n_co_tax_8': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_0').id},
            'l10n_co_tax_4': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_0').id},
            'l10n_co_tax_9': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_0').id},
            'l10n_co_tax_10': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_0').id},
            'l10n_co_tax_11': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_0').id},
            'l10n_co_tax_53': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_5').id},
            'l10n_co_tax_54': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_5').id},
            'l10n_co_tax_55': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_4').id},
            'l10n_co_tax_56': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_4').id},
            'l10n_co_tax_57': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_6').id},
            'l10n_co_tax_58': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_6').id},
            'l10n_co_tax_covered_goods': {'l10n_co_edi_type': self.env.ref('l10n_co_edi.tax_type_0').id},
        }

    @template('co', 'account.tax.group')
    def _get_co_edi_account_tax_group(self):
        return {
            'l10n_co_tax_group_iva': {'name': "IVA 19%"},
            'l10n_co_tax_group_ic': {'name': "IC"},
            'l10n_co_tax_group_ica': {'name': "ICA"},
            'l10n_co_tax_group_inc': {'name': "INC"},
            'l10n_co_tax_group_rtefuente': {'name': "RteFuente"},
            'l10n_co_tax_group_rteiva': {'name': "RteIVA"},
            'l10n_co_tax_group_rteica': {'name': "RteICA"},
            'l10n_co_tax_group_auto_rentencion': {'name': "Autorentencion"},
        }
