# -*- coding: utf-8 -*-

from odoo import fields, models, api


class AccountIntrastatCode(models.Model):
    '''
    Codes used for the intrastat reporting.

    The list of commodity codes is available on:
    https://www.cbs.nl/en-gb/deelnemers%20enquetes/overzicht/bedrijven/onderzoek/lopend/international-trade-in-goods/idep-code-lists
    '''
    _name = 'account.intrastat.code'
    _translate = False

    name = fields.Char(string='Name')
    code = fields.Char(string='Code', required=True)
    country_id = fields.Many2one('res.country', string='Country', help='Restrict the applicability of code to a country.')
    description = fields.Char(string='Description')
    type = fields.Selection(string='Type', required=True,
        selection=[('commodity', 'Commodity'), ('transport', 'Transport'), ('transaction', 'Transaction'), ('region', 'Region')],
        default='commodity',
        help='''Type of intrastat code used to filter codes by usage.
            * commodity: Code to be set on invoice lines for European Union statistical purposes.
            * transport: The active vehicle that moves the goods across the border.
            * transaction: A movement of goods.
            * region: A sub-part of the country.
        ''')

    @api.multi
    def name_get(self):
        return [(r.id, r.name and '%s %s' % (r.code, r.name) or r.code) for r in self]

    _sql_constraints = [
        ('intrastat_region_code_unique', 'UNIQUE (code, type, country_id)', 'Triplet code/type/country_id must be unique.'),
    ]
