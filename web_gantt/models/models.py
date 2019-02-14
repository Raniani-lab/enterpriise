# -*- coding: utf-8 -*-

from odoo import _, api, models



class Base(models.AbstractModel):
    _inherit = 'base'

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
