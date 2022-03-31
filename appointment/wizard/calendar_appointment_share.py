# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.urls import url_encode, url_join

from odoo.addons.http_routing.models.ir_http import slug
from odoo import api, models, fields

class CalendarAppointmentShare(models.TransientModel):
    _name = 'calendar.appointment.share'
    _description = 'Calendar Appointment Share Wizard'

    def _domain_appointment_type_ids(self):
        return [('category', '=', 'website')]

    appointment_type_ids = fields.Many2many('calendar.appointment.type', domain=_domain_appointment_type_ids, string='Appointments')
    appointment_type_count = fields.Integer('Selected Appointments Count', compute='_compute_appointment_type_count')
    suggested_staff_user_ids = fields.Many2many(
        'res.users', related='appointment_type_ids.staff_user_ids', string='Possible users',
        help="Get the users linked to the appointment type selected to apply a domain on the users that can be selected")
    staff_user_ids = fields.Many2many(
        'res.users', string='Users',
        compute='_compute_staff_user_ids', store=True, readonly=False,
        help="The users that will be displayed/filtered for the user to make its appointment")
    share_link = fields.Char('Link', compute='_compute_share_link')

    @api.depends('appointment_type_ids')
    def _compute_appointment_type_count(self):
        for appointment_link in self:
            appointment_link.appointment_type_count = len(appointment_link.appointment_type_ids)

    @api.depends('appointment_type_ids')
    def _compute_staff_user_ids(self):
        for appointment_link in self:
            staff_users = appointment_link.appointment_type_ids.staff_user_ids._origin
            if len(staff_users) == 1:
                appointment_link.staff_user_ids = staff_users
            else:
                appointment_link.staff_user_ids = self.env.user if self.env.user in staff_users else False

    @api.depends('appointment_type_ids', 'staff_user_ids')
    def _compute_share_link(self):
        """
        Compute a link that will be share for the user depending on the appointment types and users
        selected. We allow to preselect a group of them if there is only one appointment type selected.
        Indeed, it would be too complex to manage ones with multiple appointment types.
        Two possible params can be generated with the link:
            - filter_staff_user_ids: which allows the user to select an user between the ones selected
            - filter_appointment_type_ids: which display a selection of appointment types to user from which
            he can choose
        """
        calendar_url = url_join(self.get_base_url(), '/calendar')
        for appointment_link in self:
            # If there are multiple appointment types selected, we share the link that will filter the appointments to the user
            url_param = {
                'filter_appointment_type_ids': str(appointment_link.appointment_type_ids.ids)
            }
            if len(appointment_link.appointment_type_ids) == 1:
                # If only one appointment type is selected, we share the appointment link with the possible users selected
                if appointment_link.staff_user_ids:
                    url_param.update({
                        'filter_staff_user_ids': str(appointment_link.staff_user_ids.ids)
                    })
                appt_link = url_join('%s/' % calendar_url, slug(appointment_link.appointment_type_ids._origin))
                share_link = '%s?%s' % (appt_link, url_encode(url_param))
            elif appointment_link.appointment_type_ids:
                share_link = '%s?%s' % (calendar_url, url_encode(url_param))
            else:
                share_link = calendar_url

            appointment_link.share_link = share_link
