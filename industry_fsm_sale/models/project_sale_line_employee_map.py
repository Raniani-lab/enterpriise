# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ProjectProductEmployeeMap(models.Model):
    _inherit = 'project.sale.line.employee.map'

    timesheet_product_id = fields.Many2one(
        'product.product', string='Service',
        domain="""[
            ('type', '=', 'service'),
            ('invoice_policy', '=', 'delivery'),
            ('service_type', '=', 'timesheet'),
            '|', ('company_id', '=', False), ('company_id', '=', company_id)]""")
    sale_line_id = fields.Many2one(required=False)
    price_unit = fields.Float(readonly=False)

    @api.depends('sale_line_id', 'sale_line_id.price_unit', 'timesheet_product_id')
    def _compute_price_unit(self):
        mappings_with_product_and_no_sol = self.filtered(lambda mapping: not mapping.sale_line_id and mapping.timesheet_product_id)
        for line in mappings_with_product_and_no_sol:
            line.price_unit = line.timesheet_product_id.lst_price
            line.currency_id = line.timesheet_product_id.currency_id
        super(ProjectProductEmployeeMap, self - mappings_with_product_and_no_sol)._compute_price_unit()

    @api.model
    def create(self, vals):
        res = super().create(vals)
        if res.project_id.is_fsm and res.project_id.pricing_type == 'task_rate':
            res.project_id.write({'pricing_type': 'employee_rate'})
        return res
