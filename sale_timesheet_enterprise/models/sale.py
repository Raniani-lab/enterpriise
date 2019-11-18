# -*- coding: utf-8 -*-

from odoo import api, models
from odoo.osv import expression
from odoo.tools import float_is_zero

DEFAULT_INVOICED_TIMESHEET = 'all'


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    @api.depends('analytic_line_ids.validated')
    def _compute_qty_delivered(self):
        super(SaleOrderLine, self)._compute_qty_delivered()

    def _timesheet_compute_delivered_quantity_domain(self):
        domain = super(SaleOrderLine, self)._timesheet_compute_delivered_quantity_domain()
        # force to use only the validated timesheet
        param_invoiced_timesheet = self.env['ir.config_parameter'].sudo().get_param('sale.invoiced_timesheet', DEFAULT_INVOICED_TIMESHEET)
        if param_invoiced_timesheet == 'approved':
            domain = expression.AND([domain, [('validated', '=', True)]])
        return domain

    def _recompute_sale_order_line_timesheet(self):
        """ Recompute the qty_delivered, qty_to_invoice and invoice_status
            when in timesheet configuration, the 'sale.invoiced_timesheet'
            parameter changes.

            First, retrieve the unit_amount of timesheets
            Then, update qty_delivered and qty_to_invoice fields
            Then, update the invoice status
            Finally, check if the writing is necessary or not.
            If yes, we write into the database.
            Otherwise, we do nothing for this sale.order.line instance.
        """
        domain = self._timesheet_compute_delivered_quantity_domain()
        mapping = self.sudo()._get_delivered_quantity_by_analytic(domain)

        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')

        for line in self:
            record = {}
            qty_delivered = mapping.get(line.id, 0.0)

            if line.qty_delivered != qty_delivered:
                record.update(qty_delivered=mapping.get(line.id, 0.0))

            if line.product_id.type == 'service' and line.product_id.invoice_policy == 'delivery' and line.product_id.service_type == 'timesheet':
                if qty_delivered == 0 and line.qty_invoiced > 0:
                    qty_to_invoice = 0
                else:
                    qty_to_invoice = qty_delivered - line.qty_invoiced

                if not float_is_zero(qty_to_invoice, precision_digits=precision):
                    invoice_status = 'to invoice'
                else:
                    invoice_status = 'no'

                if not(line.qty_to_invoice == qty_to_invoice and line.invoice_status == invoice_status):
                    record.update(qty_to_invoice=qty_to_invoice, invoice_status=invoice_status)

            if record:
                line.write(record)
