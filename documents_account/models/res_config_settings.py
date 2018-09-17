# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def _get_default_account_folder(self):
        folder_id = self.env.user.company_id.account_folder
        if folder_id.exists():
            return folder_id
        return False

    dms_account_settings = fields.Boolean(related='company_id.dms_account_settings',
                                          default=lambda self: self.env.user.company_id.dms_account_settings)
    account_folder = fields.Many2one('documents.folder', related='company_id.account_folder',
                                     default=_get_default_account_folder,
                                     string="Account Folder")
    account_tags = fields.Many2many('documents.tag', 'account_tags_table', related='company_id.account_tags',
                                    default=lambda self: self.env.user.company_id.account_tags.ids,
                                    string="Account Tags")

