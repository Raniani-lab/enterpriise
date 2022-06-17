/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { attr } from "@mail/model/model_field";

/**
 * Models the global state of the VoIP module.
 */
registerModel({
    name: "Voip",
    identifyingFields: ["messaging"],
    fields: {
        /**
         * Either 'demo' or 'prod'. In demo mode, phone calls are simulated in
         * the interface but no RTC sessions are actually established.
         */
        mode: attr(),
    },
});
