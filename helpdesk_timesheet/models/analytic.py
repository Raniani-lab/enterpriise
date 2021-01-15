# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    helpdesk_ticket_id = fields.Many2one('helpdesk.ticket', 'Helpdesk Ticket')

    def _timesheet_preprocess(self, vals):
        helpdesk_ticket_id = vals.get('helpdesk_ticket_id')
        if helpdesk_ticket_id:
            ticket = self.env['helpdesk.ticket'].browse(helpdesk_ticket_id)
            if ticket.project_id:
                vals['project_id'] = ticket.project_id.id
        vals = super(AccountAnalyticLine, self)._timesheet_preprocess(vals)
        return vals

    def _timesheet_get_portal_domain(self):
        domain = super(AccountAnalyticLine, self)._timesheet_get_portal_domain()
        return expression.OR([domain, self._timesheet_in_helpdesk_get_portal_domain()])

    def _timesheet_in_helpdesk_get_portal_domain(self):
        return [
            '&',
                '&',
                    '&',
                        ('task_id', '=', False),
                        ('helpdesk_ticket_id', '!=', False),
                    '|',
                        '|',
                            ('project_id.message_partner_ids', 'child_of', [self.env.user.partner_id.commercial_partner_id.id]),
                            ('project_id.allowed_portal_user_ids', 'child_of', [self.env.user.id]),
                        ('helpdesk_ticket_id.message_partner_ids', 'child_of', [self.env.user.partner_id.commercial_partner_id.id]),
                ('project_id.privacy_visibility', '=', 'portal')
        ]
