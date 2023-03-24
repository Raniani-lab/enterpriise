# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class TagsCategories(models.Model):
    _name = "documents.facet"
    _description = "Category"
    _order = "sequence, name"

    # the colors to be used to represent the display order of the facets (tag categories), the colors
    # depend on the order and amount of fetched categories
    # currently used in the searchPanel and the kanban view and should match across the two.
    FACET_ORDER_COLORS = ['#F06050', '#6CC1ED', '#F7CD1F', '#814968', '#30C381', '#D6145F', '#475577', '#F4A460',
                          '#EB7E7F', '#2C8397']

    folder_id = fields.Many2one('documents.folder', string="Workspace", ondelete="cascade")
    name = fields.Char(required=True, translate=True)
    tag_ids = fields.One2many('documents.tag', 'facet_id', copy=True)
    tooltip = fields.Char(help="Text shown when hovering on this tag category or its tags", string="Tooltip")
    sequence = fields.Integer('Sequence', default=10)

    _sql_constraints = [
        ('name_unique', 'unique (folder_id, name)', "Facet already exists in this folder"),
    ]
