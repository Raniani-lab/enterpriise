# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PlanningSend(models.TransientModel):
    _inherit = 'planning.send'

    def _get_slot_domain(self):
        return super()._get_slot_domain() + [('calendar_event_id', '=', False)]
