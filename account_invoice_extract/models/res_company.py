# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    extract_in_invoice_digitalization_mode = fields.Selection([
        ('no_send', "Do not digitalize"),
        ('manual_send', "Digitalize on demand only"),
        ('auto_send', "Digitalize automatically")],
        string="Digitalization mode on vendor bills",
        default='auto_send')
    extract_out_invoice_digitalization_mode = fields.Selection([
        ('no_send', "Do not digitalize"),
        ('manual_send', "Digitalize on demand only"),
        ('auto_send', "Digitalize automatically")],
        string="Digitalization mode on customer invoices",
        default='manual_send')
    extract_single_line_per_tax = fields.Boolean(string="Single Invoice Line Per Tax", default=True)
