/** @odoo-module */

import { ProxyDevice } from "@point_of_sale/js/devices";

ProxyDevice.include({
    update_customer_facing_display: function (html) {
        if (this.env.proxy.iot_device_proxies.display) {
            return this.env.proxy.iot_device_proxies.display.action({
                action: "customer_facing_display",
                html: html,
            });
        }
    },

    take_ownership_over_customer_screen: function (html) {
        return this.env.proxy.iot_device_proxies.display.action({
            action: "take_control",
            html: html,
        });
    },
});
