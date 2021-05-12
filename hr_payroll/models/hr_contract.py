# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, datetime
from collections import defaultdict
from odoo import api, fields, models
from odoo.tools import date_utils
from odoo.osv import expression


class HrContract(models.Model):
    _inherit = 'hr.contract'
    _description = 'Employee Contract'

    schedule_pay = fields.Selection(related='structure_type_id.default_struct_id.schedule_pay', depends=())
    resource_calendar_id = fields.Many2one(required=True, default=lambda self: self.env.company.resource_calendar_id,
        help="Employee's working schedule.")
    hours_per_week = fields.Float(related='resource_calendar_id.hours_per_week')
    full_time_required_hours = fields.Float(related='resource_calendar_id.full_time_required_hours')
    is_fulltime = fields.Boolean(related='resource_calendar_id.is_fulltime')
    wage_type = fields.Selection(related='structure_type_id.wage_type')
    hourly_wage = fields.Monetary('Hourly Wage', default=0, required=True, tracking=True, help="Employee's hourly gross wage.")
    payslips_count = fields.Integer("# Payslips", compute='_compute_payslips_count', groups="hr_payroll.group_hr_payroll_user")

    def _compute_payslips_count(self):
        count_data = self.env['hr.payslip'].read_group(
            [('contract_id', 'in', self.ids)],
            ['contract_id'],
            ['contract_id'])
        mapped_counts = {cd['contract_id'][0]: cd['contract_id_count'] for cd in count_data}
        for contract in self:
            contract.payslips_count = mapped_counts.get(contract.id, 0)

    def action_open_payslips(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("hr_payroll.action_view_hr_payslip_month_form")
        action.update({'domain': [('contract_id', '=', self.id)]})
        return action

    def _index_contracts(self):
        action = self.env["ir.actions.actions"]._for_xml_id("hr_payroll.action_hr_payroll_index")
        action['context'] = repr(self.env.context)
        return action

    def _get_work_hours_domain(self, date_from, date_to, domain=None, inside=True):
        if domain is None:
            domain = []
        domain = expression.AND([domain, [
            ('state', 'in', ['validated', 'draft']),
            ('contract_id', 'in', self.ids),
        ]])
        if inside:
            domain = expression.AND([domain, [
                ('date_start', '>=', date_from),
                ('date_stop', '<=', date_to)]])
        else:
            domain = expression.AND([domain, [
                '|', '|',
                '&', '&',
                    ('date_start', '>=', date_from),
                    ('date_start', '<', date_to),
                    ('date_stop', '>', date_to),
                '&', '&',
                    ('date_start', '<', date_from),
                    ('date_stop', '<=', date_to),
                    ('date_stop', '>', date_from),
                '&',
                    ('date_start', '<', date_from),
                    ('date_stop', '>', date_to)]])
        return domain

    def _get_work_hours(self, date_from, date_to, domain=None):
        """
        Returns the amount (expressed in hours) of work
        for a contract between two dates.
        If called on multiple contracts, sum work amounts of each contract.
        :param date_from: The start date
        :param date_to: The end date
        :returns: a dictionary {work_entry_id: hours_1, work_entry_2: hours_2}
        """

        date_from = datetime.combine(date_from, datetime.min.time())
        date_to = datetime.combine(date_to, datetime.max.time())
        work_data = defaultdict(int)

        # First, found work entry that didn't exceed interval.
        work_entries = self.env['hr.work.entry'].read_group(
            self._get_work_hours_domain(date_from, date_to, domain=domain, inside=True),
            ['hours:sum(duration)'],
            ['work_entry_type_id']
        )
        work_data.update({data['work_entry_type_id'][0] if data['work_entry_type_id'] else False: data['hours'] for data in work_entries})

        # Second, find work entry that exceeds interval and compute right duration.
        work_entries = self.env['hr.work.entry'].search(self._get_work_hours_domain(date_from, date_to, domain=domain, inside=False))

        for work_entry in work_entries:
            date_start = max(date_from, work_entry.date_start)
            date_stop = min(date_to, work_entry.date_stop)
            if work_entry.work_entry_type_id.is_leave:
                contract = work_entry.contract_id
                calendar = contract.resource_calendar_id
                employee = contract.employee_id
                contract_data = employee._get_work_days_data_batch(
                    date_start, date_stop, compute_leaves=False, calendar=calendar
                )[employee.id]

                work_data[work_entry.work_entry_type_id.id] += contract_data.get('hours', 0)
            else:
                dt = date_stop - date_start
                work_data[work_entry.work_entry_type_id.id] += dt.days * 24 + dt.seconds / 3600  # Number of hours
        return work_data

    def _get_default_work_entry_type(self):
        return self.structure_type_id.default_work_entry_type_id or super(HrContract, self)._get_default_work_entry_type()

    def _get_fields_that_recompute_payslip(self):
        # Returns the fields that should recompute the payslip
        return [self._get_contract_wage]

    def write(self, vals):
        if 'state' in vals and vals['state'] == 'cancel':
            self.env['hr.payslip'].search([
                ('contract_id', 'in', self.filtered(lambda c: c.state != 'cancel').ids),
                ('state', 'in', ['draft', 'verify']),
            ]).action_payslip_cancel()
        res = super().write(vals)
        dependendant_fields = self._get_fields_that_recompute_payslip()
        if any(key in dependendant_fields for key in vals.keys()):
            for contract in self:
                contract._recompute_payslips(self.date_start, self.date_end or date.max)
        return res

    def _recompute_work_entries(self, date_from, date_to):
        self.ensure_one()
        super()._recompute_work_entries(date_from, date_to)
        self._recompute_payslips(date_from, date_to)

    def _recompute_payslips(self, date_from, date_to):
        self.ensure_one()
        all_payslips = self.env['hr.payslip'].sudo().search([
            ('contract_id', '=', self.id),
            ('state', 'in', ['draft', 'verify']),
            ('date_from', '<=', date_to),
            ('date_to', '>=', date_from),
            ('company_id', '=', self.env.company.id),
        ]).filtered(lambda p: p.is_regular)
        if all_payslips:
            all_payslips.action_refresh_from_work_entries()
