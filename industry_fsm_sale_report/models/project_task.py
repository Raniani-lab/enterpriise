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

    def action_fsm_worksheet(self):
        # Note: as we want to see all time and material on worksheet, ensure the SO is created (case: timesheet but no material, the
        # time should be sold on SO)
        if self.allow_billable:
            if self.allow_timesheets or self.allow_material:  # if material or time spent on task
                self._fsm_ensure_sale_order()

        return super().action_fsm_worksheet()

    def action_preview_worksheet(self):
        self.ensure_one()

        # Note: as we want to see all time and material on worksheet, ensure the SO is created when (case: timesheet but no material, the time should be sold on SO)
        if self.allow_billable:
            if self.allow_timesheets or self.allow_material:
                self.sudo()._reflect_timesheet_quantities()
                self._fsm_ensure_sale_order()

        return super().action_preview_worksheet()

    def action_send_report(self):
        self.ensure_one()
        # Note: as we want to see all time and material on worksheet, ensure the SO is created (case: timesheet but no material, the
        # time should be sold on SO)
        if self.allow_billable:
            self._fsm_ensure_sale_order()

        return super().action_send_report()
