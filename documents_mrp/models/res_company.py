# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResCompany(models.Model):
    _inherit = "res.company"

    def _get_default_mrp_folder(self):
        return self.env.ref('documents_mrp_folder', raise_if_not_found=False)

    dms_mrp_settings = fields.Boolean()
    mrp_folder = fields.Many2one('documents.folder', default=_get_default_mrp_folder)
    mrp_tags = fields.Many2many('documents.tag', 'mrp_tags_table')
