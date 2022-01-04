# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.appointment.tests.common import AppointmentCommon


class AppointmentHrCommon(AppointmentCommon):

    @classmethod
    def setUpClass(cls):
        super(AppointmentHrCommon, cls).setUpClass()

        # Calendars
        cls.resource_calendar_monday = cls.env['resource.calendar'].create({
            'attendance_ids': [
                (0, 0, {'dayofweek': weekday,
                        'day_period': 'morning',
                        'hour_from': hour,
                        'hour_to': hour + 4,
                        'name': 'Day %s H %d %d' % (weekday, hour, hour + 4),
                       })
                for weekday in ['0', '1']
                for hour in [8, 13]
            ],
            'company_id': cls.company_admin.id,
            'name': 'Light Calendars',
        })

        # User resources and employees for work intervals
        cls.staff_resources = cls.env['resource.resource'].create([
            {'calendar_id': cls.resource_calendar_monday.id,
             'company_id': cls.staff_user_bxls.company_id.id,
             'name': cls.staff_user_bxls.name,
             'user_id': cls.staff_user_bxls.id,
             'tz': cls.staff_user_bxls.tz,
            },
            {'calendar_id': cls.resource_calendar_monday.id,
             'company_id': cls.staff_user_aust.company_id.id,
             'name': cls.staff_user_aust.name,
             'user_id': cls.staff_user_aust.id,
             'tz': cls.staff_user_aust.tz,
            }
        ])
        cls.staff_employees = cls.env['hr.employee'].create([
            {'company_id': cls.staff_user_bxls.company_id.id,
             'resource_calendar_id': cls.resource_calendar_monday.id,
             'resource_id': cls.staff_resources[0].id,
            },
            {'company_id': cls.staff_user_aust.company_id.id,
             'resource_calendar_id': cls.resource_calendar_monday.id,
             'resource_id': cls.staff_resources[1].id,
            }
        ])
        cls.staff_resource_bxls, cls.staff_resource_aust = cls.staff_resources[0], cls.staff_resources[1]
        cls.staff_employee_bxls, cls.staff_employee_aust = cls.staff_employees[0], cls.staff_employees[1]
