# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from .sendcloud_locations_request import SendcloudLocationsRequest


class ProviderSendcloud(models.Model):
    _inherit = 'delivery.carrier'

    def _radius_unit_domain(self):
        categ_length_id = (self.env.ref("uom.uom_categ_length")).id
        if categ_length_id:
            return [('category_id.id', '=', categ_length_id)]
        return []

    sendcloud_use_locations = fields.Boolean(string='Use Sendcloud Locations', help='Allows the ecommerce user to choose a pick-up point as delivery address.')
    sendcloud_locations_radius_value = fields.Integer(string='Locations Distance Radius', help='Maximum locations distance radius.', default=1500, required=True)
    sendcloud_locations_radius_unit = fields.Many2one('uom.uom',
                                                      string='Distance Unit',
                                                      domain=_radius_unit_domain,
                                                      default=lambda self: self.env.ref("uom.product_uom_meter").id)
    sendcloud_locations_id = fields.Integer(string='Locations Id')

    @api.constrains("sendcloud_locations_radius_value", "sendcloud_locations_radius_unit")
    def _check_radius_value(self):
        for delivery in self:
            distance_meters = delivery.sendcloud_locations_radius_unit._compute_quantity(delivery.sendcloud_locations_radius_value, delivery.env['uom.uom'].search([('name', '=', 'm')]))

            if distance_meters > 50000:
                # maximum distance to display in that specific unit
                max_distance = delivery.env['uom.uom'].search([('name', '=', 'm')])._compute_quantity(50000, delivery.sendcloud_locations_radius_unit)
                raise ValidationError(_("The maximum radius allowed is %d%s", max_distance, delivery.sendcloud_locations_radius_unit.name))

            if distance_meters < 100:
                # minimum distance to display in that specific unit
                min_distance = delivery.env['uom.uom'].search([('name', '=', 'm')])._compute_quantity(100, delivery.sendcloud_locations_radius_unit)
                raise ValidationError(_("The minimum radius allowed is %d%s", min_distance, delivery.sendcloud_locations_radius_unit.name))

    def _sendcloud_get_close_locations(self, partner_address):
        superself = self.sudo()
        distance = int(self.sendcloud_locations_radius_unit._compute_quantity(self.sendcloud_locations_radius_value, self.env['uom.uom'].search([('name', '=', 'm')])))

        slr = SendcloudLocationsRequest(superself.sendcloud_public_key, superself.sendcloud_secret_key, self.log_xml)

        locations = slr.get_close_locations(partner_address, distance)
        for location in locations:
            location["address"] = location["street"] + ', ' + location["city"] + ' (' + location["postal_code"] + ')'
        return locations
