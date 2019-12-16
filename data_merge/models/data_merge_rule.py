# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields

class DataMergeRule(models.Model):
    _name = 'data_merge.rule'
    _description = 'Deduplication Rule'
    _order = 'sequence, field_id'

    model_id = fields.Many2one('data_merge.model', string='Deduplication Model', ondelete='cascade', required=True)
    res_model_id = fields.Many2one(related='model_id.res_model_id', readonly=True, store=True)
    field_id = fields.Many2one('ir.model.fields', string='Unique ID Field',
        domain="[('model_id', '=', res_model_id), ('ttype', 'in', ('char', 'text', 'many2one')), ('store', '=', True)]",
        required=True, ondelete='cascade')
    match_mode = fields.Selection([
        ('exact', 'Exact Match'),
        ('accent', 'Case/Accent Insensitive Match')], default='exact', string='Merge If', required=True)
    sequence = fields.Integer(string='Sequence', default=1)

    _sql_constraints = [
        ('uniq_model_id_field_id', 'unique(model_id, field_id)', 'A field can only appear once!'),
    ]
