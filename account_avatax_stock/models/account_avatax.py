from odoo import models


class AccountAvatax(models.AbstractModel):
    _name = 'account.avatax'
    _inherit = 'account.avatax'

    def _get_avatax_line_addresses(self, partner, warehouse_id):
        """Get the line level addresses from the warehouse.

        :param partner (Model<res.partner>): the partner we are shipping to.
        :param warehouse (Model<stock.warehouse>): the warehouse that the product is shipped from.
        :return (dict): the AddressesModel to return to Avatax
        """

        # A 'shipTo' parameter must be added to line level addresses too because when 'addresses' is set at the line
        # level, it no longer inherits any addresses from the root document level which means we must set both the
        # 'shipFrom' and 'shipTo' values for that line.
        # More at: https://developer.avalara.com/avatax/dev-guide/customizing-transaction/address-types/
        res = {
            'shipFrom': self._get_avatax_address_from_partner(warehouse_id.partner_id),
            'shipTo': self._get_avatax_address_from_partner(partner),
        }
        return res

    def _get_avatax_invoice_line(self, product, price_subtotal, quantity, line_id, warehouse_id):
        res = super()._get_avatax_invoice_line(product, price_subtotal, quantity, line_id)

        # If the product is shipped from a different address, add the correct address to the LineItemModel
        if warehouse_id and warehouse_id.partner_id != self.company_id.partner_id:
            res.update({
                'addresses': self._get_avatax_line_addresses(self._get_avatax_ship_to_partner(), warehouse_id),
            })

        return res
