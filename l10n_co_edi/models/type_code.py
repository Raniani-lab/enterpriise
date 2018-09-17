# coding: utf-8
from odoo import api, fields, models, _


class TypeCode(models.Model):
    _name = 'l10n_co_edi.type_code'

    name = fields.Char(required=True)
    description = fields.Char(required=True)
    type = fields.Selection([('representation', 'Representation'),
                             ('obligation', 'Obligation'),
                             ('customs', 'Customs'),
                             ('establishment', 'Establishment')],
                            required=True)
