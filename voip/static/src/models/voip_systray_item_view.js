/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { one } from "@mail/model/model_field";

/**
 * Models a button in the systray that is used to toggle the display of the
 * softphone window.
 */
registerModel({
    name: "VoipSystrayItemView",
    recordMethods: {
        onClick() {
            this.messaging.messagingBus.trigger("toggle-softphone-display");
        },
    },
    fields: {
        voip: one("Voip", {
            identifying: true,
            inverse: "systrayItem",
        }),
    },
});
