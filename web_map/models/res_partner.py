# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResPartner(models.Model):
    _name = 'res.partner'
    _inherit = 'res.partner'

    contact_address_complete = fields.Char(compute='_compute_complete_address')

    #this function should batch the writes of coordinates in the model.
    #@param: {id: xx, partner_latitude: xx.xx, partner_longtitude: xx.xx}
    
    @api.model
    def update_latitude_longitude(self, partners):
        
        for partner in partners:
            if 'id' in partner and 'partner_latitude' in partner and 'partner_longitude' in partner:
                partner_to_modify = self.browse(partner['id'])
                partner_to_modify.write({'partner_latitude': partner['partner_latitude']})
                partner_to_modify.write({'partner_longitude':partner['partner_longitude']})
        return {}

    @api.onchange('street', 'zip', 'city', 'state_id', 'country_id')
    def _delete_coordinates(self):
        self.partner_latitude = False
        self.partner_longitude = False

    @api.depends('street', 'zip', 'city', 'country_id')
    def _compute_complete_address(self):
        for record in self:
            record.contact_address_complete = ''
            if record.street:
                record.contact_address_complete += record.street+','
            if record.zip:
                record.contact_address_complete +=record.zip+ ' '
            if record.city:
                record.contact_address_complete += record.city+','
            if record.country_id:
                record.contact_address_complete += record.country_id.name
