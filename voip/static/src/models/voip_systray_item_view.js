/** @odoo-module **/

import { one, registerModel } from "@mail/model";

/**
 * Models a button in the systray that is used to toggle the display of the
 * softphone window.
 */
registerModel({
    name: "VoipSystrayItemView",
    template: "voip.SystrayItemView",
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
