# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def _get_default_mrp_folder(self):
        folder_id = self.env.user.company_id.mrp_folder
        if folder_id.exists():
            return folder_id
        return False

    dms_mrp_settings = fields.Boolean(related='company_id.dms_mrp_settings',
                                      default=lambda self: self.env.user.company_id.dms_mrp_settings)
    mrp_folder = fields.Many2one('documents.folder', related='company_id.mrp_folder',
                                 default=_get_default_mrp_folder,
                                 string="MRP Folder")
    mrp_tags = fields.Many2many('documents.tag', 'mrp_tags_table', related='company_id.mrp_tags',
                                default=lambda self: self.env.user.company_id.mrp_tags.ids,
                                string="MRP Tags")
