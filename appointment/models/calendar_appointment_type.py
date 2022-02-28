# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import calendar as cal
import random
import pytz
from datetime import datetime, timedelta, time
from dateutil import rrule
from dateutil.relativedelta import relativedelta
from babel.dates import format_datetime, format_time
from werkzeug.urls import url_join

from odoo import api, fields, models, _, Command
from odoo.exceptions import ValidationError
from odoo.tools.misc import babel_locale_parse, get_lang
from odoo.addons.base.models.res_partner import _tz_get
from odoo.addons.http_routing.models.ir_http import slug


class CalendarAppointmentType(models.Model):
    _name = "calendar.appointment.type"
    _description = "Appointment Type"
    _inherit = ['mail.thread']
    _order = "sequence, id"

    @api.model
    def default_get(self, default_fields):
        result = super().default_get(default_fields)
        if 'category' not in default_fields or result.get('category') == 'custom':
            if not result.get('name'):
                result['name'] = _("%s - Let's meet", self.env.user.name)
            if (not default_fields or 'staff_user_ids' in default_fields) and not result.get('staff_user_ids'):
                result['staff_user_ids'] = [Command.set(self.env.user.ids)]
        return result

    sequence = fields.Integer('Sequence', default=10)
    name = fields.Char('Appointment Type', required=True, translate=True)
    active = fields.Boolean(default=True)
    category = fields.Selection([
        ('website', 'Website'),
        ('custom', 'Custom'),
        ], string="Category", default="website",
        help="""Used to define this appointment type's category.
        Can be one of:
            - Website: the default category, the people can access and shedule the appointment with users from the website
            - Custom: the user will create and share to another user a custom appointment type with hand-picked time slots """)
    min_schedule_hours = fields.Float('Schedule before (hours)', required=True, default=1.0)
    max_schedule_days = fields.Integer('Schedule not after (days)', required=True, default=15)
    min_cancellation_hours = fields.Float('Cancel Before (hours)', required=True, default=1.0)
    appointment_duration = fields.Float('Appointment Duration', required=True, default=1.0)

    reminder_ids = fields.Many2many('calendar.alarm', string="Reminders")
    location = fields.Char('Location', help="Location of the appointments")
    message_confirmation = fields.Html('Confirmation Message', translate=True)
    message_intro = fields.Html('Introduction Message', translate=True)

    country_ids = fields.Many2many(
        'res.country', 'appointment_type_country_rel', string='Restrict Countries',
        help="Keep empty to allow visitors from any country, otherwise you only allow visitors from selected countries")
    question_ids = fields.One2many('calendar.appointment.question', 'appointment_type_id', string='Questions', copy=True)

    slot_ids = fields.One2many('calendar.appointment.slot', 'appointment_type_id', 'Availabilities', copy=True)
    appointment_tz = fields.Selection(
        _tz_get, string='Timezone', required=True, default=lambda self: self.env.user.tz,
        help="Timezone where appointment take place")
    staff_user_ids = fields.Many2many('res.users', 'appointment_type_res_users_rel', domain="[('share', '=', False)]", string='Users')

    assign_method = fields.Selection([
        ('random', 'Random'),
        ('chosen', 'Chosen by the Customer')], string='Assignment Method', default='random',
        help="How users will be assigned to meetings customers book on your website.")
    appointment_count = fields.Integer('# Appointments', compute='_compute_appointment_count')

    def _compute_appointment_count(self):
        meeting_data = self.env['calendar.event']._read_group([('appointment_type_id', 'in', self.ids)], ['appointment_type_id'], ['appointment_type_id'])
        mapped_data = {m['appointment_type_id'][0]: m['appointment_type_id_count'] for m in meeting_data}
        for appointment_type in self:
            appointment_type.appointment_count = mapped_data.get(appointment_type.id, 0)

    @api.constrains('category', 'staff_user_ids', 'slot_ids')
    def _check_staff_user_configuration(self):
        for appointment_type in self:
            if appointment_type.category != 'website' and len(appointment_type.staff_user_ids) != 1:
                raise ValidationError(_("This category of appointment type should only have one user but got %s users", len(appointment_type.staff_user_ids)))
            invalid_restricted_users = appointment_type.slot_ids.restrict_to_user_ids - appointment_type.staff_user_ids
            if invalid_restricted_users:
                raise ValidationError(_("The following users are in restricted slots but they are not part of the available staff: %s", ", ".join(invalid_restricted_users.mapped('name'))))

    @api.model_create_multi
    def create(self, vals_list):
        """ We don't want the current user to be follower of all created types """
        return super(CalendarAppointmentType, self.with_context(mail_create_nosubscribe=True)).create(vals_list)

    @api.returns('self', lambda value: value.id)
    def copy(self, default=None):
        default = default or {}
        default['name'] = self.name + _(' (copy)')
        return super(CalendarAppointmentType, self).copy(default=default)

    def action_calendar_meetings(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("calendar.action_calendar_event")
        appointments = self.env['calendar.event'].search([
            ('appointment_type_id', '=', self.id), ('start', '>=', datetime.today()
        )], order='start')
        nbr_appointments_week_later = self.env['calendar.event'].search_count([
            ('appointment_type_id', '=', self.id), ('start', '>=', datetime.today() + timedelta(weeks=1))
        ])

        action['context'] = {
            'default_appointment_type_id': self.id,
            'search_default_appointment_type_id': self.id,
            'default_mode': "month" if nbr_appointments_week_later else "week",
            'initial_date': appointments[0].start if appointments else datetime.today(),
        }
        return action

    def action_share(self):
        self.ensure_one()
        return {
            'name': _('Share Link'),
            'type': 'ir.actions.act_window',
            'res_model': 'calendar.appointment.share',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_appointment_type_ids': self.ids,
                'default_staff_user_ids': self.staff_user_ids.filtered(lambda staff_user: staff_user.id == self.env.user.id).ids,
            }
        }

    def action_customer_preview(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': url_join(self.get_base_url(), '/calendar/%s' % slug(self)),
            'target': 'self',
        }

    # --------------------------------------
    # Slots Generation
    # --------------------------------------

    def _slots_generate(self, first_day, last_day, timezone, reference_date=None):
        """ Generate all appointment slots (in naive UTC, appointment timezone, and given (visitors) timezone)
            between first_day and last_day (datetimes in appointment timezone)

            :return: [ {'slot': slot_record, <timezone>: (date_start, date_end), ...},
                      ... ]
        """
        if not reference_date:
            reference_date = datetime.utcnow()

        def append_slot(day, slot):
            local_start = appt_tz.localize(datetime.combine(day, time(hour=int(slot.start_hour), minute=int(round((slot.start_hour % 1) * 60)))))
            local_end = appt_tz.localize(
                datetime.combine(day, time(hour=int(slot.start_hour), minute=int(round((slot.start_hour % 1) * 60)))) + relativedelta(hours=self.appointment_duration))
            while (local_start.hour + local_start.minute / 60) <= slot.end_hour - self.appointment_duration:
                slots.append({
                    self.appointment_tz: (
                        local_start,
                        local_end,
                    ),
                    timezone: (
                        local_start.astimezone(requested_tz),
                        local_end.astimezone(requested_tz),
                    ),
                    'UTC': (
                        local_start.astimezone(pytz.UTC).replace(tzinfo=None),
                        local_end.astimezone(pytz.UTC).replace(tzinfo=None),
                    ),
                    'slot': slot,
                })
                local_start = local_end
                local_end += relativedelta(hours=self.appointment_duration)
        appt_tz = pytz.timezone(self.appointment_tz)
        requested_tz = pytz.timezone(timezone)

        slots = []
        # We use only the recurring slot if it's not a custom appointment type.
        if self.category != 'custom':
            # Regular recurring slots (not a custom appointment), generate necessary slots using configuration rules
            for slot in self.slot_ids.filtered(lambda x: int(x.weekday) == first_day.isoweekday()):
                if slot.end_hour > first_day.hour + first_day.minute / 60.0:
                    append_slot(first_day.date(), slot)
            slot_weekday = [int(weekday) - 1 for weekday in self.slot_ids.mapped('weekday')]
            for day in rrule.rrule(rrule.DAILY,
                                dtstart=first_day.date() + timedelta(days=1),
                                until=last_day.date(),
                                byweekday=slot_weekday):
                for slot in self.slot_ids.filtered(lambda x: int(x.weekday) == day.isoweekday()):
                    append_slot(day, slot)
        else:
            # Custom appointment type, we use "unique" slots here that have a defined start/end datetime
            unique_slots = self.slot_ids.filtered(lambda slot: slot.slot_type == 'unique' and slot.end_datetime > reference_date)

            staff_user = self.staff_user_ids[0]  # There is only 1 staff_user in this case
            for slot in unique_slots:
                start = slot.start_datetime.astimezone(tz=None)
                end = slot.end_datetime.astimezone(tz=None)
                startUTC = start.astimezone(pytz.UTC).replace(tzinfo=None)
                endUTC = end.astimezone(pytz.UTC).replace(tzinfo=None)
                if staff_user.partner_id.calendar_verify_availability(startUTC, endUTC):
                    slots.append({
                        self.appointment_tz: (
                            start.astimezone(appt_tz),
                            end.astimezone(appt_tz),
                        ),
                        timezone: (
                            start.astimezone(requested_tz),
                            end.astimezone(requested_tz),
                        ),
                        'UTC': (
                            startUTC,
                            endUTC,
                        ),
                        'slot': slot,
                        'staff_user_id': staff_user,
                    })
        return slots

    def _slots_available(self, slots, first_day, last_day, staff_user=None):
        """ Fills the slot structure with an available user

            :param slots: slots structure generated by _slots_generate
            :param first_day: start datetime in UTC
            :param last_day: end datetime in UTC
            :param staff_user: if set, only consider this user
                             if not set, consider all users assigned to this appointment type
        """
        availabe_staff_users = staff_user or self.staff_user_ids
        # Shuffle the available users into a random order to avoid having the same one assigned every time
        availabe_staff_users = availabe_staff_users.sorted(lambda staff_user: random.random())
        availability_additional_values = self._prepare_availability_additional_values(availabe_staff_users, first_day, last_day)
        for slot in slots:
            available_staff_user = next((
                staff_user
                for staff_user in availabe_staff_users
                if self._is_staff_user_available(staff_user.with_context(tz=staff_user.tz), slot, availability_additional_values)), False)
            if available_staff_user:
                slot['staff_user_id'] = available_staff_user

    def _is_staff_user_available(self, staff_user, slot, availability_additional_values):
        """ This method verifies if the staff_user is available on the given slot. It checks whether
            the user has calendar events clashing.
            If the slot has users restricted to it, we check if the user is included in it before checking
            is availability.
        """
        if slot['slot'].restrict_to_user_ids and staff_user not in slot['slot'].restrict_to_user_ids:
            return False
        if not staff_user.partner_id.calendar_verify_availability(slot['UTC'][0], slot['UTC'][1]):
            return False
        return True

    @api.model
    def _prepare_availability_additional_values(self, available_staff_users, first_day, last_day):
        """ Hook method used to add additional useful values in the computation of availability of slots.
            Datetimes are in UTC. This will be typically used in the hr module to also prepare working schedule of each
            user in available_staff_users. We prepare values instead of fetching the working schedule
            in "_is_staff_user_available" because doing that in a loop would be highly inefficient in terms of performances,
            this hook allows fetching the working schedule of employees only once for the whole "_slots_available" method."""
        return {}

    def _get_appointment_slots(self, timezone, staff_user=None, reference_date=None):
        """ Fetch available slots to book an appointment
            :param timezone: timezone string e.g.: 'Europe/Brussels' or 'Etc/GMT+1'
            :param staff_user: if set will only check available slots for this user.
            :returns: list of dicts (1 per month) containing available slots per day per week.
                      complex structure used to simplify rendering of template
        """
        self.ensure_one()
        if not reference_date:
            reference_date = datetime.utcnow()

        appt_tz = pytz.timezone(self.appointment_tz)
        requested_tz = pytz.timezone(timezone)
        first_day = requested_tz.fromutc(reference_date + relativedelta(hours=self.min_schedule_hours))
        appointment_duration_days = self.max_schedule_days
        unique_slots = self.slot_ids.filtered(lambda slot: slot.slot_type == 'unique')
        if self.category == 'custom' and unique_slots:
            appointment_duration_days = (unique_slots[-1].end_datetime - reference_date).days
        last_day = requested_tz.fromutc(reference_date + relativedelta(days=appointment_duration_days))

        # Compute available slots (ordered)
        slots = self._slots_generate(
            first_day.astimezone(appt_tz),
            last_day.astimezone(appt_tz),
            timezone,
            reference_date=reference_date
        )
        if not staff_user or staff_user in self.staff_user_ids:
            self._slots_available(slots, first_day.astimezone(pytz.UTC), last_day.astimezone(pytz.UTC), staff_user)
        total_nb_slots = len(slots)
        nb_slots_previous_months = 0

        # Compute calendar rendering and inject available slots
        today = requested_tz.fromutc(reference_date)
        start = today
        locale = babel_locale_parse(get_lang(self.env).code)
        month_dates_calendar = cal.Calendar(locale.first_week_day).monthdatescalendar
        months = []
        while (start.year, start.month) <= (last_day.year, last_day.month):
            nb_slots_next_months = len(slots)
            has_availabilities = False
            dates = month_dates_calendar(start.year, start.month)
            for week_index, week in enumerate(dates):
                for day_index, day in enumerate(week):
                    mute_cls = weekend_cls = today_cls = None
                    today_slots = []
                    if day.weekday() in (locale.weekend_start, locale.weekend_end):
                        weekend_cls = 'o_weekend'
                    if day == today.date() and day.month == today.month:
                        today_cls = 'o_today'
                    if day.month != start.month:
                        mute_cls = 'text-muted o_mute_day'
                    else:
                        # slots are ordered, so check all unprocessed slots from until > day
                        while slots and (slots[0][timezone][0].date() <= day):
                            if (slots[0][timezone][0].date() == day) and ('staff_user_id' in slots[0]):
                                slot = {
                                    'staff_user_id': slots[0]['staff_user_id'].id,
                                    'datetime': slots[0][timezone][0].strftime('%Y-%m-%d %H:%M:%S'),
                                }
                                if slots[0]['slot'].allday:
                                    slot.update({
                                        'hours': _("All day"),
                                        'duration': 24,
                                    })
                                else:
                                    start_hour = format_time(slots[0][timezone][0].time(), format='short', locale=locale)
                                    end_hour = format_time(slots[0][timezone][1].time(), format='short', locale=locale)
                                    slot.update({
                                        'hours': "%s - %s" % (start_hour, end_hour) if self.category == 'custom' else start_hour,
                                        'duration': str((slots[0][timezone][1] - slots[0][timezone][0]).total_seconds() / 3600),
                                    })
                                today_slots.append(slot)
                            slots.pop(0)
                            nb_slots_next_months -= 1
                    today_slots = sorted(today_slots, key=lambda d: d['datetime'])
                    dates[week_index][day_index] = {
                        'day': day,
                        'slots': today_slots,
                        'mute_cls': mute_cls,
                        'weekend_cls': weekend_cls,
                        'today_cls': today_cls
                    }

                    has_availabilities = has_availabilities or bool(today_slots)

            months.append({
                'id': len(months),
                'month': format_datetime(start, 'MMMM Y', locale=get_lang(self.env).code),
                'weeks': dates,
                'has_availabilities': has_availabilities,
                'nb_slots_previous_months': nb_slots_previous_months,
                'nb_slots_next_months': nb_slots_next_months,
            })
            nb_slots_previous_months = total_nb_slots - nb_slots_next_months
            start = start + relativedelta(months=1)
        return months
