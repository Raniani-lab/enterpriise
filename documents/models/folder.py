# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class DocumentFolder(models.Model):
    _name = 'documents.folder'
    _description = 'Documents Folder'
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

    company_id = fields.Many2one('res.company', 'Company',
                                 help="This folder will only be available for the selected company")
    parent_folder_id = fields.Many2one('documents.folder',
                                       string="Parent Folder",
                                       ondelete="cascade",
                                       help="Tag categories from parent folders will be shared to their sub folders")
    name = fields.Char(required=True, translate=True)
    description = fields.Html(string="Description")
    children_folder_ids = fields.One2many('documents.folder', 'parent_folder_id', string="Sub folders")
    document_ids = fields.One2many('documents.document', 'folder_id', string="Documents")
    sequence = fields.Integer('Sequence', default=10)
    share_link_ids = fields.One2many('documents.share', 'folder_id', string="Share Links")
    facet_ids = fields.One2many('documents.facet', 'folder_id',
                                string="Tag Categories",
                                help="Select the tag categories to be used")
    group_ids = fields.Many2many('res.groups', string="Access Groups",
                                 help="This folder will only be available for the selected user groups")
    action_count = fields.Integer('Action Count', compute='_compute_action_count')

    @api.multi
    def _compute_action_count(self):
        read_group_var = self.env['documents.workflow.rule'].read_group(
            [('domain_folder_id', 'in', self.ids)],
            fields=['domain_folder_id'],
            groupby=['domain_folder_id'])

        action_count_dict = dict((d['domain_folder_id'][0], d['domain_folder_id_count']) for d in read_group_var)
        for record in self:
            record.action_count = action_count_dict.get(record.id, 0)

    @api.multi
    def action_see_actions(self):
        domain = [('domain_folder_id', '=', self.id)]
        return {
            'name': _('Actions'),
            'domain': domain,
            'res_model': 'documents.workflow.rule',
            'type': 'ir.actions.act_window',
            'views': [(False, 'list'), (False, 'form')],
            'view_mode': 'tree,form',
            'view_type': 'list',
            'context': "{'default_domain_folder_id': %s}" % self.id
        }
