# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SpreadsheetRevision(models.Model):
    _name = "spreadsheet.revision"
    _description = "Collaborative spreadsheet revision"
    _rec_name = 'revision_id'
    _rec_names_search = ['name', 'revision_id']

    name = fields.Char("Revision name")
    active = fields.Boolean(default=True)
    res_model = fields.Char(string="Model", required=True)
    res_id = fields.Many2oneReference(string="Record id", model_field='res_model', required=True)
    commands = fields.Char(required=True)
    revision_id = fields.Char(required=True)
    parent_revision_id = fields.Char(required=True)
    _sql_constraints = [
        ('parent_revision_unique', 'unique(parent_revision_id, res_id, res_model)', 'o-spreadsheet revision refused due to concurrency')
    ]

    @api.depends('name', 'revision_id')
    def _compute_display_name(self):
        for revision in self:
            revision.display_name = revision.name or revision.revision_id
