/** @odoo-module */

import { RemoteDisplay } from "@point_of_sale/app/customer_display_service";
import { patch } from "@web/core/utils/patch";

patch(RemoteDisplay, "pos_iot.RemoteDisplay static", {
    serviceDependencies: [...RemoteDisplay.serviceDependencies, "iot_longpolling"],
});
patch(RemoteDisplay.prototype, "pos_iot.RemoteDisplay", {
    setup(globalState, { iot_longpolling }) {
        this._super(...arguments);
        this.iotLongpolling = iot_longpolling;
    },
    /**
     * @override replaces the original behaviour completely
     */
    async connect() {
        this.hardwareProxy.deviceProxies.display.action({
            action: "take_control",
            html: await this.globalState.customerDisplayHTML(),
        });
    },
    /**
     * @override replaces the original behaviour completely
     */
    async update() {
        return this.hardwareProxy.deviceProxies?.display?.action({
            action: "customer_facing_display",
            html: await this.globalState.customerDisplayHTML(),
        });
    },
    /**
     * @override replaces the original behaviour completely
     */
    updateStatus() {
        if (!this.hardwareProxy.deviceProxies.display) {
            return;
        }
        this.hardwareProxy.deviceProxies.display.add_listener(({ error, owner }) => {
            if (error) {
                this.status = "not_found";
            } else if (owner === this.iotLongpolling._session_id) {
                this.status = "success";
            } else {
                this.status = "warning";
            }
        });
        setTimeout(() => {
            this.hardwareProxy.deviceProxies.display.action({ action: "get_owner" });
        }, 1500);
    },
});
