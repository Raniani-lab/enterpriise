# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
from odoo import fields, models
from .fedex_locations_request import FEDEXLocationsRequest


class ProviderFedex(models.Model):
    _inherit = 'delivery.carrier'

    def _radius_unit_domain(self):
        categ_length_id = (self.env.ref("uom.uom_categ_length")).id
        miles_id = (self.env.ref("uom.product_uom_mile")).id
        km_id = (self.env.ref("uom.product_uom_km")).id
        if categ_length_id:
            if miles_id or km_id:
                return ['&', ('category_id.id', '=', categ_length_id), ('id', 'in', [miles_id, km_id])]
            return ['&', ('category_id.id', '=', categ_length_id), ('name', 'in', ['km', 'mi'])]
        return []

    fedex_use_locations = fields.Boolean(string='Use Fedex Locations', help='Allows the ecommerce user to choose a pick-up point as delivery address.')
    fedex_locations_radius_value = fields.Integer(string='Locations Radius', help='Maximum locations distance radius.', default=15, required=True)
    fedex_locations_radius_unit = fields.Many2one('uom.uom',
                                                  string='Locations Distance Unit',
                                                  domain=_radius_unit_domain,
                                                  required=True,
                                                  default=lambda self: self.env['uom.uom'].search([('name', '=', 'km')])
                                                  )

    def _fedex_get_close_locations(self, partner_address):
        superself = self.sudo()
        srm = FEDEXLocationsRequest(self.log_xml, request_type="locs", prod_environment=self.prod_environment)
        srm.web_authentication_detail(superself.fedex_developer_key, superself.fedex_developer_password)
        srm.client_detail(superself.fedex_account_number, superself.fedex_meter_number)
        srm.transaction_detail('Location Request partner_id=%d' % partner_address.id)
        srm.set_locs_details(self, partner_address)
        locations = srm.process_locs()
        for location in locations:
            address = location['LocationDetail']['LocationContactAndAddress']['Address']
            location['address'] = address['StreetLines'][0] + ", " + address['City'] + " (" + address['PostalCode'] + ")"
        return locations

    def _fedex_update_srm(self, srm, request_type, order=None, picking=None):
        """Add alternate delivery address to the shipment."""
        res = super(ProviderFedex, self)._fedex_update_srm(srm, picking, order)
        if picking:
            order = picking.sale_id
        if order and order.access_point_address:
            fedex_location = json.loads(order.access_point_address) if order.access_point_address else False
            fedex_loc_details = fedex_location.get('LocationDetail', {})

            hold_at_loc = srm.factory.HoldAtLocationDetail()
            hold_at_loc.PhoneNumber = order.partner_shipping_id.phone
            hold_at_loc.LocationContactAndAddress = fedex_loc_details.get('LocationContactAndAddress', {})
            if 'AddressAncillaryDetail' in hold_at_loc.LocationContactAndAddress:
                del hold_at_loc.LocationContactAndAddress['AddressAncillaryDetail']
            hold_at_loc.LocationType = fedex_loc_details.get('LocationType')
            hold_at_loc.LocationId = fedex_loc_details.get('LocationId')

            srm.RequestedShipment.SpecialServicesRequested.HoldAtLocationDetail = hold_at_loc
        return res
