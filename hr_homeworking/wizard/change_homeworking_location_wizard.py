# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from odoo import api, fields, models

from ..models.homeworking_schedule import LOCATION_FIELDS


class ChangeHomeworkingLocationWizard(models.TransientModel):
    _name = 'change.homeworking.location.wizard'
    _description = 'Change Work Location Wizard'

    employee_id = fields.Many2one('hr.employee', required=True)
    user_id = fields.Many2one(related="employee_id.user_id")
    date = fields.Date(required=True)
    homeworking_location_id = fields.Many2one('homeworking.location', required=True)
    has_specific_homeworking_policy = fields.Boolean(related='employee_id.has_specific_homeworking_policy')
    is_hr_user = fields.Boolean(compute="_compute_is_hr_user")

    @api.depends_context('uid')
    @api.depends('date')
    def _compute_is_hr_user(self):
        self.is_hr_user = self.env.user.has_group("hr.group_hr_user")

    def change_work_entry_location(self):
        self.ensure_one()
        self.employee_id._create_homeworking_exception(
            self.date,
            self.homeworking_location_id)
        return False

    def change_department_schedule(self):
        self.ensure_one()

        self.employee_id.sudo().has_specific_homeworking_policy = True
        default_location_id = self.env['homeworking.location']._get_default_homeworking_location_id()

        # Get the current department schedule.
        current_department_schedule = self.employee_id.department_id.homeworking_schedule_ids.filtered(
            lambda s: s.date_start <= self.date and (not s.date_end or s.date_end >= self.date))

        if current_department_schedule:
            new_schedule_data = {
                'monday_location_id': current_department_schedule.monday_location_id.id,
                'tuesday_location_id': current_department_schedule.tuesday_location_id.id,
                'wednesday_location_id': current_department_schedule.wednesday_location_id.id,
                'thursday_location_id': current_department_schedule.thursday_location_id.id,
                'friday_location_id': current_department_schedule.friday_location_id.id,
                'saturday_location_id': current_department_schedule.saturday_location_id.id,
                'sunday_location_id': current_department_schedule.sunday_location_id.id,
            }
        else:
            new_schedule_data = {location: default_location_id for location in LOCATION_FIELDS}

        # Update the changed workday
        new_schedule_data[LOCATION_FIELDS[self.date.weekday()]] = self.homeworking_location_id.id

        # Add employee and date information and create the schedule
        new_schedule_data['employee_id'] = self.employee_id.id
        # We set the start_date of the new schedule today, because the employee will also immediately
        # stop following his department schedule.
        new_schedule_data['date_start'] = fields.Date.context_today(self.env.user)
        self.env['homeworking.schedule'].create(new_schedule_data)

        # If a homeworking exception exists on the day this change in schedule starts, this exception is removed.
        self.env['homeworking.exception'].search([
            ('employee_id', '=', self.employee_id.id),
            ('date', '=', self.date)]).unlink()


    def change_employee_schedule_location(self):
        self.ensure_one()

        # In all future schedules (relative to the date being changed) the homeworking location on the given weekday
        # simply needs to be modified.
        # This also applies to the current schedule (the schedule that encompasses the first date to be changed), if the
        # starting date of the current schedule is less than a week before the first date to be changed.
        future_schedules = self.employee_id.homeworking_schedule_ids.filtered(
            lambda s: s.date_start >= self.date - datetime.timedelta(days=6) and (not s.date_end or s.date_end >= self.date)
        )
        if future_schedules:
            # Change the day of week in these schedules
            future_schedules.write({
                LOCATION_FIELDS[self.date.weekday()]: self.homeworking_location_id.id
            })

        # If the schedule containing the given day starts a week or more before the given date, a new schedule needs to
        # be created, starting from the date that is modified. (And the previous schedule's end date needs to be
        # modified correspondingly)
        schedule = self.employee_id.homeworking_schedule_ids.filtered(
            lambda s: s.date_start <= self.date - datetime.timedelta(days=7) and (not s.date_end or s.date_end >= self.date))
        if schedule:
            # Create a new schedule with the same homeworking locations and end date
            new_schedule = {
                'employee_id': schedule.employee_id.id,
                'date_start': self.date,
                'date_end': schedule.date_end,
                'monday_location_id': schedule.monday_location_id.id,
                'tuesday_location_id': schedule.tuesday_location_id.id,
                'wednesday_location_id': schedule.wednesday_location_id.id,
                'thursday_location_id': schedule.thursday_location_id.id,
                'friday_location_id': schedule.friday_location_id.id,
                'saturday_location_id': schedule.saturday_location_id.id,
                'sunday_location_id': schedule.sunday_location_id.id,
                # Overwrite the weekday value of self.date
                LOCATION_FIELDS[self.date.weekday()]: self.homeworking_location_id.id,
            }

            # Before creating the new schedule, modify the end date of the previous schedule.
            schedule.write({'date_end': self.date - datetime.timedelta(days=1)})
            schedule.flush()
            self.env['homeworking.schedule'].create(new_schedule)

        # If no schedule spans the given date, a new one will be created.
        elif not self.employee_id.homeworking_schedule_ids.filtered(
                lambda s: s.date_start <= self.date and (not s.date_end or self.date <= s.date_end)
        ):
            # If a later schedule exists, the new schedule will last until right before that schedule's start date.
            future_schedules = self.employee_id.homeworking_schedule_ids.filtered(
                lambda s: s.date_start >= self.date
            ).sorted(key=lambda s: s.date_start)
            if future_schedules:
                end_date = future_schedules[0].date_start - datetime.timedelta(days=1)
            else:
                end_date = False

            # The homeworking locations of this new schedule will all be unspecified, except for the location on
            # the given weekday.
            default_location_id = self.env['homeworking.location']._get_default_homeworking_location_id()
            self.env['homeworking.schedule'].create({
                'employee_id': self.employee_id.id,
                'date_start': self.date,
                'date_end': end_date,
                'monday_location_id': default_location_id,
                'tuesday_location_id': default_location_id,
                'wednesday_location_id': default_location_id,
                'thursday_location_id': default_location_id,
                'friday_location_id': default_location_id,
                'saturday_location_id': default_location_id,
                'sunday_location_id': default_location_id,
                # Overwrite the weekday value of self.date
                LOCATION_FIELDS[self.date.weekday()]: self.homeworking_location_id.id,
            })

        # If a homeworking exception exists on the day this change in schedule starts, this exception is removed.
        self.env['homeworking.exception'].search([
            ('employee_id', '=', self.employee_id.id),
            ('date', '=', self.date)
        ]).unlink()
