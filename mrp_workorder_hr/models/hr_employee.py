# -*- coding: utf-8 -*-
from odoo import models
from odoo.http import request
from datetime import datetime

EMPLOYEES_CONNECTED = "employees_connected"
SESSION_OWNER = "session_owner"


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    """ Use the session to remember the current employee between views.
        The main purpose is to avoid a hash implementation on client side.

        The sessions have two main attributes :
            - employees_connected : the list of connected employees in the session
            - session_owner : the main employee of the session. Only the session_owner can start/stop a running workorder.
    """

    def pin_validation(self, pin=False):
        if not pin:
            pin = False
        if self.sudo().pin == pin:
            return True
        return False

    def login(self, pin=False, set_in_session=True):
        if self.pin_validation(pin) and set_in_session:
            self._connect_employee()
            request.session[SESSION_OWNER] = self.id
            return True
        return False

    def logout(self, pin=False, unchecked=False):
        employees = request.session.get(EMPLOYEES_CONNECTED, [])
        if (self.pin_validation(pin) or unchecked) and self.id in employees:
            employees.remove(self.id)
            request.session[EMPLOYEES_CONNECTED] = employees
            request.session[SESSION_OWNER] = False
            return True
        return False

    def _get_employee_fields_for_tablet(self):
        return [
            'id',
            'name',
        ]

    def _connect_employee(self):
        """
            This function sets the employee that is connecting (or that is already connected)
            as the first element of the array
        """
        employees = request.session.get(EMPLOYEES_CONNECTED, [])
        if len(employees) == 0:
            request.session[EMPLOYEES_CONNECTED] = [self.id]
            return
        if self.id not in employees:
            request.session[EMPLOYEES_CONNECTED] = [self.id] + employees

    def get_employees_wo_by_employees(self, employees):
        """
            returns the workorders "in progress" associated to the employees passed in params (where they have already timesheeted)
        """
        employees_ids = [emp['id'] for emp in employees]
        workorders = self.env['mrp.workorder'].search([('state', '=', 'progress')])
        time_ids = self.env['mrp.workcenter.productivity']._read_group(['&', ('employee_id', 'in', employees_ids), ('workorder_id', 'in', workorders.ids)],
                                                                       ['duration:sum', 'date_end:array_agg', 'date_start:array_agg'],
                                                                       ['employee_id', 'workorder_id'],
                                                                       lazy=False)

        for emp in employees:
            emp["workorder"] = []
        for time_group in time_ids:
            duration = time_group['duration']
            if any(date is None for date in time_group['date_end']):
                duration = duration + int((datetime.now() - (max(time_group['date_start']))).total_seconds()) / 60

                employee = [emp for emp in employees if emp['id'] == time_group['employee_id'][0]][0]
                employee["workorder"].append(
                    {
                        'id': time_group['workorder_id'][0],
                        'work_order_name': self.env['mrp.workorder'].browse(time_group['workorder_id'][0]).production_id.name,
                        'duration': duration,
                        'operation_name': self.env['mrp.workorder'].browse(time_group['workorder_id'][0]).operation_id.name,
                        'ongoing': True
                    })
        return employees

    def get_wo_time_by_employees_ids(self, wo_id):
        """
            return the time timesheeted by an employee on a workorder
        """
        time_ids = self.env['mrp.workcenter.productivity'].search([('employee_id', '=', self.id), ('workorder_id', '=', wo_id)])
        sum_time_seconds = 0
        for time in time_ids:
            if time.date_end:
                sum_time_seconds += (time.date_end - time.date_start).total_seconds()
            else:
                sum_time_seconds += int((datetime.now() - time.date_start).total_seconds())
        return sum_time_seconds / 60

    def stop_all_workorder_from_employee(self):
        """
            This stops all the workorders that the employee is currently working on
            We could use the stop_employee from mrp_workorder but it implies that me make several calls to the backend:
            1) get all the WO
            2) stop the employee on these WO
        """
        work_orders = self.env['mrp.workorder'].search(['&', ('state', '=', 'progress'), ('employee_ids.id', 'in', self.ids)])
        work_orders.stop_employee(self.ids)

    def get_employees_connected(self):
        return request.session.get(EMPLOYEES_CONNECTED, []) if request else False

    def get_session_owner(self):
        return request.session.get(SESSION_OWNER, []) if request else False
