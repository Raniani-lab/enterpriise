# -*- coding: utf-8 -*-
from odoo import fields, http, _
from odoo.http import request


class EventBarcode(http.Controller):

    @http.route('/event_barcode/register_attendee', type='json', auth="user")
    def register_attendee(self, barcode, event_id, **kw):
        Registration = request.env['event.registration']
        attendee = Registration.search([('barcode', '=', barcode)], limit=1)
        if not attendee:
            return {'error': 'invalid_ticket'}
        is_different_event = attendee.event_id.id != event_id
        need_confirmation = attendee.state not in ['done', 'cancel']
        res = attendee._get_registration_summary()
        if need_confirmation:
            if not is_different_event:
                attendee.action_set_done()
                status = 'confirmed_registration'
            else:
                status = 'need_manual_confirmation'
        elif attendee.state == 'cancel':
            status = 'canceled_registration'
        else:
            status = 'already_registered'
        res.update({'is_different_event': is_different_event,
                    'status': status})
        return res

    @http.route(['/event_barcode/event'], type='json', auth="user")
    def get_event_data(self, event_id):
        event = request.env['event.event'].browse(event_id)
        return {
            'name': event.name,
            'country': event.address_id.country_id.name,
            'city': event.address_id.city,
            'company_name': event.company_id.name
        }
