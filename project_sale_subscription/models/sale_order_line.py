# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    def _compute_product_updatable(self):
        temporal_lines = self.filtered('temporal_type')
        super(SaleOrderLine, self - temporal_lines)._compute_product_updatable()
        temporal_lines.product_updatable = True

    def _timesheet_service_generation(self):
        super(SaleOrderLine, self.filtered(
            lambda sol: sol.order_id._can_generate_service()
        ))._timesheet_service_generation()

    def _timesheet_create_task(self, project):
        task = super()._timesheet_create_task(project)
        order = self.order_id
        # if the product is not recurrent or the project doesn't allow recurring tasks, we don't bother
        if not self.product_id.recurring_invoice or not project.allow_recurring_tasks:
            return task

        # if there is a recurrent task template and the subscription product has an end date,
        # we set this end date on the task recurrence
        start_date = datetime.combine(order.next_invoice_date, datetime.min.time())
        repeat_until = order.end_date and datetime.combine(order.end_date, datetime.min.time())
        repeat_until = repeat_until and repeat_until + relativedelta(day=int(order.recurrence_id.unit == 'month' and start_date.day))

        # if there is no task template, we set a recurrence that mimmics the subscription on the created task
        Recurrence = self.env['project.task.recurrence']
        weekdays = [weekday[0] for weekday in Recurrence._fields['repeat_weekday'].args['selection']]
        months = [month[0] for month in Recurrence._fields['repeat_month'].args['selection']]
        repeat_weekday = weekdays[start_date.weekday()]

        recurrence = Recurrence.create({
            'task_ids': task.ids,
            'repeat_day': str(start_date.day),
            'repeat_interval': order.recurrence_id.duration,
            'repeat_month': months[start_date.month - 1],
            'repeat_number': 1,
            'repeat_on_month': 'date',
            'repeat_on_year': 'date',
            'repeat_type': 'until' if repeat_until else 'forever',
            'repeat_unit': order.recurrence_id.unit,
            'repeat_until': repeat_until,
            'repeat_weekday': repeat_weekday,
            repeat_weekday: True,
        })
        # recurrence.next_recurrence_date = subscription.next_invoice_date + recurrence's interval
        # => both recurrences start a the same time
        # => their next occurences are synchrnized
        recurrence._set_next_recurrence_date(order.next_invoice_date)
        task.write({
            'recurring_task': True,
            'recurrence_id': recurrence.id,
        })
        return task
