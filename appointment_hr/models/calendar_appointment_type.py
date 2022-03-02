# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz

from datetime import timedelta
from odoo import api, fields, models, _, Command
from odoo.exceptions import ValidationError
from odoo.osv.expression import AND


class CalendarAppointmentType(models.Model):
    _name = "calendar.appointment.type"
    _inherit = "calendar.appointment.type"

    @api.model
    def default_get(self, default_fields):
        result = super().default_get(default_fields)

        if result.get('category') == 'work_hours' and result.get('staff_user_ids') == [Command.set(self.env.user.ids)]:
            if not self.env.user.employee_id:
                raise ValueError(_("An employee should be set on the current user to create an appointment type tied to the working schedule."))
        return result

    category = fields.Selection(
        selection_add=[('work_hours', 'Work Hours')],
        help="""Used to define this appointment type's category.
        Can be one of:
            - Website: the default category, the people can access and shedule the appointment with users from the website
            - Custom: the user will create and share to another user a custom appointment type with hand-picked time slots
            - Work Hours: a special type of appointment type that is used by one user and which takes the working hours of this
                user as availabilities. This one uses recurring slot that englobe the entire week to display all possible slots
                based on its working hours and availabilities """)
    work_hours_activated = fields.Boolean('Limit to Work Hours',
        help="When this option is activated the slots computation takes into account the working hours of the users.")

    @api.constrains('category', 'staff_user_ids')
    def _check_staff_user_configuration_work_hours(self):
        for appointment_type in self:
            if appointment_type.category == 'work_hours':
                appointment_domain = [('category', '=', 'work_hours'), ('staff_user_ids', 'in', appointment_type.staff_user_ids.ids)]
                if appointment_type.ids:
                    appointment_domain = AND([appointment_domain, [('id', 'not in', appointment_type.ids)]])
                if self.search_count(appointment_domain) > 0:
                    raise ValidationError(_("Only one work hours appointment type is allowed for a specific employee."))

    def _slot_availability_is_user_available(self, slot, staff_user, availability_values):
        """ This method verifies if the employee is available on the given slot.

        In addition to checks done in ``super()`` it checks whether the slot has
        conflicts with the working schedule of the employee linked to the user
        (if such an employee exists in the current company). An employee will
        not be considered available if the slot is not entirely comprised in its
        working schedule (using a certain tolerance).
        """
        is_available = super()._slot_availability_is_user_available(slot, staff_user, availability_values)
        if not self.work_hours_activated:
            return is_available

        slot_start_dt_utc, slot_end_dt_utc = slot['UTC'][0], slot['UTC'][1]
        if is_available and staff_user.sudo().employee_id:
            # The user is free but he has a configured employee, let's check if the slot fits into his working schedule
            return self._slot_availability_is_user_working(slot_start_dt_utc, slot_end_dt_utc, availability_values['work_schedules'].get(staff_user.id, False))
        else:
            return is_available

    def _slot_availability_is_user_working(self, start_dt, end_dt, intervals):
        """ Check if the slot is contained in the given work hours (defined by
        intervals). Those are linked to a given employee (user with working hours
        activated).

        TDE NOTE: internal method ``is_work_available`` of ``_slots_available``
        made as explicit method in 15.0 but left untouched. To clean in 15.3+.

        :param datetime start_dt: beginning of slot boundary. Not timezoned UTC;
        :param datetime end_dt: end of slot boundary. Not timezoned UTC;
        :param intervals: list of tuples defining working hours boundaries. If no
          intervals are given we consider employee does not work during this slot.
          See ``Resource._work_intervals_batch()`` for more details;

        :return bool: whether employee is available for this slot;
        """
        def find_start_index():
            """ find the highest index of intervals for which the start_date
            (element [0]) is before (or at) start_dt """
            def recursive_find_index(lower_bound, upper_bound):
                if upper_bound - lower_bound <= 1:
                    if intervals[upper_bound][0] <= start_dt:
                        return upper_bound
                    return lower_bound
                index = (upper_bound + lower_bound) // 2
                if intervals[index][0] <= start_dt:
                    return recursive_find_index(index, upper_bound)
                return recursive_find_index(lower_bound, index)

            if start_dt <= intervals[0][0] - tolerance:
                return -1
            if end_dt >= intervals[-1][1] + tolerance:
                return -1
            return recursive_find_index(0, len(intervals) - 1)

        if not intervals:
            return False

        tolerance = timedelta(minutes=1)
        start_index = find_start_index()
        if start_index != -1:
            for index in range(start_index, len(intervals)):
                if intervals[index][1] >= end_dt - tolerance:
                    return True
                if len(intervals) == index + 1 or intervals[index + 1][0] - intervals[index][1] > tolerance:
                    return False
        return False

    @api.model
    def _prepare_availability_additional_values(self, available_staff_users, first_day, last_day):
        """ This method computes the work intervals of available_staff_users between first_day and last_day,
            only if they have a linked employee, using the work hours of the latter. Returns the dictionary
            values, adding a dictionary (user.id, work intervals) with key 'work_schedules'. See parent docstring
            for more explanations about this hook.
        """
        values = super(CalendarAppointmentType, self)._prepare_availability_additional_values(available_staff_users, first_day, last_day)
        work_schedules = {}
        # Compute work schedules for users having employees
        for staff_user in available_staff_users.sudo().filtered('employee_id'):
            staff_user = staff_user.with_context(tz=staff_user.tz)
            staff_user_resource_id = staff_user.employee_id.resource_id
            work_schedules[staff_user.id] = [
                (interval[0].astimezone(pytz.UTC).replace(tzinfo=None),
                    interval[1].astimezone(pytz.UTC).replace(tzinfo=None))
                for interval in staff_user_resource_id.calendar_id.sudo()._work_intervals_batch(
                    first_day, last_day, resources=staff_user_resource_id
                )[staff_user_resource_id.id]
            ]
        values['work_schedules'] = work_schedules
        return values
