# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.exceptions import AccessError, MissingError

from odoo.addons.helpdesk.controllers.portal import CustomerPortal
from odoo.addons.project.controllers.portal import ProjectCustomerPortal

class ProjectHelpdeskPortal(ProjectCustomerPortal, CustomerPortal):

    def _task_get_page_view_values(self, task, access_token, **kwargs):
        values = super()._task_get_page_view_values(task, access_token, **kwargs)
        try:
            if task.helpdesk_ticket_id and self._document_check_access('helpdesk.ticket', task.helpdesk_ticket_id.id):
                values['task_link_section'].append({
                    'access_url': task.helpdesk_ticket_id.get_portal_url(),
                    'title': _('Ticket'),
                })
        except (AccessError, MissingError):
            pass

        return values
