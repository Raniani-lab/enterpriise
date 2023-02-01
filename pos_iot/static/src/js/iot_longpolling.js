/** @odoo-module */
/* global posmodel */

import core from "web.core";
import { IoTLongpolling } from "@iot/iot_longpolling";
import { patch } from "@web/core/utils/patch";
import { IoTErrorPopup } from "./IoTErrorPopup";

var _t = core._t;

patch(IoTLongpolling, "pos_iot.IoTLongpolling static", {
    servicesDependencies: ["popup", ...IoTLongpolling.servicesDependencies],
});
patch(IoTLongpolling.prototype, "pos_iot.IotLongpolling", {
    setup({ popup }) {
        this._super(...arguments);
        this.popup = popup;
    },
    _doWarnFail: function (url) {
        this.popup.add(IoTErrorPopup, {
            title: _t("Connection to IoT Box failed"),
            url: url,
        });
        posmodel.env.proxy.proxy_connection_status(url, false);
        const order = posmodel.get_order();
        if (
            order &&
            order.selected_paymentline &&
            order.selected_paymentline.payment_method.use_payment_terminal === "worldline" &&
            ["waiting", "waitingCard", "waitingCancel"].includes(
                order.selected_paymentline.payment_status
            )
        ) {
            order.selected_paymentline.set_payment_status("force_done");
        }
    },

    _onSuccess: function (iot_ip, result) {
        posmodel.env.proxy.proxy_connection_status(iot_ip, true);
        return this._super.apply(this, arguments);
    },
    action: function (iot_ip, device_identifier, data) {
        var res = this._super.apply(this, arguments);
        res.then(function () {
            posmodel.env.proxy.proxy_connection_status(iot_ip, true);
        }).guardedCatch(function () {
            posmodel.env.proxy.proxy_connection_status(iot_ip, false);
        });
        return res;
    },
});
