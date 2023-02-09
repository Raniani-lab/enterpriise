from ast import literal_eval

from odoo import api, models, fields
from odoo.http import request


class MrpWorkcenter(models.Model):
    _inherit = 'mrp.workcenter'

    allow_employee = fields.Boolean("Requires Log In")
    employee_ids = fields.Many2many(
        'hr.employee', string="employees with access",
        help='if left empty, all employees can log in to the workcenter')
    currency_id = fields.Many2one(related='company_id.currency_id')
    employee_costs_hour = fields.Monetary(string='Employee Hourly Cost', currency_field='currency_id', default=0.0)

    def action_work_order(self):
        action = super().action_work_order()
        # for the call to literal_eval
        context = action.get('context', '{}')
        context = context.replace('active_id', str(self.id))
        action['context'] = dict(literal_eval(context), employee_id=request.session.get('employee_id'))
        return action

    def get_employee_barcode(self, barcode):
        employee_ids = self.employee_ids or self.env['hr.employee'].search([])
        return employee_ids.sudo().filtered(lambda e: e.barcode == barcode)[:1].id

    @api.depends('time_ids', 'time_ids.date_end', 'time_ids.loss_type')
    def _compute_working_state(self):
        self.working_state = 'normal'
        time_log = self.env['mrp.workcenter.productivity'].search([
            ('workcenter_id', 'in', self.ids),
            ('date_end', '=', False),
        ])
        for time in time_log:
            if time.loss_type in ('productive', 'performance'):
                # the productivity line has a `loss_type` that means the workcenter is being used
                time.workcenter_id.working_state = 'done'
            else:
                # the workcenter is blocked
                time.workcenter_id.working_state = 'blocked'


class MrpWorkcenterProductivity(models.Model):
    _inherit = "mrp.workcenter.productivity"

    employee_id = fields.Many2one(
        'hr.employee', string="Employee",
        help='employee that record this working time',
        default=lambda self: self.env['hr.employee'].get_session_owner())
    employee_cost = fields.Monetary('employee_cost', compute='_compute_cost', default=0, store=True)
    total_cost = fields.Float('Cost', compute='_compute_cost', compute_sudo=True)
    currency_id = fields.Many2one(related='company_id.currency_id')

    @api.depends('duration')
    def _compute_cost(self):
        for time in self:
            if time.employee_id:
                time.employee_cost = time.employee_id.hourly_cost
            time.total_cost = time.employee_cost * time.duration / 60

    def _check_open_time_ids(self):
        # Override to remove the constraints
        # TODO make check on employees
        pass
