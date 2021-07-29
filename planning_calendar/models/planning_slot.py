# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models


class PlanningSlot(models.Model):
    _inherit = 'planning.slot'

    def _domain_role_id(self):
        meeting_role = self.env.ref('planning_calendar.planning_role_meeting').id
        return [('id', '!=', meeting_role)]

    role_id = fields.Many2one(domain=_domain_role_id)
    calendar_event_id = fields.Many2one('calendar.event', ondelete='cascade')
    attendee_id = fields.Many2one('calendar.attendee', ondelete='cascade')
    show_calendar_event = fields.Boolean(compute='_compute_show_calendar_event')
    event_name = fields.Char(compute='_compute_show_calendar_event')

    @api.depends_context('uid')
    @api.depends('calendar_event_id')
    def _compute_show_calendar_event(self):
        for slot in self:
            show = True
            if not slot.calendar_event_id or slot.calendar_event_id.privacy == 'private' and slot.calendar_event_id.user_id.id != self.env.uid:
                show = False
            slot.show_calendar_event = show
            slot.event_name = slot.calendar_event_id.name if show else False

    def action_view_meeting(self):
        self.ensure_one()
        if not self.show_calendar_event:
            return
        return {
            'type': 'ir.actions.act_window',
            'name': _('Events'),
            'res_model': 'calendar.event',
            'res_id': self.calendar_event_id.id,
            'view_mode': 'form',
        }

    @api.model
    def _get_calendar_model_blacklist(self):
        return []

    @api.model
    def _name_get_fields(self):
        return super()._name_get_fields() + ['event_name']

    @api.model
    def action_copy_previous_week(self, date_start_week, view_domain):
        view_domain.append(('calendar_event_id', '=', False))
        return super().action_copy_previous_week(date_start_week, view_domain)
