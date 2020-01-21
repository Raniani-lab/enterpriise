# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Task(models.Model):
    _inherit = "project.task"

    def _reflect_timesheet_quantities(self):
        """ Needed to ensure a correct display of the timesheet quantities and pricing on the report
        """
        if self.sale_line_id.product_uom_qty != self.sale_line_id.qty_delivered:
            self.sale_line_id.write({'product_uom_qty': self.sale_line_id.qty_delivered})
