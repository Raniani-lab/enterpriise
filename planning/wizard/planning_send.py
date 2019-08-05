# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class PlanningSend(models.TransientModel):
    _name = 'planning.send'
    _description = "Send Planning"

    start_datetime = fields.Datetime("Start Date", required=True)
    end_datetime = fields.Datetime("Stop Date", required=True)
    include_unassigned = fields.Boolean("Includes Open shifts", default=True)
    note = fields.Text("Extra Message", help="Addionnal message displayed in the email sent to employees")
    company_id = fields.Many2one('res.company', "Company", required=True, default=lambda self: self.env.user.company_id)

    _sql_constraints = [
        ('check_start_date_lower_stop_date', 'CHECK(end_datetime > start_datetime)', 'Planning end date should be greater than its start date'),
    ]

    def action_send(self):
        # create the planning
        planning = self.env['planning.planning'].create({
            'start_datetime': self.start_datetime,
            'end_datetime': self.end_datetime,
            'include_unassigned': self.include_unassigned,
            'company_id': self.company_id.id,
        })
        return planning.send_planning(message=self.note)
