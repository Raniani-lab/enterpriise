# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime

from odoo import api, fields, models, _
from odoo.tools import get_timedelta
from odoo.exceptions import ValidationError


class PlanningRecurrency(models.Model):
    _name = 'planning.recurrency'
    _description = "Planning Recurrence"

    slot_ids = fields.One2many('planning.slot', 'recurrency_id', string="Related planning entries")
    repeat_interval = fields.Integer("Repeat every", default=1, required=True)
    repeat_unit = fields.Selection([
        ('week', 'Week(s)'),
        ('month', 'Month(s)'),
    ], default='week', required=True)
    repeat_until = fields.Datetime(string="Repeat until", help="Up to which date should the plannings be repeated")
    last_generated_end_datetime = fields.Datetime("Last Generated End Date", readonly=True)
    company_id = fields.Many2one('res.company', string="Company", readonly=True, required=True, default=lambda self: self.env.company)

    _sql_constraints = [
        ('check_repeat_interval_positive', 'CHECK(repeat_interval >= 1)', 'Recurrency repeat interval should be at least 1'),
    ]

    @api.constrains('company_id', 'slot_ids')
    def _check_multi_company(self):
        for recurrency in self:
            if not all(recurrency.company_id == planning.company_id for planning in recurrency.slot_ids):
                raise ValidationError(_('An shift must be in the same company as its recurrency.'))

    def name_get(self):
        result = []
        repeat_unit_label_map = dict(self.env['planning.recurrency']._fields['repeat_unit']._description_selection(self.env))
        for recurrency in self:
            translated_label = repeat_unit_label_map[recurrency.repeat_unit]
            result.append([
                recurrency.id,
                _('Every %s %s until %s') % (translated_label, recurrency.repeat_unit, recurrency.repeat_until)])
        return result

    def create_slot(self, initial_start_dt, initial_end_dt, slot_values, repeat_limit_dt=False):
        """
            Repeatedly create slots from an existing recurrency
        """
        value_list = []
        repeat_interval_map = self._get_repeat_delta()
        repeat_end_map = self._get_repeat_ends(initial_start_dt, repeat_limit_dt)
        for recurrency in self:
            # initialize slot creation based on previous slot
            delta = repeat_interval_map[recurrency.id]
            repeat_until = repeat_end_map[recurrency.id]
            act_start, act_end = initial_start_dt, initial_end_dt
            # create slots until we reach repeat_until
            while(act_end < repeat_until):
                new_slot_values = dict(slot_values)
                new_slot_values.update({
                    'start_datetime': act_start,
                    'end_datetime': act_end,
                    'recurrency_id': recurrency.id,
                    'company_id': self.company_id.id,
                })
                value_list.append(new_slot_values)
                act_start, act_end = act_start + delta, act_end + delta
            recurrency.write({'last_generated_end_datetime': act_end - delta})
        return self.env['planning.slot'].create(value_list)

    def _get_repeat_delta(self):
        deltas = {}
        for recurrency in self:
            deltas[recurrency.id] = get_timedelta(recurrency.repeat_interval, recurrency.repeat_unit)
        return deltas

    def _get_repeat_ends(self, initial_start_dt=False, repeat_limit_dt=False):
        repeat_ends = {}
        repeat_limit_dt = repeat_limit_dt or datetime.max
        for recurrency in self:
            company_span = get_timedelta(
                recurrency.company_id.planning_generation_interval,
                recurrency.company_id.planning_generation_uom,
            )
            limit = fields.Datetime.now() + company_span
            recurrency_limit = recurrency.repeat_until or datetime.max
            repeat_ends[recurrency.id] = min(repeat_limit_dt, limit, recurrency_limit)
        return repeat_ends

    def action_remove_after(self, when):
        for recurrency in self:
            forecasts = self.env['planning.slot'].search(['&', ('recurrency_id', '=', recurrency.id), ('start_datetime', '>=', when)])
            forecasts.unlink()
            if len(recurrency.slot_ids) == 0:
                recurrency.unlink()
            else:
                recurrency.write({'repeat_until': when})

    def action_remove_all(self):
        for recurrency in self:
            recurrency.slot_ids.unlink()
            recurrency.unlink()

    @api.model
    def _cron_schedule_next(self):
        Recurrency = self.env['planning.recurrency']
        PlanningSlot = self.env['planning.slot']

        companies = self.env['res.company'].search([])
        for company in companies:
            planning_generation_interval = company.planning_generation_interval
            planning_generation_uom = company.planning_generation_uom
            delta = get_timedelta(planning_generation_interval, planning_generation_uom)

            recurrencies = Recurrency.search([
                '&',
                '&',
                ('company_id', '=', company.id),
                ('last_generated_end_datetime', '<', fields.Datetime.now() + delta),
                '|',
                ('repeat_until', '=', False),
                ('repeat_until', '>', fields.Datetime.now() - delta),
            ])
            repeat_interval_map = recurrencies._get_repeat_delta()
            repeat_end_map = recurrencies._get_repeat_ends()
            for recurrency in recurrencies:
                last_slot = recurrency.slot_ids.sorted(key=lambda x: x.end_datetime)
                if last_slot:
                    last_slot = last_slot[-1]
                    repeat_interval = repeat_interval_map.get(recurrency.id)
                    act_start = last_slot.start_datetime + repeat_interval
                    act_end = last_slot.end_datetime + repeat_interval
                    values = []
                    while(act_end < repeat_end_map.get(recurrency.id)):
                        new_values = last_slot.copy_data()[0]
                        new_values.update({
                            'start_datetime': act_start,
                            'end_datetime': act_end,
                            'recurrency_id': recurrency.id,
                            'company_id': recurrency.company_id.id,
                        })
                        values.append(new_values)
                        act_start, act_end = act_start + repeat_interval, act_end + repeat_interval

                    PlanningSlot.create(values)
                    recurrency.write({'last_generated_end_datetime': act_end - repeat_interval})
                else:
                    recurrency.unlink()
