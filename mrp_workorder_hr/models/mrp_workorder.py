# -*- coding: utf-8 -*-
from collections import defaultdict
from datetime import datetime

from odoo import Command, models, fields, api, _
from odoo.addons.resource.models.utils import Intervals
from odoo.addons.web.controllers.utils import clean_action
from odoo.exceptions import UserError
from odoo.http import request


class MrpWorkorder(models.Model):
    _inherit = 'mrp.workorder'

    # used to display the connected employee that will start a workorder on the tablet view
    employee_id = fields.Many2one('hr.employee', string="Employee", compute='_compute_employee_id')
    employee_name = fields.Char(compute='_compute_employee_id')

    # employees that started working on the wo
    employee_ids = fields.Many2many('hr.employee', string='Working employees', copy=False)
    # employees assigned to the wo
    employee_assigned_ids = fields.Many2many('hr.employee', 'mrp_workorder_employee_assigned',
                                             'workorder_id', 'employee_id', string='Assigned', copy=False)
    # employees connected
    connected_employee_ids = fields.Many2many('hr.employee', compute='_get_employees_connected', search='search_is_assigned_to_connected')

    # boolean to know if the workcenter need authentication
    allow_employee = fields.Boolean(related='workcenter_id.allow_employee')
    # list of all employees allowed to work on the workcenter
    allowed_employees = fields.Many2many(related='workcenter_id.employee_ids')
    # boolean that checks if all employees are allowed or not
    all_employees_allowed = fields.Boolean(compute='_all_employees_allowed')

    def _compute_duration(self):
        wo_ids_without_employees = set()
        for wo in self:
            if not wo.workcenter_id.allow_employee:
                wo_ids_without_employees.add(wo.id)
                continue
            now = datetime.now()
            loss_type_times = defaultdict(lambda: self.env['mrp.workcenter.productivity'])
            for time in wo.time_ids:
                loss_type_times[time.loss_id.loss_type] |= time
            duration = 0
            for dummy, times in loss_type_times.items():
                duration += self._intervals_duration([(t.date_start, t.date_end or now, t) for t in times])
            wo.duration = duration
        return super(MrpWorkorder, self.env['mrp.workorder'].browse(wo_ids_without_employees))._compute_duration()

    @api.depends('employee_ids')
    def _compute_employee_id(self):
        main_employee_connected = None
        if request and 'session_owner' in request.session.keys() and request.session['session_owner']:
            main_employee_connected = request.session['session_owner']
        self.employee_id = main_employee_connected
        self.employee_name = self.env['hr.employee'].browse(main_employee_connected).name

    @api.depends('connected_employee_ids')
    def _get_employees_connected(self):
        property_name = 'employee_connected_list'
        if property_name in request.session.data.keys() and len(request.session['employee_connected_list']) > 0:
            employees = request.session.data[property_name]
            if employees:
                for wo in self:
                    wo.connected_employee_ids = self.env['hr.employee'].browse(employees)
        else:
            for wo in self:
                wo.connected_employee_ids = self.env['hr.employee'].browse()

    def search_is_assigned_to_connected(self, operator, value):
        # retrieving employees connected in the session
        main_employee_connected = None
        if 'employees_connected' in request.session.data.keys() and len(request.session['employees_connected']) > 0:
            main_employee_connected = request.session.data['employees_connected'][0]
        # if no one is connected, all records are valid
        if not main_employee_connected:
            return []
        # create the array containing the ids of the WO to display
        wo_to_display = []
        wokorders = self.env['mrp.workorder'].search([])
        for wo in wokorders:
            assigned = False
            for assign_id in wo.employee_assigned_ids:
                if assigned:
                    break
                if assign_id.id == main_employee_connected:
                    wo_to_display.append(wo.id)
                    assigned = True
                    break
        return [('id', operator, wo_to_display)]

    @api.depends('all_employees_allowed')
    def _all_employees_allowed(self):
        for wo in self:
            if wo.allow_employee and len(wo.allowed_employees) == 0 or not wo.allow_employee:
                wo.all_employees_allowed = True
            else:
                wo.all_employees_allowed = False

    def start_employee(self, employee_id):
        self.ensure_one()
        if employee_id in self.employee_ids.ids and any(not t.date_end for t in self.time_ids if t.employee_id.id == employee_id):
            return
        self.employee_ids = [Command.link(employee_id)]
        time_data = self._prepare_timeline_vals(self.duration, datetime.now())
        time_data['employee_id'] = employee_id
        self.env['mrp.workcenter.productivity'].create(time_data)
        self.state = "progress"

    def stop_employee(self, employee_ids):
        self.ensure_one()
        if employee_ids not in self.employee_ids.ids:
            return
        self.employee_ids = [Command.unlink(employee_ids)]
        self.env['mrp.workcenter.productivity'].search([
            ('employee_id', '=', employee_ids),
            ('workorder_id', '=', self.id),
            ('date_end', '=', False)
        ])._close()

    def get_workorder_data(self):
        # Avoid to get the products full name because code and name are separate in the barcode app.
        data = super().get_workorder_data() or {}
        if not self.workcenter_id.allow_employee:
            data['employee_id'] = False
            data['employee_ids'] = []
            data['employee_list'] = []
            return data
        employee_domain = [('company_id', '=', self.company_id.id)]
        if self.workcenter_id.employee_ids:
            employee_domain = [('id', 'in', self.workcenter_id.employee_ids.ids)]
        fields_to_read = self.env['hr.employee']._get_employee_fields_for_tablet()
        data.update({
            "employee_id": self.employee_id.id,
            "employee_ids": self.employee_ids.ids,
            "employee_list": self.env['hr.employee'].search_read(employee_domain, fields_to_read, load=False),
        })
        return data

    def record_production(self):
        action = super().record_production()
        if action is not True and self.employee_id:
            action.get('context', {})['employee_id'] = self.employee_id.id
        return action

    def action_back(self):
        self.ensure_one()
        if self.is_user_working and self.working_state != 'blocked' and len(self.employee_ids.ids) == 0:
            self.button_pending()
        domain = [('state', 'not in', ['done', 'cancel', 'pending'])]
        if self.env.context.get('from_production_order'):
            action = self.env["ir.actions.actions"]._for_xml_id("mrp.action_mrp_workorder_production_specific")
            action['domain'] = domain
            action['target'] = 'main'
            action['view_id'] = 'mrp.mrp_production_workorder_tree_editable_view'
            action['context'] = {
                'no_breadcrumbs': True,
            }
            if self.env.context.get('from_manufacturing_order'):
                action['context'].update({
                    'search_default_production_id': self.production_id.id
                })
        else:
            # workorder tablet view action should redirect to the same tablet view with same workcenter when WO mark as done.
            action = self.env["ir.actions.actions"]._for_xml_id("mrp_workorder.mrp_workorder_action_tablet")
            action['domain'] = domain
            action['context'] = {
                'no_breadcrumbs': True,
                'search_default_workcenter_id': self.workcenter_id.id
            }
        if self.employee_id:
            action['context']['employee_id'] = self.employee_id.id
            action['context']['employee_name'] = self.employee_id.name
        if self.employee_ids:
            action['context']['employee_ids'] = self.employee_ids

        return clean_action(action, self.env)

    def _should_start_timer(self):
        """ Return True if the timer should start once the workorder is opened."""
        self.ensure_one()
        if self.workcenter_id.allow_employee:
            return False
        return super()._should_start_timer()

    def _intervals_duration(self, intervals):
        """ Return the duration of the given intervals.
        If intervals overlaps the duration is only counted once.

        The timer could be share between several intervals. However it is not
        an issue since the purpose is to make a difference between employee time and
        blocking time.

        :param list intervals: list of tuple (date_start, date_end, timer)
        """
        if not intervals:
            return 0.0
        duration = 0
        for date_start, date_stop, timer in Intervals(intervals):
            duration += timer.loss_id._convert_to_duration(date_start, date_stop, timer.workcenter_id)
        return duration

    def get_working_duration(self):
        self.ensure_one()
        if self.workcenter_id.allow_employee:
            now = datetime.now()
            return self._intervals_duration([(t.date_start, now, t) for t in self.time_ids if not t.date_end])
        return super().get_working_duration()

    def _cal_cost(self):
        return super()._cal_cost() + sum(self.time_ids.mapped('total_cost'))

    def button_start(self):
        # this override checks if the connected people is allowed to work on this wo
        for wo in self:
            if not wo.workcenter_id.allow_employee or not request:
                return super().button_start()
            if 'employees_connected' not in request.session.keys() or len(request.session['employees_connected']) == 0:
                raise UserError(_("You need to log in to process this work order."))
            if 'session_owner' not in request.session.keys() or not request.session['session_owner']:
                raise UserError(_("There is no session chief. Please log in."))
            if request.session['session_owner'] not in [emp.id for emp in wo.allowed_employees] and not self.all_employees_allowed:
                raise UserError(_("You are not allowed to work on the workorder"))
            if len(wo.allowed_employees) == 0 or request.session['session_owner'] in [emp.id for emp in wo.allowed_employees]:
                self.start_employee(self.env['hr.employee'].browse(request.session['session_owner']).id)
                wo.employee_ids |= self.env['hr.employee'].browse(request.session['session_owner'])
                if self.product_tracking == 'serial':
                    self.qty_producing = 1.0
                elif self.qty_producing == 0:
                    self.qty_producing = self.qty_remaining

    # there is no points keep the employees in working state if they are not working
    def button_pending(self):
        for emp in self.employee_ids:
            self.stop_employee(emp.id)
        super().button_pending()

    def open_tablet_view(self):
        #we need to check if the person is allow to work on the workorder
        self.ensure_one()
        if (not self.is_user_working or self.allow_employee) and self.working_state != 'blocked' and self.state in ('ready', 'waiting', 'progress', 'pending'):
            if self.allow_employee:
                main_employee_connected = None
                if 'session_owner' in request.session.data.keys():
                    main_employee_connected = request.session.data['session_owner']
                if main_employee_connected:
                    self.button_start()
            else:
                self.button_start()
        action = self.env["ir.actions.actions"]._for_xml_id("mrp_workorder.tablet_client_action")
        action['target'] = 'fullscreen'
        action['res_id'] = self.id
        action['context'] = {
            'active_id': self.id,
            'from_production_order': self.env.context.get('from_production_order'),
            'from_manufacturing_order': self.env.context.get('from_manufacturing_order')
        }
        return action

    # TODO : productivity_loss duplicata?
    def action_mark_as_done(self):
        # checking first the main user even if we don't need it.
        # taking here a small amount of time will save us a lot of time when marking many WO as done
        main_employee_connected = None
        if 'session_owner' in request.session.data.keys():
            main_employee_connected = request.session.data['session_owner']

        # we should first check if we can go on before even modifying the workorders
        # start modifying ONLY if all checks are successfull
        for wo in self:
            if wo.allow_employee and not main_employee_connected:
                raise UserError(_('You must be logged in to process some of these work orders.'))
            if wo.allow_employee and len(wo.allowed_employees) != 0 and main_employee_connected not in [wo.id for wo in wo.allowed_employees]:
                raise UserError(_('You are not allow to work on some of these work orders.'))
            if wo.working_state == 'blocked':
                raise UserError(_('Some workorders require another workorder to be completed first'))
        self.button_finish()

        loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'performance')], limit=1)
        if len(loss_id) < 1:
            raise UserError(_("You need to define at least one productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        for wo in self:
            wo.state = 'done'
            if wo.allow_employee:
                if not wo.time_ids:
                    # si pas de timesheet on en crée une avec la valeur théorique
                    # sinon on ne fait rien
                    now = datetime.now()
                    date_start = datetime.fromtimestamp(now.timestamp() - ((wo.duration_expected * 60) // 1))
                    date_end = now
                    val = {
                        'workorder_id': wo.id,
                        'workcenter_id': wo.workcenter_id.id,
                        'description': _('Time Tracking: %(user)s', user=self.env.user.name),
                        'date_start': date_start,
                        'date_end': date_end,
                        'loss_id': loss_id[0].id,
                        'user_id': self.env.user.id,  # FIXME sle: can be inconsistent with company_id
                        'company_id': wo.company_id.id,
                        'employee_id': main_employee_connected
                    }
                    self.env['mrp.workcenter.productivity'].create(val)
                continue
            if wo.duration == 0.0:
                wo.duration = wo.duration_expected
                wo.duration_percent = 100
