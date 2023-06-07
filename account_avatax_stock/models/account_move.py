from odoo import models


class AccountMove(models.Model):
    _name = 'account.move'
    _inherit = ['account.move']

    def _get_avatax_invoice_lines(self):
        # This overrides the previous behaviour to add the warehouse_id in the params sent to _get_avatax_invoice_line
        # in order to have line level addresses.
        return [
            self._get_avatax_invoice_line(
                product=line.product_id,
                price_subtotal=line.price_subtotal if self.move_type == 'out_invoice' else -line.price_subtotal,
                quantity=line.quantity,
                line_id='%s,%s' % (line._name, line.id),
                # Lines with multiple moves are currently not supported.
                warehouse_id=line.sale_line_ids.move_ids.location_id.warehouse_id if len(line.sale_line_ids.move_ids) == 1 else None,
            )
            for line in self.invoice_line_ids.filtered(lambda l: l.display_type == 'product')
        ]
