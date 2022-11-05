/** @odoo-module **/

import { attr, registerPatch } from "@mail/model";

registerPatch({
    name: "Messaging",
    fields: {
        hasDocumentsUserGroup: attr({
            default: false,
        }),
    },
});
