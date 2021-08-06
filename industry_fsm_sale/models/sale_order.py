# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _


class SaleOrder(models.Model):
    _inherit = ['sale.order']

    task_id = fields.Many2one('project.task', string="Task", help="Task from which quotation have been created")

    @api.model_create_multi
    def create(self, vals):
        orders = super().create(vals)
        for sale_order in orders:
            if sale_order.task_id:
                message = _(
                    "Quotation created: %s",
                    "<a href=# data-oe-model=sale.order data-oe-id=%d>%s</a>" % (sale_order.id, sale_order.display_name))
                sale_order.task_id.message_post(body=message)
        return orders


class SaleOrderLine(models.Model):
    _inherit = ['sale.order.line']

    def _update_line_quantity(self, values):
        # YTI TODO: This method should only be used to post
        # a message on qty update, or to raise a ValidationError
        # Should be split in master 
        if self.env.context.get('fsm_no_message_post'):
            return
        super(SaleOrderLine, self)._update_line_quantity(values)

    def _timesheet_create_task_prepare_values(self, project):
        res = super(SaleOrderLine, self)._timesheet_create_task_prepare_values(project)
        if project.is_fsm:
            res.update({'partner_id': self.order_id.partner_shipping_id.id})
        return res

    def _timesheet_create_project_prepare_values(self):
        """Generate project values"""
        values = super(SaleOrderLine, self)._timesheet_create_project_prepare_values()
        if self.product_id.project_template_id.is_fsm:
            values.pop('sale_line_id', False)
        return values
