/** @odoo-module */

import { patch } from 'web.utils';
import { RentalConfiguratorController } from "@sale_renting/js/rental_configurator_controller";

/**
 * This model is overridden to allow configuring sale_order_lines through a popup
 * window when a product with 'rent_ok' is selected.
 *
 */
patch(RentalConfiguratorController.prototype, 'sale_stock_renting', {

    _getRentalInfos(record) {
        const rentalInfos = this._super(...arguments);
        rentalInfos.reserved_lot_ids = {
          operation: 'MULTI',
          commands: [
            {operation: 'DELETE_ALL'},
            {operation: 'ADD_M2M', ids: record.data.lot_ids.currentIds.map(
                (lotId) => { return {id: lotId}; }
            )},
          ],
        };
        return rentalInfos;
    },
});
