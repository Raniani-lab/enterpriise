# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class HrWorkEntryRegenerationWizard(models.TransientModel):
    _name = 'hr.work.entry.regeneration.wizard'
    _description = 'Regenerate Employee Work Entries'

    date_from = fields.Date('From', required=True, default=lambda self: self.env.context.get('date_start'))
    date_to = fields.Date('To', required=True, default=lambda self: self.env.context.get('date_end'))
    employee_id = fields.Many2one('hr.employee', 'Employee',
                                  required=True)
    validated_work_entry_ids = fields.Many2many('hr.work.entry', string='Work Entries Within Interval',
                                   compute='_compute_validated_work_entry_ids')
    search_criteria_completed = fields.Boolean(compute='_compute_search_criteria_completed')
    valid = fields.Boolean(compute='_compute_valid')

    @api.depends('date_from', 'date_to', 'employee_id')
    def _compute_validated_work_entry_ids(self):
        for wizard in self:
            validated_work_entry_ids = self.env['hr.work.entry']
            if wizard.search_criteria_completed:
                search_domain = [('employee_id', '=', self.employee_id.id),
                                 ('date_start', '>=', self.date_from),
                                 ('date_stop', '<=', self.date_to),
                                 ('state', '=', 'validated')]
                validated_work_entry_ids = self.env['hr.work.entry'].search(search_domain, order="date_start")
            wizard.validated_work_entry_ids = validated_work_entry_ids

    @api.depends('validated_work_entry_ids')
    def _compute_valid(self):
        for wizard in self:
            wizard.valid = wizard.search_criteria_completed and len(wizard.validated_work_entry_ids) == 0

    @api.depends('date_from', 'date_to', 'employee_id')
    def _compute_search_criteria_completed(self):
        for wizard in self:
            wizard.search_criteria_completed = self.date_from and self.date_to and self.employee_id

    def regenerate_work_entries(self):
        self.ensure_one()
        work_entries = self.env['hr.work.entry'].search([('employee_id', '=', self.employee_id.id),
                                                         ('date_stop', '>=', self.date_from),
                                                         ('date_start', '<=', self.date_to)])
        work_entries.write({'active': False})
        self.employee_id.generate_work_entries(self.date_from, self.date_to, True)
        action = self.env["ir.actions.actions"]._for_xml_id('hr_work_entry.hr_work_entry_action')
        return action
