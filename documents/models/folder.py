# -*- coding: utf-8 -*-
from odoo import models, fields, api


class DocumentFolder(models.Model):
    _name = 'documents.folder'
    _parent_name = 'parent_folder_id'
    _order = 'sequence'

    @api.model
    def default_get(self, fields):
        res = super(DocumentFolder, self).default_get(fields)
        if self._context.get('folder_id'):
            res['parent_folder_id'] = self._context.get('folder_id')

        return res

    @api.multi
    def name_get(self):
        name_array = []
        for record in self:
            if record.parent_folder_id:
                name_array.append((record.id, "%s / %s" % (record.parent_folder_id.name, record.name)))
            else:
                name_array.append((record.id, record.name))
        return name_array

    company_id = fields.Many2one('res.company', 'Company')
    parent_folder_id = fields.Many2one('documents.folder', string="Parent Folder", ondelete="cascade")
    name = fields.Char(required=True)
    children_folder_ids = fields.One2many('documents.folder', 'parent_folder_id', string="Sub folders")
    attachment_ids = fields.One2many('ir.attachment', 'folder_id', string="Documents")
    sequence = fields.Integer('Sequence', default=10)
    share_link_ids = fields.One2many('documents.share', 'folder_id', string="Share Links")
    facet_ids = fields.One2many('documents.facet', 'folder_id', string="Tag Categories")
    group_ids = fields.Many2many('res.groups', string="Access Groups")
