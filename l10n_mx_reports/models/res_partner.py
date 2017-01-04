# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResPartner(models.Model):
    """Inherited to complete the attributes required to DIOT Report

    Added required fields according with the provisions in the next SAT
    document `Document <goo.gl/THPLDk>`_. To allow generate the form A-29
    requested by this SAT.
    """
    _inherit = 'res.partner'

    type_of_third = fields.Char(
        compute='_compute_type_of_third',
        help='Indicate the type of third that is the supplier. Is the first '
        'column in DIOT report.')
    type_of_operation = fields.Selection([
        ('03', ' 03 - Provision of Professional Services'),
        ('06', ' 06 - Renting of buildings'),
        ('85', ' 85 - Others')],
        help='Indicate the operations type that makes this supplier. Is the '
        'second column in DIOT report')
    nationality = fields.Char(
        help='Nationality based in the supplier country. Is the '
        'seventh column in DIOT report',
        compute='_compute_nationality', inverse='_inverse_nationality')

    @api.multi
    @api.depends('country_id')
    def _compute_type_of_third(self):
        """Get the type of third to use in DIOT report.
        04 is to National Supplier
        05 to Foreign Supplier"""
        mexico = self.env.ref('base.mx')
        for partner in self:
            partner_type = '04' if partner.country_id == mexico else '05'
            partner.type_of_third = partner_type

    @api.multi
    @api.depends('country_id')
    def _compute_nationality(self):
        for partner in self:
            partner.nationality = partner.country_id.with_context(
                lang='es_MX').demonym

    @api.multi
    def _inverse_nationality(self):
        for partner in self.filtered('country_id'):
            partner.country_id.with_context(lang='es_MX').demonym = (
                partner.nationality)

    @api.multi
    def _get_not_partners_diot(self):
        partners = self.mapped('commercial_partner_id')
        return partners.filtered(lambda r: any([
            (not r.vat and r.type_of_third == '04'),
            not r.type_of_third, not r.type_of_operation,
            (r.type_of_third == '05' and not r.country_id.code),
            (r.type_of_third == '04' and not r.check_vat_mx(r.vat))]))
