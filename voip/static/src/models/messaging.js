/** @odoo-module **/

import { one, registerPatch } from "@mail/model";

registerPatch({
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
