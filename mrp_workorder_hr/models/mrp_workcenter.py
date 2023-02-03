from ast import literal_eval

from odoo import api, models, fields
from datetime import timedelta
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
        for workcenter in self:
            time_log = self.env['mrp.workcenter.productivity'].search([
                ('workcenter_id', '=', workcenter.id),
                ('date_end', '=', False),
            ], limit=1)
            if not time_log:
                # the workcenter is not being used
                workcenter.working_state = 'normal'
            elif time_log.loss_type in ('productive', 'performance'):
                # the productivity line has a `loss_type` that means the workcenter is being used
                workcenter.working_state = 'done'
            else:
                # the workcenter is blocked
                workcenter.working_state = 'blocked'


class MrpWorkcenterProductivity(models.Model):
    _inherit = "mrp.workcenter.productivity"

    employee_id = fields.Many2one(
        'hr.employee', string="Employee",
        help='employee that record this working time',
        default=lambda self: self._get_current_session_admin())
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
        self.env['mrp.productivity.time']._read_group([
            ('workorder_id', 'in', self.workorder_id.ids),
            ('date_stop', '=', False),
            ('employee_id', '!=', False),
        ], ['employee_id', 'workorder_id'], ['employee_id', 'workorder_id'], lazy=False)
        # TODO make check on employees

    def _get_current_session_admin(self):
        main_employee_connected = None
        if request and 'session_owner' in request.session.data.keys():
            main_employee_connected = request.session.data['session_owner']
        return main_employee_connected

    @api.onchange('duration')
    def _duration_changed(self):
        self.date_end = self.date_start + timedelta(minutes=self.duration)
        self._loss_type_change()

    @api.onchange('date_start')
    def _date_start_changed(self):
        self.date_end = self.date_start + timedelta(minutes=self.duration)
        self._loss_type_change()

    @api.onchange('date_end')
    def _date_end_changed(self):
        self.date_start = self.date_end - timedelta(minutes=self.duration)
        self._loss_type_change()

    def _loss_type_change(self):
        self.ensure_one()
        if self.workorder_id.duration > self.workorder_id.duration_expected:
            self.loss_id = self.env.ref("mrp.block_reason4").id
        else:
            self.loss_id = self.env.ref("mrp.block_reason7").id
