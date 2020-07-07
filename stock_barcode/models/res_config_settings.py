# -*- coding: utf-8 -*-

from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    barcode_nomenclature_id = fields.Many2one('barcode.nomenclature', related='company_id.nomenclature_id', readonly=False)
    group_barcode_keyboard_shortcuts = fields.Boolean("Keyboard Shortcuts", implied_group='stock_barcode.group_barcode_keyboard_shortcuts')
    keyboard_layout = fields.Selection(related="company_id.keyboard_layout", default='qwerty', string="Keyboard Layout", readonly=False)
