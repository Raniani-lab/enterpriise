# -*- coding: utf-8 -*-

from odoo import models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    # Overridden to add a domain excluding OSS tag, to avoid confusion with the import one.
    account_tag_ids = fields.Many2many(
        comodel_name='account.account.tag',
        domain=lambda x: "[('applicability', '=', 'taxes'),"
                         "('country_id', '=', False),"
                         "('id', '!=', %s)]" % x.env.ref('l10n_eu_oss.tag_oss').id,
    )
