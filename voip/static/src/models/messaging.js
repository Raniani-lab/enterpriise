/** @odoo-module **/

import { one, Patch } from "@mail/model";

Patch({
    name: "Messaging",
    fields: {
        voip: one("Voip", {
            default: {},
            isCausal: true,
            readonly: true,
            required: true,
        }),
    },
});
