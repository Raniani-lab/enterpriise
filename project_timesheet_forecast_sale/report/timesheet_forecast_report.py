# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class TimesheetForecastReport(models.Model):
    _inherit = "project.timesheet.forecast.report.analysis"

    sale_line_id = fields.Many2one('sale.order.line', string='Sale Order Line', readonly=True)
    sale_order_id = fields.Many2one('sale.order', string='Sale Order', readonly=True)

    @api.model
    def _select(self):
        return super()._select() + ", SOL.id AS sale_line_id, SOL.order_id AS sale_order_id"

    @api.model
    def _from(self):
        return super()._from() + "LEFT JOIN sale_order_line SOL ON SOL.id = F.order_line_id"

    @api.model
    def _select_union(self):
        return super()._select_union() + ", A.so_line AS sale_line_id, A.order_id AS sale_order_id"

    @api.model
    def _where_union(self):
        return super()._where_union() + "AND A.employee_id = E.id"
