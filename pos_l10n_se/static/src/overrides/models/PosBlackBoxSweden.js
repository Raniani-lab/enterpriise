/** @odoo-module */
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { Order, Orderline } from "@point_of_sale/app/store/models";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { deserializeDateTime } from "@web/core/l10n/dates";

patch(PosStore.prototype, {
    useBlackBoxSweden() {
        return !!this.config.iface_sweden_fiscal_data_module;
    },
    cashierHasPriceControlRights() {
        if (this.useBlackBoxSweden()) {
            return false;
        }
        return super.cashierHasPriceControlRights(...arguments);
    },
    disallowLineQuantityChange() {
        const result = super.disallowLineQuantityChange(...arguments);
        return this.useBlackBoxSweden() || result;
    },
    async push_single_order(order) {
        if (this.useBlackBoxSweden() && order) {
            if (!order.receipt_type) {
                order.receipt_type = "normal";
                order.sequence_number = await this.get_order_sequence_number();
            }
            try {
                order.blackbox_tax_category_a = order.get_specific_tax(25);
                order.blackbox_tax_category_b = order.get_specific_tax(12);
                order.blackbox_tax_category_c = order.get_specific_tax(6);
                order.blackbox_tax_category_d = order.get_specific_tax(0);
                var data = await this.push_order_to_blackbox(order);
                this.set_data_for_push_order_from_blackbox(order, data);
                return super.push_single_order(...arguments);
            } catch (err) {
                order.finalized = false;
                return Promise.reject({
                    code: 700,
                    message: "Blackbox Error",
                    data: { order: order, error: err },
                });
            }
        } else {
            return super.push_single_order(...arguments);
        }
    },
    async push_order_to_blackbox(order) {
        const fdm = this.hardwareProxy.deviceControllers.fiscal_data_module;
        const data = {
            date: deserializeDateTime(order.date_order).toFormat("yyyyMMddHHmm"),
            receipt_id: order.sequence_number.toString(),
            pos_id: order.pos.config.id.toString(),
            organisation_number: this.company.company_registry.replace(/\D/g, ""),
            receipt_total: order.get_total_with_tax().toFixed(2).toString().replace(".", ","),
            negative_total:
                order.get_total_with_tax() < 0
                    ? Math.abs(order.get_total_with_tax()).toFixed(2).toString().replace(".", ",")
                    : "0,00",
            receipt_type: order.receipt_type,
            vat1: order.blackbox_tax_category_a
                ? "25,00;" + order.blackbox_tax_category_a.toFixed(2).replace(".", ",")
                : " ",
            vat2: order.blackbox_tax_category_b
                ? "12,00;" + order.blackbox_tax_category_b.toFixed(2).replace(".", ",")
                : " ",
            vat3: order.blackbox_tax_category_c
                ? "6,00;" + order.blackbox_tax_category_c.toFixed(2).replace(".", ",")
                : " ",
            vat4: order.blackbox_tax_category_d
                ? "0,00;" + order.blackbox_tax_category_d.toFixed(2).replace(".", ",")
                : " ",
        };
        return new Promise((resolve, reject) => {
            fdm.addListener((data) => (data.status === "ok" ? resolve(data) : reject(data)));
            fdm.action({
                action: "registerReceipt",
                high_level_message: data,
            }).then((action_result) => {
                if (action_result.result === false) {
                    this.env.services.popup(ErrorPopup, {
                        title: _t("Fiscal Data Module error"),
                        body: _t("The fiscal data module is disconnected."),
                    });
                }
            });
        });
    },
    set_data_for_push_order_from_blackbox(order, data) {
        order.blackbox_signature = data.signature_control;
        order.blackbox_unit_id = data.unit_id;
    },
    async get_order_sequence_number() {
        return await this.env.services.orm.call("pos.config", "get_order_sequence_number", [
            this.config.id,
        ]);
    },
    async get_profo_order_sequence_number() {
        return await this.env.services.orm.call("pos.config", "get_profo_order_sequence_number", [
            this.config.id,
        ]);
    },
});

patch(Order.prototype, {
    get_specific_tax(amount) {
        var tax = this.get_tax_details().find((tax) => tax.tax.amount === amount);
        if (tax) {
            return tax.amount;
        }
        return false;
    },
    async add_product(product, options) {
        if (this.pos.useBlackBoxSweden() && product.taxes_id.length === 0) {
            await this.env.services.popup(ErrorPopup, {
                title: _t("POS error"),
                body: _t("Product has no tax associated with it."),
            });
        } else if (
            this.pos.useBlackBoxSweden() &&
            !this.pos.taxes_by_id[product.taxes_id[0]].identification_letter
        ) {
            await this.env.services.popup(ErrorPopup, {
                title: _t("POS error"),
                body: _t(
                    "Product has an invalid tax amount. Only 25%, 12%, 6% and 0% are allowed."
                ),
            });
        } else if (this.pos.useBlackBoxSweden() && this.pos.get_order().is_refund) {
            await this.env.services.popup(ErrorPopup, {
                title: _t("POS error"),
                body: _t("Cannot modify a refund order."),
            });
        } else if (this.pos.useBlackBoxSweden() && this.hasNegativeAndPositiveProducts(product)) {
            await this.env.services.popup(ErrorPopup, {
                title: _t("POS error"),
                body: _t("You can only make positive or negative order. You cannot mix both."),
            });
        } else {
            return super.add_product(...arguments);
        }
        return false;
    },
    wait_for_push_order() {
        var result = super.wait_for_push_order(...arguments);
        result = Boolean(this.pos.useBlackBoxSweden() || result);
        return result;
    },
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        this.is_refund = json.is_refund || false;
    },
    export_as_JSON() {
        var json = super.export_as_JSON(...arguments);

        var to_return = Object.assign(json, {
            receipt_type: this.receipt_type,
            blackbox_unit_id: this.blackbox_unit_id,
            blackbox_signature: this.blackbox_signature,
            blackbox_tax_category_a: this.blackbox_tax_category_a,
            blackbox_tax_category_b: this.blackbox_tax_category_b,
            blackbox_tax_category_c: this.blackbox_tax_category_c,
            blackbox_tax_category_d: this.blackbox_tax_category_d,
            is_refund: this.is_refund,
        });
        return to_return;
    },
    hasNegativeAndPositiveProducts(product) {
        var isPositive = product.lst_price >= 0;
        for (const id in this.get_orderlines()) {
            const line = this.get_orderlines()[id];
            if (
                (line.product.lst_price >= 0 && !isPositive) ||
                (line.product.lst_price < 0 && isPositive)
            ) {
                return true;
            }
        }
        return false;
    },
});

patch(Orderline.prototype, {
    export_for_printing() {
        var json = super.export_for_printing(...arguments);

        var to_return = Object.assign(json, {
            product_type: this.get_product().type,
        });
        return to_return;
    },
});
