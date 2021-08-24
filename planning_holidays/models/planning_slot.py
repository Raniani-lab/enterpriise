# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from datetime import timedelta
from odoo import api, fields, models, _
from odoo.tools.misc import get_lang
from pytz import UTC, timezone, utc


def format_time(env, time):
    return time.strftime(get_lang(env).time_format)


def format_date(env, date):
    return date.strftime(get_lang(env).date_format)


class Slot(models.Model):
    _inherit = 'planning.slot'

    leave_warning = fields.Char(compute='_compute_leave_warning', compute_sudo=True)
    is_absent = fields.Boolean(
        'Employees on Time Off', compute='_compute_leave_warning', search='_search_is_absent',
        compute_sudo=True, readonly=True)

    @api.depends_context('lang')
    @api.depends('start_datetime', 'end_datetime', 'employee_id')
    def _compute_leave_warning(self):
        loc_cache = {}
        def localize(date):
            if date not in loc_cache:
                loc_cache[date] = utc.localize(date).astimezone(timezone(self.env.user.tz or 'UTC')).replace(tzinfo=None)
            return loc_cache.get(date)

        assigned_slots = self.filtered(lambda s: s.employee_id and s.start_datetime)
        (self - assigned_slots).leave_warning = False
        (self - assigned_slots).is_absent = False

        if not assigned_slots:
            return

        slot_min_datetime = min(assigned_slots.mapped('start_datetime'))
        slot_max_datetime = max(assigned_slots.mapped('end_datetime'))

        # Validated hr.leave create a resource.calendar.leaves
        calendar_leaves = self.env['resource.calendar.leaves'].search([
            ('time_type', '=', 'leave'),
            '|', ('company_id', 'in', self.employee_id.company_id.ids),
                 ('company_id', '=', False),
            '|', ('resource_id', 'in', self.employee_id.resource_id.ids),
                 ('resource_id', '=', False),
            ('date_from', '<=', slot_max_datetime),
            ('date_to', '>=', slot_min_datetime),
        ], order='date_from')
        leaves = defaultdict(list)
        for leave in calendar_leaves:
            for employee in self.employee_id:
                if (not leave.company_id or leave.company_id == employee.company_id) and\
                   (not leave.resource_id or leave.resource_id == employee.resource_id) and\
                   (not leave.calendar_id or leave.calendar_id == employee.resource_calendar_id):
                    leaves[employee.id].append(leave)

        for slot in assigned_slots:
            warning = False
            period_leaves = ''
            if leaves.get(slot.employee_id.id):
                single_day_slot = localize(slot.start_datetime).date() == localize(slot.end_datetime).date()
                periods = self._group_leaves(leaves.get(slot.employee_id.id), slot.employee_id, slot.start_datetime, slot.end_datetime)

                for period in periods:
                    dfrom = period['from']
                    dto = period['to']
                    prefix = ''
                    if period != periods[0]:
                        if period == periods[-1]:
                            prefix = _(' and')
                        else:
                            prefix = ','
                    if period.get('show_hours', False):
                        period_leaves += _('%(prefix)s from the %(dfrom_date)s at %(dfrom)s to the %(dto_date)s at %(dto)s',
                                            prefix=prefix,
                                            dfrom_date=format_date(self.env, localize(dfrom)),
                                            dfrom=format_time(self.env, localize(dfrom)),
                                            dto_date=format_date(self.env, localize(dto)),
                                            dto=format_time(self.env, localize(dto)))
                    else:
                        period_leaves += _('%(prefix)s from the %(dfrom)s to the %(dto)s',
                                            prefix=prefix,
                                            dfrom=format_date(self.env, localize(dfrom)),
                                            dto=format_date(self.env, localize(dto)))

                warning = _('%(employee)s is on time off%(period_leaves)s.',
                            employee=slot.employee_id.name, period_leaves=period_leaves)
            slot.leave_warning = warning if period_leaves else False
            slot.is_absent = bool(period_leaves)

    @api.model
    def _search_is_absent(self, operator, value):
        if operator not in ['=', '!='] or not isinstance(value, bool):
            raise NotImplementedError(_('Operation not supported'))

        slots = self.search([('employee_id', '!=', False)])
        if not slots:
            return []

        start_dt = min(slots.mapped('start_datetime'))
        end_dt = max(slots.mapped('end_datetime'))
        leaves = self.env['hr.leave'].search([
            ('employee_id', 'in', slots.mapped('employee_id').ids),
            ('state', '=', 'validate'),
            ('date_from', '<=', end_dt),
            ('date_to', '>=', start_dt)
        ])
        mapped_leaves = defaultdict(lambda: self.env['hr.leave'])
        for leave in leaves:
            mapped_leaves[leave.employee_id] |= leave

        slot_ids = []
        for slot in slots.filtered(lambda s: s.employee_id in mapped_leaves):
            period = self._group_leaves(mapped_leaves[slot.employee_id], slot.employee_id, slot.start_datetime, slot.end_datetime)
            if period:
                slot_ids.append(slot.id)
        if operator == '!=':
            value = not value
        return [('id', 'in' if value else 'not in', slot_ids)]

    @api.model
    def _group_leaves(self, leaves, employee_id, start_datetime, end_datetime):
        """
            Returns all the leaves happening between `start_datetime` and `end_datetime`
        """
        work_times = {wk[0]: wk[1] for wk in employee_id.list_work_time_per_day(start_datetime, end_datetime)}

        def has_working_hours(start_dt, end_dt):
            """
                Returns `True` if there are any working days between `start_dt` and `end_dt`.
            """
            diff_days = (end_dt - start_dt).days
            all_dates = [start_dt.date() + timedelta(days=delta) for delta in range(diff_days + 1)]
            return any(d in work_times for d in all_dates)

        periods = []
        for leave in leaves:
            if leave.date_from > end_datetime or leave.date_to < start_datetime:
                continue

            # Can handle both hr.leave and resource.calendar.leaves
            number_of_days = 0
            if issubclass(type(leave), self.pool['hr.leave']):
                number_of_days = leave.number_of_days
            else:
                dt_delta = (leave.date_to - leave.date_from)
                number_of_days = dt_delta.days + ((dt_delta.seconds / 3600) / 24)

            if not periods or has_working_hours(periods[-1]['from'], leave.date_to):
                periods.append({'from': leave.date_from, 'to': leave.date_to, 'show_hours': number_of_days <= 1})
            else:
                periods[-1]['to'] = leave.date_to
                periods[-1]['show_hours'] = periods[-1].get('show_hours') or number_of_days <= 1
        return periods
