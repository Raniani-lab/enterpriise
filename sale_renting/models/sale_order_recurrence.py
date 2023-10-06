# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _lt, fields, models
from odoo.tools import float_compare, float_is_zero


class SaleOrderRecurrence(models.Model):
    _name = 'sale.temporal.recurrence'
    _description = "Sale temporal Recurrence"
    _order = 'unit,duration'

    active = fields.Boolean(default=True)
    name = fields.Char(translate=True, required=True, default="Monthly")
    duration = fields.Integer(string="Duration", required=True, default=1,
                              help="Minimum duration before this rule is applied. If set to 0, it represents a fixed temporal price.")
    unit = fields.Selection([('hour', 'Hours'), ('day', 'Days'), ("week", "Weeks"), ("month", "Months"), ('year', 'Years')],
        string="Unit", required=True, default='month')
    duration_display = fields.Char(compute='_compute_duration_display')

    _sql_constraints = [
        ('temporal_recurrence_duration', "CHECK(duration >= 0)", "The pricing duration has to be greater or equal to 0."),
    ]

    def _compute_duration_display(self):
        for record in self:
            record.duration_display = "%s %s" % (
                record.duration, record._get_unit_label(record.duration)
            )

    def _get_unit_label(self, duration):
        """ Get the translated product pricing unit label. """
        if duration is None:
            return ""
        self.ensure_one()
        if float_compare(duration, 1.0, precision_digits=2) < 1\
           and not float_is_zero(duration, precision_digits=2):
            singular_labels = {
                'hour': _lt("Hour"),
                'day': _lt("Day"),
                'week': _lt("Week"),
                'month': _lt("Month"),
                'year': _lt("Year"),
            }
            if self.unit in singular_labels:
                return str(singular_labels[self.unit])
        return dict(
            self._fields['unit']._description_selection(self.env)
        )[self.unit]
