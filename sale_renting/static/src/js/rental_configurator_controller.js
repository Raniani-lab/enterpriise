/** @odoo-module */
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { formView } from "@web/views/form/form_view";

/**
 * This controller is overridden to allow configuring sale_order_lines through a popup
 * window when a product with 'rent_ok' is selected.
 *
 */
export class RentalConfiguratorController extends formView.Controller {
    setup() {
        super.setup();
        this.action = useService("action");
    }

    _getRentalInfos(record) {
        const { pickup_date, return_date, unit_price, quantity } = record.data;
        return {
            start_date: pickup_date,
            return_date: return_date,
            price_unit: unit_price,
            product_uom_qty: quantity,
            is_rental: true,
        };
    }

    /**
     * We let the regular process take place to allow the validation of the required fields
     * to happen.
     *
     * Then we can manually close the window, providing rental information to the caller.
     *
     * @override
     */
    onRecordSaved(record) {
        return this.action.doAction({
            type: "ir.actions.act_window_close",
            infos: {
                rentalConfiguration: this._getRentalInfos(record),
            },
        });
    }
}

registry.category("views").add("rental_configurator_form", {
    ...formView,
    Controller: RentalConfiguratorController,
});
