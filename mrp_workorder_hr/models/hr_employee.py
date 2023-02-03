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
            self._set_session_owner(self.id)
            return True

        # TODO: is this still usefull?
        # elif not pin and self.id not in request.session.get('employees_connected', []):
        #     return True
        return False

    def logout(self, pin=False, unchecked=False):
        employees = self.get_employees_connected()
        if (self.pin_validation(pin) or unchecked) and self.id in employees:
            index = employees.index(self.id)
            if len(employees) > index + 1:
                employees = employees[:index] + employees[index + 1:]
            else:
                employees = employees[:index]
            self._set_employees_connected(employees)
            self._set_session_owner(False)
            return True
        return False

    def _get_employee_fields_for_tablet(self):
        return [
            'id',
            'name',
        ]

    def _connect_employee(self, employee_id=False):
        """
            This function sets the employee that is connecting (or that is already connected)
            as the first element of the array
        """
        if not employee_id:
            employee_id = self.id
        employees = self.get_employees_connected()
        if len(employees) == 0:
            self._set_employees_connected([employee_id])
            return
        if employee_id not in employees:
            self._set_employees_connected([employee_id] + employees)
            return
        # the employee is part of the logged people but not first
        if employees.index(employee_id) != 0:
            # there are no connected people after the employee
            if employees.index(employee_id) == len(employees) - 1:
                self._set_employees_connected([employee_id] + employees[:employees.index(employee_id)])
                return
            self._set_employees_connected([employee_id] + employees[:employees.index(employee_id)] + employees[employees.index(employee_id) + 1:])
            return
        return

    # returns the workorders "in progress" associated to the employees passed in params (where they have already timesheeted)
    def get_employees_wo_by_employees(self, employees):
        workorders = self.env['mrp.workorder'].search([('state', '=', 'progress')])
        for employee in employees:
            employee["workorder"] = []
            for workorder in workorders:
                if employee['id'] in [emp.id for emp in workorder.employee_ids]:
                    time_ids = self.env['mrp.workcenter.productivity'].search([('employee_id', '=', employee['id']), ('workorder_id', '=', workorder.id)])
                    # TODO: better way to do it?
                    sum_time_seconds = 0
                    for time in time_ids:
                        if time.date_end:
                            sum_time_seconds += (time.date_end - time.date_start).total_seconds()
                        else:
                            sum_time_seconds += int((datetime.now() - time.date_start).total_seconds())

                    employee["workorder"].append(
                        {
                            'id': workorder.id,
                            'work_order_name': workorder.production_id.name,
                            'duration': (sum_time_seconds / 60),
                            'operation_name': workorder.operation_id.name,
                            'ongoing': True
                        })
        return employees

    # return the time timesheeted by an employee on a workorder
    def get_wo_time_by_employees_ids(self, wo_id):
        time_ids = self.env['mrp.workcenter.productivity'].search([('employee_id', '=', self.id), ('workorder_id', '=', wo_id)])
        sum_time_seconds = 0
        for time in time_ids:
            if time.date_end:
                sum_time_seconds += (time.date_end - time.date_start).total_seconds()
            else:
                sum_time_seconds += int((datetime.now() - time.date_start).total_seconds())
        return sum_time_seconds / 60

    # This stops all the workorders that the employee is currently working on
    # We could use the stop_employee from mrp_workorder but it implies that me make several calls to the backend:
    # 1) get all the WO
    # 2) stop the employee on these WO
    def stop_all_workorder_from_employee(self):
        work_orders = self.env['mrp.workorder'].search(['&', ('state', '=', 'progress'), ('employee_ids.id', '=', self.id)])
        for wo in work_orders:
            wo.stop_employee(self.id)

    def get_employees_connected(self):
        if EMPLOYEES_CONNECTED in request.session.keys() and request.session[EMPLOYEES_CONNECTED]:
            return request.session[EMPLOYEES_CONNECTED]
        return []

    def _set_employees_connected(self, employees):
        request.session[EMPLOYEES_CONNECTED] = employees

    def get_session_owner(self):
        if SESSION_OWNER in request.session.keys() and request.session[SESSION_OWNER]:
            return request.session[SESSION_OWNER]
        return []

    def _set_session_owner(self, session_owner):
        request.session[SESSION_OWNER] = session_owner
