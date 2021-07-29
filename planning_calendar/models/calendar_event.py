# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _


class CalendarEvent(models.Model):
    _inherit = 'calendar.event'

    def write(self, vals):
        res = super().write(vals)

        if vals.get('show_as') == 'free':
            self.attendee_ids.planning_slot_ids.sudo().unlink()

        return res

    def action_create_slots(self):
        events = self.attendee_ids.sudo()._create_planning_slots()
        if not events:
            message_type, message = 'warning', _('There are no shifts to create.')
        else:
            message_type, message = 'success', _('The shifts have successfully been generated.')

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'type': message_type,
                'message': message,
            }
        }
