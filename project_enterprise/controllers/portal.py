# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.addons.project.controllers.portal import ProjectCustomerPortal

class ProjectPortal(ProjectCustomerPortal):
    def _task_get_searchbar_sortings(self):
        values = super()._task_get_searchbar_sortings()
        values['planned_date_begin'] = {'label': _('Planned Date'), 'order': 'planned_date_begin asc', 'sequence': 7}
        return values
