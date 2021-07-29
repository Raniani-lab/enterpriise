# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, models
from odoo.exceptions import UserError


class PlanningRole(models.Model):
    _inherit = 'planning.role'

    @api.ondelete(at_uninstall=False)
    def _unlink_except_meeting(self):
        meeting_role = self.env.ref('planning_calendar.planning_role_meeting').id
        if meeting_role in self.ids:
            raise UserError(
                _('You cannot modify nor delete the "Meeting" role because it is required by the Calendar application.'))

    def write(self, vals):
        meeting_role = self.env.ref('planning_calendar.planning_role_meeting').id
        if not self.env.context.get('install_mode') and meeting_role in self.ids and vals.keys() - {'color'}:
            raise UserError(
                _('You cannot modify nor delete the "Meeting" role because it is required by the Calendar application.'))

        return super().write(vals)
