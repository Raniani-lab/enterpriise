# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request, route
from odoo.addons.sale.controllers.catalog import CatalogController

class CatalogControllerFSM(CatalogController):

    @route()
    def sale_product_catalog_get_sale_order_lines_info(self, order_id, product_ids, task_id=None):
        if task_id:
            request.update_context(fsm_task_id=task_id)
        return super().sale_product_catalog_get_sale_order_lines_info(order_id, product_ids)

    @route()
    def sale_product_catalog_update_sale_order_line_info(self, order_id, product_id, quantity, task_id=None):
        """ Update sale order line information on a given sale order for a given product.

        :param int order_id: The sale order, as a `sale.order` id.
        :param int product_id: The product, as a `product.product` id.
        :param int task_id: The task, as a `project.task` id. also available in the context but clearer in argument
        :param float quantity: The quantity selected in the prsoduct catalog.
        :param list context: the context comming from the view, used only to propagate the 'fsm_task_id' for the action_assign_serial on the product.
        :return: The unit price price of the product, based on the pricelist of the sale order and
                 the quantity selected.
        :rtype: A dictionary containing the SN action and the SOL price_unit
        """
        if not task_id:
            return super().sale_product_catalog_update_sale_order_line_info(order_id, product_id, quantity)
        request.update_context(fsm_task_id=task_id)
        task = request.env['project.task'].browse(task_id)
        product = request.env['product.product'].browse(product_id)
        SN_wizard = product.set_fsm_quantity(quantity)
        sol = request.env['sale.order.line'].search([
            ('order_id', '=', task.sale_order_id.id), ('product_id', '=', product_id),
        ])
        return {"action": SN_wizard, "price": sol and sol[0].price_unit}
