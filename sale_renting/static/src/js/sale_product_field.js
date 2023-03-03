/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { saleOrderLineProductField, SaleOrderLineProductField } from "@sale/js/sale_product_field";
import { serializeDateTime } from "@web/core/l10n/dates";

const { extractProps } = saleOrderLineProductField;
patch(saleOrderLineProductField, "sale_renting_field", {
    extractProps: (fieldInfo) => ({
        ...extractProps(fieldInfo),
        rent: fieldInfo.options.rent,
    }),
});

patch(SaleOrderLineProductField, "sale_renting_props", {
    props: {
        ...SaleOrderLineProductField.props,
        rent: { type: Boolean, optional: true },
    },
});

patch(SaleOrderLineProductField.prototype, 'sale_renting', {

    async _onProductUpdate() {
        this._super(...arguments);
        if (this.props.record.data.is_product_rentable && this.props.rent) {
            // The rental configurator is only expected to open in Rental App
            //      (rent specified true in the xml field options)
            // Allows selling a product in the sale app while also renting it in the Rental app
            this._openRentalConfigurator(false);
        }
    },

    _editLineConfiguration() {
        this._super(...arguments);
        if (this.props.record.data.is_rental) {
            this._openRentalConfigurator(true);
        }
    },

    get isConfigurableLine() {
        return this._super(...arguments) || !!this.props.record.data.is_rental;
    },

    configurationButtonFAIcon() {
        if (this.props.record.data.is_rental) {
            return 'fa-calendar';
        }
        return this._super(...arguments);
    },

    _defaultRentalData: function (edit) {
        const recordData = this.props.record.data;
        var data = {
            default_quantity: recordData.product_uom_qty,
            default_product_id: recordData.product_id[0],
            default_uom_id: recordData.product_uom[0],
        };
        const saleOrderRecord = this.props.record.model.root;
        if (saleOrderRecord.data.company_id) {
            data.default_company_id = saleOrderRecord.data.company_id[0];
        }
        if (saleOrderRecord.data.currency_id) {
            data.default_currency_id = saleOrderRecord.data.currency_id[0];
        }
        if (saleOrderRecord.data.pricelist_id) {
            data.default_pricelist_id = saleOrderRecord.data.pricelist_id[0];
        }
        if (saleOrderRecord.data.warehouse_id) { // magical sale_stock_renting default
            data.default_warehouse_id = saleOrderRecord.data.warehouse_id[0];
        }
        if (edit) {
            data.default_pickup_date = serializeDateTime(recordData.start_date);
            data.default_return_date = serializeDateTime(recordData.return_date);

            if (recordData.tax_id) {
                // NOTE: this is not a true default, but a data used by business python code
                data.sale_order_line_tax_ids = recordData.tax_id.records.map(record => record.data.id);
            }

            if (recordData.id) {
                // when editing a rental order line, we need its id for some availability computations.
                data.default_rental_order_line_id = recordData.id;
            }

            /** Sale_stock_renting defaults (to avoid having a very little bit of js in sale_stock_renting) */
            if (recordData.reserved_lot_ids) {
                data.default_lot_ids = recordData.reserved_lot_ids.records.map(
                    record => {
                        return [4, record.data.id];
                    }
                );
            }
        } else {
            /** Default pickup/return dates are based on previous lines dates if some exists */
            const saleOrderLines = saleOrderRecord.data.order_line.records.filter(
                line => !line.data.display_type && line.data.is_product_rentable && line.data.is_rental
            );
            let defaultPickupDate, defaultReturnDate;

            if (saleOrderLines.length) {
                saleOrderLines.forEach(function (line) {
                    if (line.data.is_rental) {
                        defaultPickupDate = line.data.start_date;
                        defaultReturnDate = line.data.return_date;
                    }
                });

                if (defaultPickupDate) {
                    data.default_pickup_date = serializeDateTime(defaultPickupDate);
                }
                if (defaultReturnDate) {
                    data.default_return_date = serializeDateTime(defaultReturnDate);
                }
            }
        }

        return data;
    },

    async _openRentalConfigurator(edit) {
        this.action.doAction(
            'sale_renting.rental_configurator_action',
            {
                additionalContext: this._defaultRentalData(edit),
                onClose: async (closeInfo) => {
                    const record = this.props.record;
                    if (closeInfo && !closeInfo.special) {
                        record.update(closeInfo.rentalConfiguration);
                    } else {
                        if (!record.data.start_date || !record.data.return_date) {
                            record.update({
                                product_id: false,
                                name: '',
                            });
                        }
                    }
                }
            }
        );
    },
});
