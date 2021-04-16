# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug import urls
from werkzeug.urls import url_encode, url_join

from odoo import fields, _
from odoo.addons.calendar.controllers.main import CalendarController
from odoo.exceptions import AccessError, ValidationError
from odoo.addons.http_routing.models.ir_http import slug
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

    @route('/appointment/calendar_appointment_type/create_custom', type='json', auth='user')
    def appointment_create_custom_appointment_type(self, slots):
        """
        Return the info (id and url) of the custom appointment type
        that is created with the time slots in the calendar.

        Users would typically use this feature to create a custom
        appointment type for a specific customer and suggest a few
        hand-picked slots from the calendar view that work best for that
        appointment.

        Contrary to regular appointment types that are meant to be re-used
        several times week after week (e.g.: "Schedule Demo"), this category
        of appointment type will be unlink after some time has passed.

        - slots format:
            [{
                'start': '2021-06-25 13:30:00',
                'end': '2021-06-25 15:30:00',
                'allday': False,
            }, {
                'start': '2021-06-25 22:00:00',
                'end': '2021-06-26 22:00:00',
                'allday': True,
            },...]
        The timezone used for the slots is UTC
        """
        if not slots:
            raise ValidationError(_("A list of slots information is needed to create a custom appointment type"))
        # Check if the user is a member of group_user to avoid portal user and the like to create appointment types
        if not request.env.user.user_has_groups('base.group_user'):
            raise AccessError(_("Access Denied"))
        appointment_type = request.env['calendar.appointment.type'].sudo().create({
            'category': 'custom',
            'slot_ids': [(0, 0, {
                'start_datetime': fields.Datetime.from_string(slot.get('start')),
                'end_datetime': fields.Datetime.from_string(slot.get('end')),
                'allday': slot.get('allday'),
                'slot_type': 'unique',
            }) for slot in slots],
        })

        return self._get_staff_user_appointment_info(appointment_type)

    @route('/appointment/calendar_appointment_type/get_staff_user_appointment_types', type='json', auth='user')
    def appointment_get_staff_user_appointment_types(self):
        appointment_types_info = []
        domain = self._get_staff_user_appointment_type_domain()
        appointment_types_info = request.env['calendar.appointment.type'].search_read(domain, ['name', 'category'])
        return {
            'appointment_types_info': appointment_types_info,
        }

    def _get_staff_user_appointment_type_domain(self):
        return [('staff_user_ids', 'in', [request.env.user.id]), ('category', '!=', 'custom')]

    def _get_staff_user_appointment_info(self, appointment_type):
        params = {'filter_staff_user_ids': str(request.env.user.ids)}
        calendar_url = url_join(appointment_type.get_base_url(), '/calendar/')
        appointment_url = url_join(calendar_url, slug(appointment_type))
        appointment_staff_user_url = "%s?%s" % (appointment_url, url_encode(params))
        return {
            'id': appointment_type.id,
            'url': appointment_staff_user_url
        }
