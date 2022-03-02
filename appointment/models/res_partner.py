# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Partner(models.Model):

    _inherit = "res.partner"

    def calendar_verify_availability(self, date_start, date_end):
        """ Verify availability of the partner(s) between 2 datetimes on their calendar.

        :param datetime date_start: beginning of slot boundary. Not timezoned UTC;
        :param datetime date_end: end of slot boundary. Not timezoned UTC;
        """
        if bool(self.env['calendar.event'].search_count([
            ('partner_ids', 'in', self.ids),
            '|', '&', ('start', '<', fields.Datetime.to_string(date_end)),
                      ('stop', '>', fields.Datetime.to_string(date_start)),
                 '&', ('allday', '=', True),
                      '|', ('start_date', '=', fields.Date.to_string(date_end)),
                           ('start_date', '=', fields.Date.to_string(date_start))])):
            return False
        return True
