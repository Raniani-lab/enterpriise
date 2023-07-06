# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid
import logging

from odoo import _, api, Command, fields, models, SUPERUSER_ID
from odoo.exceptions import ValidationError
from odoo.tools import html2plaintext

_logger = logging.getLogger(__name__)

class CalendarEvent(models.Model):
    _inherit = "calendar.event"

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        resource_id = res.get('appointment_resource_id') or self.env.context.get('default_appointment_resource_id')
        # get a relevant appointment type for ease of use when coming from a view that groups by resource
        if not res.get('appointment_type_id') and 'appointment_type_id' in fields_list and resource_id:
            appointment_types = self.env['appointment.resource'].browse(resource_id).appointment_type_ids
            if appointment_types:
                res['appointment_type_id'] = appointment_types[0].id
        return res

    def _default_access_token(self):
        return str(uuid.uuid4())

    access_token = fields.Char('Access Token', default=_default_access_token, readonly=True)
    alarm_ids = fields.Many2many(compute='_compute_alarm_ids', store=True, readonly=False)
    appointment_type_id = fields.Many2one('appointment.type', 'Online Appointment', tracking=True)
    appointment_answer_input_ids = fields.One2many('appointment.answer.input', 'calendar_event_id', string="Appointment Answers")
    appointment_invite_id = fields.Many2one('appointment.invite', 'Appointment Invitation', readonly=True, ondelete='set null')
    appointment_resource_id = fields.Many2one('appointment.resource', string="Appointment Resource",
                                              compute="_compute_appointment_resource_id", inverse="_inverse_appointment_resource_id_or_capacity",
                                              store=True)
    appointment_resource_ids = fields.Many2many('appointment.resource', string="Appointment Resources", compute="_compute_resource_ids")
    booking_line_ids = fields.One2many('appointment.booking.line', 'calendar_event_id', string="Booking Lines")
    resource_total_capacity_reserved = fields.Integer('Total Capacity Reserved', compute="_compute_resource_total_capacity", inverse="_inverse_appointment_resource_id_or_capacity")
    resource_total_capacity_used = fields.Integer('Total Capacity Used', compute="_compute_resource_total_capacity")

    _sql_constraints = [
        ('check_resource_and_appointment_type',
         "CHECK(appointment_resource_id IS NULL OR (appointment_resource_id IS NOT NULL AND appointment_type_id IS NOT NULL))",
         "An event cannot book resources without an appointment type.")
    ]

    @api.depends('appointment_type_id')
    def _compute_alarm_ids(self):
        for event in self.filtered('appointment_type_id'):
            if not event.alarm_ids:
                event.alarm_ids = event.appointment_type_id.reminder_ids

    @api.depends('booking_line_ids.appointment_resource_id')
    def _compute_appointment_resource_id(self):
        for event in self:
            if len(event.booking_line_ids) == 1:
                event.appointment_resource_id = event.booking_line_ids.appointment_resource_id
            else:
                event.appointment_resource_id = False

    @api.depends('booking_line_ids')
    def _compute_resource_ids(self):
        for event in self:
            event.appointment_resource_ids = event.booking_line_ids.appointment_resource_id

    @api.depends('booking_line_ids')
    def _compute_resource_total_capacity(self):
        booking_data = self.env['appointment.booking.line']._read_group(
            [('calendar_event_id', 'in', self.ids)],
            ['calendar_event_id'],
            ['capacity_reserved:sum', 'capacity_used:sum'],
        )
        mapped_data = {
            meeting.id: {
                'total_capacity_reserved': total_capacity_reserved,
                'total_capacity_used': total_capacity_used,
            } for meeting, total_capacity_reserved, total_capacity_used in booking_data}

        for event in self:
            data = mapped_data.get(event.id)
            event.resource_total_capacity_reserved = data.get('total_capacity_reserved', 0) if data else 0
            event.resource_total_capacity_used = data.get('total_capacity_used', 0) if data else 0

    def _compute_is_highlighted(self):
        super(CalendarEvent, self)._compute_is_highlighted()
        if self.env.context.get('active_model') == 'appointment.type':
            appointment_type_id = self.env.context.get('active_id')
            for event in self:
                if event.appointment_type_id.id == appointment_type_id:
                    event.is_highlighted = True

    def _init_column(self, column_name):
        """ Initialize the value of the given column for existing rows.
            Overridden here because we skip generating unique access tokens
            for potentially tons of existing event, should they be needed,
            they will be generated on the fly.
        """
        if column_name != 'access_token':
            super(CalendarEvent, self)._init_column(column_name)

    def _inverse_appointment_resource_id_or_capacity(self):
        """Update booking lines as inverse of both resource capacity and resource id.

        As both values are related to the booking line and resource capacity is dependant
        on resource id existing in the first place, They need to both use the same inverse
        field to ensure there is no ordering conflict.
        """
        for event in self:
            if not event.booking_line_ids and event.appointment_resource_id:
                self.env['appointment.booking.line'].create({
                    'appointment_resource_id': event.appointment_resource_id.id,
                    'calendar_event_id': event.id,
                    'capacity_reserved': event.resource_total_capacity_reserved,
                })
            elif len(event.booking_line_ids) == 1 and event.appointment_resource_id:
                event.booking_line_ids.appointment_resource_id = event.appointment_resource_id
                event.booking_line_ids.capacity_reserved = event.resource_total_capacity_reserved
            elif len(event.booking_line_ids) == 1:
                event.booking_line_ids.unlink()

    def _generate_access_token(self):
        for event in self:
            event.access_token = self._default_access_token()

    def _get_public_fields(self):
        return super()._get_public_fields() | {
            'appointment_resource_id',
            'appointment_resource_ids',
            'appointment_type_id',
            'resource_total_capacity_reserved',
            'resource_total_capacity_used',
        }

    def action_cancel_meeting(self, partner_ids):
        """ In case there are more than two attendees (responsible + another attendee),
            we do not want to archive the calendar.event.
            We'll just remove the attendee(s) that made the cancellation request
        """
        self.ensure_one()
        attendees = self.env['calendar.attendee'].search([('event_id', '=', self.id), ('partner_id', 'in', partner_ids)])
        if attendees:
            cancelling_attendees = ", ".join([attendee.display_name for attendee in attendees])
            message_body = _("Appointment canceled by: %(partners)s", partners=cancelling_attendees)
            self.partner_ids -= attendees.partner_id
            if len(self.attendee_ids - attendees) >= 2:
                self.message_post(body=message_body, message_type='notification', author_id=attendees[0].partner_id.id)
            else:
                self._track_set_log_message("<p>%s</p>" % message_body)
                # Don't post as "Public User" or current user as trigger is cancelling attendee(s).
                self.with_user(SUPERUSER_ID).action_archive()

    def _get_mail_tz(self):
        self.ensure_one()
        if not self.event_tz and self.appointment_type_id.appointment_tz:
            return self.appointment_type_id.appointment_tz
        return super()._get_mail_tz()

    def _track_template(self, changes):
        res = super(CalendarEvent, self)._track_template(changes)
        if not self.appointment_type_id:
            return res

        # Replace Public User with OdooBot
        author = {'author_id': self.env.ref('base.partner_root').id} if self.env.user._is_public() else {}

        if 'appointment_type_id' in changes:
            try:
                booked_template = self.env.ref('appointment.appointment_booked_mail_template')
            except ValueError as e:
                _logger.warning("Mail could not be sent, as mail template is not found : %s", e)
            else:
                res['appointment_type_id'] = (booked_template.sudo(), {
                    **author,
                    'auto_delete_keep_log': False,
                    'subtype_id': self.env['ir.model.data']._xmlid_to_res_id('appointment.mt_calendar_event_booked'),
                    'email_layout_xmlid': 'mail.mail_notification_light'
                })
        if 'active' in changes and not self.active and self.start > fields.Datetime.now():
            try:
                canceled_template = self.env.ref('appointment.appointment_canceled_mail_template')
            except ValueError as e:
                _logger.warning("Mail could not be sent, as mail template is not found : %s", e)
            else:
                res['active'] = (canceled_template.sudo(), {
                    **author,
                    'auto_delete_keep_log': False,
                    'subtype_id': self.env['ir.model.data']._xmlid_to_res_id('appointment.mt_calendar_event_canceled'),
                    'email_layout_xmlid': 'mail.mail_notification_light'
                })
        return res

    def _track_subtype(self, init_values):
        self.ensure_one()
        # when tracking 'active' changes: consider this is a discussion to be sent to all followers
        if self.appointment_type_id and 'active' in init_values and not self.active:
            return self.env.ref('mail.mt_comment')
        return super()._track_subtype(init_values)

    def _get_customer_description(self):
        # Description should make sense for the person who booked the meeting
        if self.appointment_type_id:
            message_confirmation = self.appointment_type_id.message_confirmation or ''
            contact_details = ''
            if self.partner_id and (self.partner_id.name or self.partner_id.email or self.partner_id.phone):
                email_detail_line = _('Email: %(email)s', email=self.partner_id.email) if self.partner_id.email else ''
                phone_detail_line = _('Phone: %(phone)s', phone=self.partner_id.phone) if self.partner_id.phone else ''
                contact_details = '\n'.join(line for line in (_('Contact Details:'), self.partner_id.name, email_detail_line, phone_detail_line) if line)
            return f"{html2plaintext(message_confirmation)}\n\n{contact_details}".strip()
        return super()._get_customer_description()

    def _get_customer_summary(self):
        # Summary should make sense for the person who booked the meeting
        if self.appointment_type_id and self.partner_id:
            return _('%(appointment_name)s with %(partner_name)s',
                     appointment_name=self.appointment_type_id.name,
                     partner_name=self.partner_id.name or _('somebody'))
        return super()._get_customer_summary()
