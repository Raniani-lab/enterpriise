# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields

class Applicant(models.Model):
    _inherit = 'hr.applicant'

    appointment_type_id = fields.Many2one('appointment.type')
