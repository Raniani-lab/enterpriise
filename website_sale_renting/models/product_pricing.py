# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _lt, models
from odoo.tools import float_compare

class ProductPricing(models.Model):
    _inherit = 'product.pricing'

    def _get_unit_label(self, duration):
        """ Get the product pricing unit label for website rendering. """
        if duration is None:
            return ""
        if float_compare(duration, 1.0, precision_digits=2) < 1:
            singular_labels = {
                'hour': _lt("Hour"),
                'day': _lt("Day"),
                'week': _lt("Week"),
                'month': _lt("Month"),
                'year': _lt("Year"),
            }
            if self.recurrence_id.unit in singular_labels:
                return singular_labels[self.recurrence_id.unit]
        return dict(self.env['product.pricing']._fields['unit']._description_selection(self.env))[self.recurrence_id.unit]
