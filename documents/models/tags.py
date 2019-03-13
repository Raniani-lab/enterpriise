# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.osv import expression


class TagsCategories(models.Model):
    _name = "documents.facet"
    _description = "Facet"
    _order = "sequence, name"

    folder_id = fields.Many2one('documents.folder', string="Workspace", ondelete="cascade")
    name = fields.Char(required=True)
    tag_ids = fields.One2many('documents.tag', 'facet_id')
    tooltip = fields.Char(help="hover text description", string="Tooltip")
    sequence = fields.Integer('Sequence', default=10)

    _sql_constraints = [
        ('name_unique', 'unique (folder_id, name)', "Facet already exists in this folder"),
    ]


class Tags(models.Model):
    _name = "documents.tag"
    _description = "Tag"
    _order = "sequence, name"

    folder_id = fields.Many2one('documents.folder', related='facet_id.folder_id', store=True, readonly=False)
    facet_id = fields.Many2one('documents.facet', ondelete='cascade', required=True)
    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer('Sequence', default=10)

    @api.multi
    def name_get(self):
        name_array = []
        for record in self:
            name_array.append((record.id, "%s > %s" % (record.facet_id.name, record.name)))
        return name_array

    _sql_constraints = [
        ('facet_name_unique', 'unique (facet_id, name)', "Tag already exists for this facet"),
    ]

    @api.model
    def _get_tags(self, domain, folder_id):
        """
        fetches the tag and facet ids for the document selector (custom left sidebar of the kanban view)
        """
        documents = self.env['documents.document'].search(domain)
        folders = self.env['documents.folder'].search([('parent_folder_id', 'parent_of', folder_id)])
        query = """
            SELECT  facet.sequence AS group_sequence,
                    facet.name AS group_name,
                    facet.id AS group_id,
                    facet.tooltip AS group_tooltip,
                    documents_tag.sequence AS sequence,
                    documents_tag.name AS name,
                    documents_tag.id AS id,
                    COUNT(rel.documents_document_id) AS count
            FROM documents_tag
                JOIN documents_facet facet ON documents_tag.facet_id = facet.id
                    AND facet.folder_id = ANY(%s)
                LEFT JOIN document_tag_rel rel ON documents_tag.id = rel.documents_tag_id
                    AND rel.documents_document_id = ANY(%s)
            GROUP BY facet.sequence, facet.name, facet.id, facet.tooltip, documents_tag.sequence, documents_tag.name, documents_tag.id
            ORDER BY facet.sequence, facet.name, facet.id, facet.tooltip, documents_tag.sequence, documents_tag.name, documents_tag.id
        """
        params = [
            list(folders.ids),
            list(documents.ids),  # using Postgresql's ANY() with a list to prevent empty list of documents
        ]
        self.env.cr.execute(query, params)
        return self.env.cr.dictfetchall()
