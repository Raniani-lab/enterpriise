# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.delivery_sendcloud.models.sendcloud_service import SendCloud

LOCATION_URL = "https://servicepoints.sendcloud.sc/api/v2/"


class SendcloudLocationsRequest(SendCloud):

    def get_close_locations(self, partner_address, distance):

        params = {"country": partner_address.country_code,
                  "address": partner_address.street + "," + partner_address.zip + " " + partner_address.city,
                  "radius": distance}
        request = self._send_request('service-points', params=params, route=LOCATION_URL)
        location = set()
        return_data = []

        for pick_up_location in request:
            if not pick_up_location["street"] in location:
                # change distance in km to proprely match the canvas
                pick_up_location["distance"] = pick_up_location["distance"] / 1000
                return_data.append(pick_up_location)
            location.add(pick_up_location["street"])
        return return_data
