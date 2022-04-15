# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class HomeworkingLocation(models.Model):
    _name = "homeworking.location"
    _description = "Homeworking location"

    name = fields.Char(required=True, translate=True)
    location_type = fields.Selection([
        ('home', 'Home'),
        ('office', 'Office'),
        ('unspecified', 'Unspecified')
    ], default='office', required=True)
    color = fields.Integer()

    @api.model
    @tools.ormcache()
    def _get_default_homeworking_location_id(self):
        return self.search([('location_type', '=', 'unspecified')], limit=1).id
