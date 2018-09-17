# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions


class IrAttachment(models.Model):
    _name = 'ir.attachment'
    _inherit = 'ir.attachment'

    def _set_folder_sign(self, vals):
        if vals.get('res_id'):
            record = self.env[vals.get('res_model')].browse(vals.get('res_id'))
            if record.exists():
                vals.setdefault('folder_id', record.folder_id.id)
                vals.setdefault('tag_ids', [(6, 0, record.documents_tag_ids.ids)])
        return vals

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('res_model') in ('sign.template', 'sign.request'):
                vals.update(self._set_folder_sign(vals))
        return super(IrAttachment, self).create(vals_list)

    def write(self, vals):
        if vals.get('res_model') in ('sign.template', 'sign.request'):
            vals = self._set_folder_sign(vals)
        return super(IrAttachment, self).write(vals)
