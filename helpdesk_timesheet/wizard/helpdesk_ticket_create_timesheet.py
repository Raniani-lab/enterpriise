# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HelpdeskTicketCreateTimesheet(models.TransientModel):
    _name = 'helpdesk.ticket.create.timesheet'
    _description = "Create Timesheet from ticket"

    _sql_constraints = [('time_positive', 'CHECK(time_spent > 0)', "The timesheet's time must be positive" )]

    @api.model
    def default_get(self, fields):
        result = super(HelpdeskTicketCreateTimesheet, self).default_get(fields)

        active_id = self._context.get('active_id')
        if 'ticket_id' in fields and active_id:
            result['ticket_id'] = active_id
        return result

    time_spent = fields.Float('Time', digits=(16, 2))
    description = fields.Char('Description')
    ticket_id = fields.Many2one('helpdesk.ticket', "Ticket", help="Ticket for which we are creating a sales order", required=True)

    def action_generate_timesheet(self):
        values = {
            'task_id': self.ticket_id.task_id.id,
            'project_id': self.ticket_id.project_id.id,
            'date': fields.Datetime.now(),
            'name': self.description,
            'user_id': self.env.uid,
            'unit_amount': self.time_spent,
        }

        timesheet = self.env['account.analytic.line'].create(values)

        self.ticket_id.write({
            'timer_start': False,
            'timer_pause': False
        })
        self.ticket_id.timesheet_ids = [(4, timesheet.id)]
        return timesheet
