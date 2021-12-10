# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import pytz

from babel.dates import format_datetime, format_date
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from werkzeug.exceptions import NotFound

from odoo import http, fields, _
from odoo.addons.http_routing.models.ir_qweb import keep_query
from odoo.addons.http_routing.models.ir_http import slug
from odoo.http import request, route
from odoo.osv import expression
from odoo.tools import plaintext2html, DEFAULT_SERVER_DATETIME_FORMAT as dtf
from odoo.tools.misc import babel_locale_parse, get_lang

def _formated_weekdays(locale):
    """ Return the weekdays' name for the current locale
        from Mon to Sun.
        :param locale: locale
    """
    formated_days = [
        format_date(date(2021, 3, day), 'EEE', locale=locale)
        for day in range(1, 8)
    ]
    # Get the first weekday based on the lang used on the website
    first_weekday_index = babel_locale_parse(locale).first_week_day
    # Reorder the list of days to match with the first weekday
    formated_days = list(formated_days[first_weekday_index:] + formated_days)[:7]
    return formated_days

class Appointment(http.Controller):

    # ------------------------------------------------------------
    # APPOINTMENT INDEX PAGE
    # ------------------------------------------------------------

    @route(['/calendar', '/calendar/page/<int:page>'],
           type='http', auth="public", website=True, sitemap=True)
    def calendar_appointments(self, page=1, **kwargs):
        """
        Display the appointments to choose (the display depends of a custom option called 'Card Design')

        :param page: the page number displayed when the appointments are organized by cards

        A param filter_appointment_type_ids can be passed to display a define selection of appointments types.
        This param is propagated through templates to allow people to go back with the initial appointment
        types filter selection
        """
        return request.render('appointment.appointments_list_layout', self._prepare_appointments_list_data(**kwargs))

    # Tools / Data preparation
    # ------------------------------------------------------------

    def _prepare_appointments_list_data(self, **kwargs):
        """
            Compute specific data for the list layout.
        """
        domain = self._appointments_base_domain(kwargs.get('filter_appointment_type_ids'))

        appointment_types = request.env['calendar.appointment.type'].search(domain)
        return {
            'appointment_types': appointment_types,
        }

    def _appointments_base_domain(self, filter_appointment_type_ids):
        domain = [('category', '=', 'website')]

        if filter_appointment_type_ids:
            domain = expression.AND([domain, [('id', 'in', json.loads(filter_appointment_type_ids))]])
        else:
            country = self._get_customer_country()
            if country:
                country_domain = ['|', ('country_ids', '=', False), ('country_ids', 'in', [country.id])]
                domain = expression.AND([domain, country_domain])

        return domain

    # ------------------------------------------------------------
    # APPOINTMENT TYPE PAGE VIEW
    # ------------------------------------------------------------

    @route(['/calendar/<model("calendar.appointment.type"):appointment_type>'],
           type='http', auth="public", website=True, sitemap=True)
    def calendar_appointment_type(self, appointment_type, filter_staff_user_ids=None, state=False, **kwargs):
        """
        Render the appointment information alongside the calendar for the slot selection

        :param appointment_type: the appointment type we are currently on
        :param filter_staff_user_ids: the users that will be displayed for the appointment registration, if not given
            all users set for the appointment type are used
        :param state: the type of message that will be displayed in case of an error/info. Possible values:
            - cancel: Info message to confirm that an appointment has been canceled
            - failed-staff-user: Error message displayed when the slot has been taken while doing the registration
            - failed-partner: Info message displayed when the partner has already an event in the time slot selected
        """
        appointment_type = appointment_type.sudo()

        filtered_staff_user_ids = self._get_filtered_staff_user_ids(appointment_type, filter_staff_user_ids, **kwargs)

        if appointment_type.assign_method == 'chosen' and not filtered_staff_user_ids:
            suggested_staff_users = appointment_type.staff_user_ids
        else:
            suggested_staff_users = appointment_type.staff_user_ids.filtered(lambda staff_user: staff_user.id in filtered_staff_user_ids)

        request.session.timezone = self._get_default_timezone(appointment_type)
        slots = appointment_type._get_appointment_slots(
            request.session['timezone'],
            suggested_staff_users[0] if suggested_staff_users else request.env['res.users']
        )
        formated_days = [format_date(fields.Date.from_string('2021-03-0%s' % str(day + 1)), "EEE", get_lang(request.env).code) for day in range(7)]
        month_first_available = next((month['id'] for month in slots if month['has_availabilities']), 0)

        # Get the first weekday based on the lang used on the website
        first_weekday_index = babel_locale_parse(get_lang(request.env).code).first_week_day
        # Reorder the list of days to match with the first weekday
        formated_days = list(formated_days[first_weekday_index:] + formated_days)[:7]

        return request.render("appointment.appointment_info", {
            'appointment_type': appointment_type,
            'suggested_staff_users': suggested_staff_users,
            'main_object': appointment_type,
            'timezone': request.session['timezone'],  # bw compatibility
            'slots': slots,
            'state': state,
            'filter_appointment_type_ids': kwargs.get('filter_appointment_type_ids'),
            'formated_days': formated_days,
            'month_first_available': month_first_available,
        })

    @http.route(['/calendar/<model("calendar.appointment.type"):appointment_type>/appointment'],
                type='http', auth='public', website=True, sitemap=True)
    def calendar_appointment(self, appointment_type, filter_staff_user_ids=None, timezone=None, failed=False, **kwargs):
        return request.redirect('/calendar/%s?%s' % (slug(appointment_type), keep_query('*')))

    # Tools / Data preparation
    # ------------------------------------------------------------

    def _get_filtered_staff_user_ids(self, appointment_type, filter_staff_user_ids=None, **kwargs):
        """ This method returns the ids of the suggested users, extracting relevant data from link.
            It is overriden in submodule to ensure retrocompatibility."""
        try:
            return json.loads(filter_staff_user_ids) if filter_staff_user_ids else []
        except json.decoder.JSONDecodeError:
            return []

    # ------------------------------------------------------------
    # APPOINTMENT TYPE BOOKING
    # ------------------------------------------------------------

    @http.route(['/calendar/<model("calendar.appointment.type"):appointment_type>/info'],
                type='http', auth="public", website=True, sitemap=True)
    def calendar_appointment_form(self, appointment_type, staff_user_id, date_time, duration, **kwargs):
        """
        Render the form to get information about the user for the appointment

        :param appointment_type: the appointment type related
        :param staff_user_id: the user selected for the appointment
        :param date_time: the slot datetime selected for the appointment
        :param filter_appointment_type_ids: see ``Appointment.calendar_appointments()`` route
        """
        partner = self._get_customer_partner()
        partner_data = partner.read(fields=['name', 'mobile', 'email'])[0] if partner else {}
        day_name = format_datetime(datetime.strptime(date_time, dtf), 'EEE', locale=get_lang(request.env).code)
        date_formated = format_datetime(datetime.strptime(date_time, dtf), locale=get_lang(request.env).code)
        return request.render("appointment.appointment_form", {
            'partner_data': partner_data,
            'appointment_type': appointment_type,
            'main_object': appointment_type,
            'datetime': date_time,
            'datetime_locale': day_name + ' ' + date_formated,
            'datetime_str': date_time,
            'duration_str': duration,
            'staff_user_id': staff_user_id,
            'timezone': request.session['timezone'] or appointment_type.timezone,  # bw compatibility
        })

    @http.route(['/calendar/<model("calendar.appointment.type"):appointment_type>/submit'],
                type='http', auth="public", website=True, methods=["POST"])
    def calendar_appointment_submit(self, appointment_type, datetime_str, duration_str, staff_user_id, name, phone, email, **kwargs):
        """
        Create the event for the appointment and redirect on the validation page with a summary of the appointment.

        :param appointment_type: the appointment type related
        :param datetime_str: the string representing the datetime
        :param staff_user_id: the user selected for the appointment
        :param name: the name of the user sets in the form
        :param phone: the phone of the user sets in the form
        :param email: the email of the user sets in the form
        """
        timezone = request.session['timezone'] or appointment_type.appointment_tz
        tz_session = pytz.timezone(timezone)
        date_start = tz_session.localize(fields.Datetime.from_string(datetime_str)).astimezone(pytz.utc).replace(tzinfo=None)
        duration = float(duration_str)
        date_end = date_start + relativedelta(hours=duration)

        # check availability of the selected user again (in case someone else booked while the client was entering the form)
        staff_user = request.env['res.users'].sudo().browse(int(staff_user_id)).exists()
        if staff_user not in appointment_type.sudo().staff_user_ids:
            raise NotFound()
        if staff_user and not staff_user.partner_id.calendar_verify_availability(date_start, date_end):
            return request.redirect('/calendar/%s/appointment?state=failed-staff-user' % appointment_type.id)

        Partner = self._get_customer_partner() or request.env['res.partner'].sudo().search([('email', '=like', email)], limit=1)
        if Partner:
            if not Partner.calendar_verify_availability(date_start, date_end):
                return request.redirect('/calendar/%s/appointment?state=failed-partner' % appointment_type.id)
            if not Partner.mobile:
                Partner.write({'mobile': phone})
            if not Partner.email:
                Partner.write({'email': email})
        else:
            Partner = Partner.create({
                'name': name,
                'mobile': Partner._phone_format(phone, country=self._get_customer_country()),
                'email': email,
                'lang': request.lang.code,
            })

        # Reporting Data : recover user inputs to questions, if any, asked on the appointment.
        # The question answer inputs are created in _prepare_calendar_values
        question_answer_inputs = []
        for question in appointment_type.question_ids:
            question_key = f'question_{question.id}'
            if question.question_type == 'checkbox':
                question_answer_inputs += [{
                    'question_id': question.id,
                    'value_answer_id': answer.id
                } for answer in question.answer_ids.filtered(lambda answer: (f'{question_key}_answer_{answer.id}') in kwargs)]
            elif kwargs.get(question_key) and question.question_type in ['char', 'text']:
                question_answer_inputs.append({'question_id': question.id, 'value_text_box': kwargs.get(question_key).strip()})
            elif kwargs.get(question_key) and question.question_type in ['select', 'radio']:
                selected_answer = question.answer_ids.filtered(lambda answer: answer.id == int(kwargs.get(question_key)))
                if selected_answer:
                    question_answer_inputs.append({'question_id': question.id, 'value_answer_id': selected_answer.id})

        for question_answer_input in question_answer_inputs:
            question_answer_input.update({'appointment_type_id': appointment_type.id, 'partner_id': Partner.id})

        description_bits = []
        description = ''

        if phone:
            description_bits.append(_('Mobile: %s', phone))
        if email:
            description_bits.append(_('Email: %s', email))

        for question in appointment_type.question_ids:
            key = 'question_' + str(question.id)
            if question.question_type == 'checkbox':
                answers = question.answer_ids.filtered(lambda x: (key + '_answer_' + str(x.id)) in kwargs)
                if answers:
                    description_bits.append('%s: %s' % (question.name, ', '.join(answers.mapped('name'))))
            elif question.question_type == 'text' and kwargs.get(key):
                answers = [line for line in kwargs[key].split('\n') if line.strip()]
                description_bits.append('%s:<br/>%s' % (question.name, plaintext2html(kwargs.get(key).strip())))
            elif question.question_type in ['select', 'radio'] and kwargs.get(key):
                selected_answer = question.answer_ids.filtered(lambda answer: answer.id == int(kwargs.get(key)))
                description_bits.append('%s: %s' % (question.name, selected_answer.name))
            elif kwargs.get(key):
                description_bits.append('%s: %s' % (question.name, kwargs.get(key).strip()))
        if description_bits:
            description = '<ul>' + ''.join(['<li>%s</li>' % bit for bit in description_bits]) + '</ul>'

        # FIXME AWA/TDE double check this and/or write some tests to ensure behavior
        # The 'mail_notify_author' is only placed here and not in 'calendar.attendee#_send_mail_to_attendees'
        # Because we only want to notify the author in the context of Online Appointments
        # When creating a meeting from your own calendar in the backend, there is no need to notify yourself
        event = request.env['calendar.event'].with_context(
            mail_notify_author=True,
            allowed_company_ids=staff_user.company_ids.ids,
        ).sudo().create(
            self._prepare_calendar_values(appointment_type, date_start, date_end, duration, description, question_answer_inputs, name, staff_user, Partner)
        )
        event.attendee_ids.write({'state': 'accepted'})
        return request.redirect('/calendar/view/%s?partner_id=%s&%s' % (event.access_token, Partner.id, keep_query('*', state='new')))

    # Tools / Data preparation
    # ------------------------------------------------------------

    def _get_customer_partner(self):
        partner = request.env['res.partner']
        if not request.env.user._is_public():
            partner = request.env.user.partner_id
        return partner

    def _get_customer_country(self):
        """
            Find the country from the geoip lib or fallback on the user or the visitor
        """
        country_code = request.session.geoip and request.session.geoip.get('country_code')
        country = request.env['res.country']
        if country_code:
            country = country.search([('code', '=', country_code)])
        if not country:
            country = request.env.user.country_id if not request.env.user._is_public() else country
        return country

    def _get_default_timezone(self, appointment_type):
        """
            Find the default timezone from the geoip lib or fallback on the user or the visitor
        """
        timezone = appointment_type.appointment_tz if appointment_type.location else request.httprequest.cookies.get('tz')
        if not timezone:
            timezone = appointment_type.appointment_tz
        return timezone

    def _prepare_calendar_values(self, appointment_type, date_start, date_end, duration, description, question_answer_inputs, name, staff_user, partner):
        """
        prepares all values needed to create a new calendar.event
        """
        categ_id = request.env.ref('appointment.calendar_event_type_data_online_appointment')
        alarm_ids = appointment_type.reminder_ids and [(6, 0, appointment_type.reminder_ids.ids)] or []
        partner_ids = list(set([staff_user.partner_id.id] + [partner.id]))
        return {
            'name': _('%s with %s', appointment_type.name, name),
            'start': date_start.strftime(dtf),
            # FIXME master
            # we override here start_date(time) value because they are not properly
            # recomputed due to ugly overrides in event.calendar (reccurrencies suck!)
            #     (fixing them in stable is a pita as it requires a good rewrite of the
            #      calendar engine)
            'start_date': date_start.strftime(dtf),
            'stop': date_end.strftime(dtf),
            'allday': False,
            'duration': duration,
            'description': description,
            'alarm_ids': alarm_ids,
            'location': appointment_type.location,
            'partner_ids': [(4, pid, False) for pid in partner_ids],
            'categ_ids': [(4, categ_id.id, False)],
            'appointment_type_id': appointment_type.id,
            'appointment_answer_input_ids': [(0, 0, answer_input_values) for answer_input_values in question_answer_inputs],
        }

    # ------------------------------------------------------------
    # APPOINTMENT TYPE JSON DATA
    # ------------------------------------------------------------

    @http.route(['/calendar/<int:appointment_type_id>/get_message_intro'],
                type="json", auth="public", methods=['POST'], website=True)
    def get_appointment_message_intro(self, appointment_type_id, **kwargs):
        appointment_type = request.env['calendar.appointment.type'].browse(int(appointment_type_id)).exists()
        if not appointment_type:
            raise NotFound()

        return appointment_type.message_intro or ''

    @http.route(['/calendar/<int:appointment_type_id>/update_available_slots'],
                type="json", auth="public", website=True)
    def calendar_appointment_update_available_slots(self, appointment_type_id, staff_user_id=None, timezone=None, **kwargs):
        """
            Route called when the selected user or the timezone is modified to adapt the possible slots accordingly
        """
        appointment_type = request.env['calendar.appointment.type'].browse(int(appointment_type_id))

        request.session['timezone'] = timezone or appointment_type.appointment_tz
        staff_user = request.env['res.users'].sudo().browse(int(staff_user_id)) if staff_user_id else None
        slots = appointment_type.sudo()._get_appointment_slots(request.session['timezone'], staff_user)
        month_first_available = next((month['id'] for month in slots if month['has_availabilities']), 0)
        formated_days = _formated_weekdays(get_lang(request.env).code)

        return request.env['ir.qweb']._render('appointment.appointment_calendar', {
            'appointment_type': appointment_type,
            'timezone': request.session['timezone'],
            'formated_days': formated_days,
            'slots': slots,
            'month_first_available': month_first_available,
        })
