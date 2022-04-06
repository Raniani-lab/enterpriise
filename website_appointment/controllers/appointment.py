# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.osv import expression

from odoo.addons.appointment.controllers.appointment import Appointment
from odoo.addons.website.controllers.main import QueryURL


class WebsiteAppointment(Appointment):

    # ------------------------------------------------------------
    # APPOINTMENT INDEX PAGE
    # ------------------------------------------------------------

    @http.route()
    def appointment_type_index(self, page=1, **kwargs):
        """
        Display the appointments to choose (the display depends of a custom option called 'Card Design')

        :param page: the page number displayed when the appointments are organized by cards

        A param filter_appointment_type_ids can be passed to display a define selection of appointments types.
        This param is propagated through templates to allow people to go back with the initial appointment
        types filter selection
        """
        available_appointment_types = self._fetch_available_appointments(
            kwargs.get('filter_appointment_type_ids'),
            kwargs.get('filter_staff_user_ids'),
            kwargs.get('invite_token'),
            kwargs.get('search')
        )
        if len(available_appointment_types) == 1 and not kwargs.get('search'):
            # If there is only one appointment type available in the selection, skip the appointment type selection view
            return request.redirect('/appointment/%s' % available_appointment_types.id)

        cards_layout = request.website.viewref('website_appointment.opt_appointments_list_cards').active

        if cards_layout:
            return request.render(
                'website_appointment.appointments_cards_layout',
                self._prepare_appointments_cards_data(
                    page, available_appointment_types,
                    **kwargs
                )
            )
        else:
            return request.render(
                'appointment.appointments_list_layout',
                self._prepare_appointments_list_data(
                    available_appointment_types,
                    **kwargs
                )
            )

    # Tools / Data preparation
    # ------------------------------------------------------------

    def _prepare_appointments_cards_data(self, page, appointment_types=None, **kwargs):
        """
            Compute specific data for the cards layout like the the search bar and the pager.
        """
        if appointment_types is None:
            appointment_types = self._fetch_available_appointments(
                kwargs.get('filter_appointment_type_ids'),
                kwargs.get('filter_staff_user_ids'),
                kwargs.get('invite_token'),
                kwargs.get('search')
            )

        appointment_type_ids = kwargs.get('filter_appointment_type_ids')
        domain = self._appointments_base_domain(
            appointment_type_ids,
            kwargs.get('search'),
            kwargs.get('invite_token'),
        )

        website = request.website

        APPOINTMENTS_PER_PAGE = 12

        Appointment = request.env['appointment.type']
        appointment_count = len(appointment_types)

        pager = website.pager(
            url='/appointment',
            url_args=kwargs,
            total=appointment_count,
            page=page,
            step=APPOINTMENTS_PER_PAGE,
            scope=5,
        )

        # Use appointment_types to keep the sudo if needed
        appointment_types = Appointment.sudo().search(domain, limit=APPOINTMENTS_PER_PAGE, offset=pager['offset'])

        return {
            'appointment_types': appointment_types,
            'current_search': kwargs.get('search'),
            'pager': pager,
            'filter_appointment_type_ids': appointment_type_ids,
            'filter_staff_user_ids': kwargs.get('filter_staff_user_ids'),
            'invite_token': kwargs.get('invite_token'),
        }

    def _get_customer_partner(self):
        partner = super()._get_customer_partner()
        if not partner:
            partner = request.env['website.visitor']._get_visitor_from_request().partner_id
        return partner

    def _get_customer_country(self):
        """
            Find the country from the geoip lib or fallback on the user or the visitor
        """
        country = super()._get_customer_country()
        if not country:
            visitor = request.env['website.visitor']._get_visitor_from_request()
            country = visitor.country_id
        return country
