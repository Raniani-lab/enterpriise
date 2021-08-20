# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug import urls

from odoo.addons.calendar.controllers.main import CalendarController
from odoo.http import request, route


class AppointmentController(CalendarController):

    @route(website=True)
    def view_meeting(self, token, id):
        """Redirect the internal logged in user to the form view of calendar.event, and redirect
           regular attendees to the website page of the calendar.event for online appointments"""
        super(AppointmentController, self).view_meeting(token, id)
        attendee = request.env['calendar.attendee'].sudo().search([
            ('access_token', '=', token),
            ('event_id', '=', int(id))])
        if not attendee:
            return request.render("appointment.appointment_invalid", {})

        # If user is internal and logged, redirect to form view of event
        if request.env.user.has_group('base.group_user'):
            url_params = urls.url_encode({
                'id': id,
                'view_type': 'form',
                'model': attendee.event_id._name,
            })
            return request.redirect('/web?db=%s#%s' % (request.env.cr.dbname, url_params))

        request.session['timezone'] = attendee.partner_id.tz
        if not attendee.event_id.access_token:
            attendee.event_id._generate_access_token()
        return request.redirect('/calendar/view/%s?partner_id=%s' % (attendee.event_id.access_token, attendee.partner_id.id))
