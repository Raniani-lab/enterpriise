# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Contact(models.Model):
    _name = 'res.partner'
    _inherit = ['res.partner', 'voip.queue.mixin']
