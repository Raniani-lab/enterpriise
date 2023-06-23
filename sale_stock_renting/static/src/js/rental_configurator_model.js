/** @odoo-module */

import { patch } from '@web/legacy/js/core/utils';
import { RentalConfiguratorController } from "@sale_renting/js/rental_configurator_controller";

/**
 * This model is overridden to allow configuring sale_order_lines through a popup
 * window when a product with 'rent_ok' is selected.
 *
 */
patch(RentalConfiguratorController.prototype, 'sale_stock_renting', {

    _getRentalInfos(record) {
        const rentalInfos = this._super(...arguments);
        rentalInfos.reserved_lot_ids = record.data.lot_ids.currentIds;
        return rentalInfos;
    },
});
