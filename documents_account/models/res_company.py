# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class ResCompany(models.Model):
    _inherit = "res.company"

    dms_account_settings = fields.Boolean()
    account_folder = fields.Many2one('documents.folder',
                                     default=lambda self: self.env.ref('documents.documents_finance_folder',
                                                                       raise_if_not_found=False))
    account_tags = fields.Many2many('documents.tag', 'account_tags_table')
