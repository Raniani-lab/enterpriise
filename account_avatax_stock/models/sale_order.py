from odoo import models


class SaleOrder(models.Model):
    _name = 'sale.order'
    _inherit = ['sale.order']

    def _get_avatax_invoice_lines(self):
        # This overrides the previous behaviour to add the warehouse_id in the params sent to _get_avatax_invoice_line
        # in order to have line level addresses.
        return [
            self._get_avatax_invoice_line(
                product=line.product_id,
                price_subtotal=line.price_subtotal,
                quantity=line.product_uom_qty,
                line_id='%s,%s' % (line._name, line.id),
                # Lines with multiple moves are currently not supported.
                warehouse_id=line.move_ids.location_id.warehouse_id if len(line.move_ids) == 1 else None,
            )
            for line in self.order_line.filtered(lambda l: not l.display_type)
        ]
