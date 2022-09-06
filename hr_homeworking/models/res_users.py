# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ResUsers(models.Model):
    _inherit = 'res.users'

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + [
            'has_active_department_schedules',
            'has_specific_homeworking_policy',
            'homeworking_department_schedule_ids',
            'homeworking_schedule_ids',
            'homeworking_exception_ids',
        ]

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + [
            'homeworking_schedule_ids',
            'homeworking_exceptions_ids',
            'has_specific_homeworking_policy'
        ]

    has_active_department_schedules = fields.Boolean(
        related='employee_id.has_active_department_schedules', related_sudo=False)
    has_specific_homeworking_policy = fields.Boolean(
        related='employee_id.has_specific_homeworking_policy', related_sudo=False)
    homeworking_department_schedule_ids = fields.One2many(
        comodel_name='homeworking.schedule',
        string='Department Schedules',
        related='employee_id.homeworking_department_schedule_ids',
        related_sudo=False)
    homeworking_schedule_ids = fields.One2many(
        comodel_name='homeworking.schedule',
        string='Personal Schedules',
        related='employee_id.homeworking_schedule_ids',
        related_sudo=False,
        readonly=False)
    homeworking_exception_ids = fields.One2many(
        comodel_name='homeworking.exception',
        string='Homeworking Exceptions',
        related='employee_id.homeworking_exception_ids',
        related_sudo=False,
        readonly=False)

    def action_change_to_employee_schedule(self):
        self.employee_id.action_change_to_employee_schedule()

    def action_change_to_department_schedule(self):
        self.employee_id.action_change_to_department_schedule()
