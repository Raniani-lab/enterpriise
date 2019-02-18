# -*- coding: utf-8 -*-
from odoo import _, api, models
from lxml.builder import E
from odoo.exceptions import UserError


class Base(models.AbstractModel):
    _inherit = 'base'

    _start_name = 'date_start'       # start field to use for default gantt view
    _stop_name = 'date_stop'         # stop field to use for default gantt view

    @api.model
    def _get_default_gantt_view(self):
        """ Generates a default gantt view by trying to infer
        time-based fields from a number of pre-set attribute names

        :returns: a gantt view
        :rtype: etree._Element
        """
        view = E.gantt(string=self._description)

        gantt_field_names = {
            '_start_name': ['date_start', 'start_date', 'x_date_start', 'x_start_date'],
            '_stop_name': ['date_stop', 'stop_date', 'date_end', 'end_date', 'x_date_stop', 'x_stop_date', 'x_date_end', 'x_end_date'],
        }
        for name in gantt_field_names.keys():
            if getattr(self, name) not in self._fields:
                for dt in gantt_field_names[name]:
                    if dt in self._fields:
                        setattr(self, name, dt)
                        break
                else:
                    raise UserError(_("Insufficient fields for Gantt View!"))
        view.set('date_start', self._start_name)
        view.set('date_stop', self._stop_name)

        return view

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None):
        """
        Get unavailability slots displayed in the Gantt view for a given time
        range.

        This method is meant to be overriden by each model that want to
        implement this feature on a Gantt view.

        Example:
            * start_date = 01/01/2000, end_date = 01/07/2000, scale = 'week'
            * result could be {'1': 1, '4': 1, '6': 1} to display 01/02, 01/05
              and 01/07 as unavailable

        :param datetime start_date: start date
        :param datetime stop_date: stop date
        :param string scale: among "day", "week", "month" and "year"
        :param None | list[str] group_bys: group_by fields
        :returns: dict of unavailability
        """
        return {}
