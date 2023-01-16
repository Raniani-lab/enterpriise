/** @odoo-module */

import { CustomerFacingDisplayButton } from "@point_of_sale/js/ChromeWidgets/CustomerFacingDisplayButton";
import { patch } from "@web/core/utils/patch";

patch(CustomerFacingDisplayButton.prototype, "pos_iot.CustomerFacingDisplayButton", {
    async onClickProxy() {
        const renderedHtml = await this.env.pos.render_html_for_customer_facing_display();
        this.env.proxy.take_ownership_over_customer_screen(renderedHtml);
    },
    _start() {
        if (this.env.proxy.iot_device_proxies.display) {
            this.env.proxy.iot_device_proxies.display.add_listener(this._checkOwner.bind(this));
            setTimeout(() => {
                this.env.proxy.iot_device_proxies.display.action({ action: "get_owner" });
            }, 1500);
        }
    },
    _checkOwner(data) {
        if (data.error) {
            this.state.status = "not_found";
        } else if (data.owner === this.env.services.iot_longpolling._session_id) {
            this.state.status = "success";
        } else {
            this.state.status = "warning";
        }
    },
});
