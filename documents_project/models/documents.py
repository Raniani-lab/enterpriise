# -*- coding: utf-8 -*-
from odoo import models, fields, api, exceptions


class IrAttachment(models.Model):
    _name = 'ir.attachment'
    _inherit = 'ir.attachment'

    def _set_folder_project(self, vals):
        if not vals.get('folder_id'):
            if self.env.user.company_id.dms_project_settings:
                folder = self.env.user.company_id.project_folder
                if folder.exists():
                    vals.setdefault('folder_id', folder.id)
                    vals.setdefault('tag_ids', [(6, 0, self.env.user.company_id.project_tags.ids)])
        return vals

    @api.model_create_multi
    def create(self, vals_list):
        for vals_dict in vals_list:
            if vals_dict.get('res_model') in ('project.project', 'project.task'):
                vals_dict.update(self._set_folder_project(vals_dict))
        return super(IrAttachment, self).create(vals_list)

    def write(self, vals):
        if vals.get('res_model') in ('project.project', 'project.task'):
            vals = self._set_folder_project(vals)
        return super(IrAttachment, self).write(vals)
