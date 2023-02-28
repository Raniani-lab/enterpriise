# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

HR_PAYROLL_WRITABLE_FIELDS = [
    'is_non_resident',
]

class ResUsers(models.Model):
    _inherit = "res.users"

    is_non_resident = fields.Boolean(related='employee_ids.is_non_resident', readonly=False)

    def _get_personal_info_partner_ids_to_notify(self, employee):
        if employee.contract_id.hr_responsible_id:
            return (
                _("You are receiving this message because you are the HR Responsible of this employee."),
                employee.contract_id.hr_responsible_id.partner_id.ids,
            )
        return ('', [])

    @api.model_create_multi
    def create(self, vals_list):
        users = super().create(vals_list)
        if any([user.has_group('hr_payroll.group_hr_payroll_user') for user in users]):
            dashboard_note_tag = self.env.ref('hr_payroll.payroll_note_tag', raise_if_not_found=False)
            if dashboard_note_tag:
                notes_with_dashboard_tags = self.env['note.note'].search([
                    ('tag_ids', 'in', [dashboard_note_tag.id])
                ])
                notes_with_dashboard_tags.note_subscribe_payroll_users()
        return users

    def write(self, vals):
        payroll_group = self.env.ref('hr_payroll.group_hr_payroll_user')
        # portal users don't have access to this group
        if payroll_group and payroll_group.check_access_rule('read'):
            old_payroll_users = payroll_group.users
            users = super().write(vals)
            new_payroll_users = payroll_group.users
            added_users = new_payroll_users - old_payroll_users

            dashboard_note_tag = self.env.ref('hr_payroll.payroll_note_tag', raise_if_not_found=False)
            if added_users and dashboard_note_tag:
                notes_with_dashboard_tags = self.env['note.note'].search([
                    ('tag_ids', 'in', [dashboard_note_tag.id])
                ])
                notes_with_dashboard_tags.note_subscribe_payroll_users()
            return users
        return super().write(vals)

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + HR_PAYROLL_WRITABLE_FIELDS

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + HR_PAYROLL_WRITABLE_FIELDS
