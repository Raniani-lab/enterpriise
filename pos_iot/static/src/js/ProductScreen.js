/** @odoo-module */

import { ProductScreen } from "@point_of_sale/js/Screens/ProductScreen/ProductScreen";
import { patch } from "@web/core/utils/patch";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";

patch(ProductScreen.prototype, "pos_iot.ProductScreen", {
    get isScaleAvailable() {
        return this._super(...arguments) && Boolean(this.env.proxy.iot_device_proxies.scale);
    },
    async _onScaleNotAvailable() {
        await this.popup.add(ErrorPopup, {
            title: this._env._t("No Scale Detected"),
            body: this._env._t(
                "It seems that no scale was detected.\nMake sure that the scale is connected and visible in the IoT app."
            ),
        });
    },
});
