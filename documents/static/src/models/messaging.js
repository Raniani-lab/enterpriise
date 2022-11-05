/** @odoo-module **/

import { attr, Patch } from "@mail/model";

Patch({
    name: "Messaging",
    fields: {
        hasDocumentsUserGroup: attr({
            default: false,
        }),
    },
});
