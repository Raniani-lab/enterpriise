/** @odoo-module **/

import { attr, registerPatch } from "@mail/model";

registerPatch({
    name: "res.users.settings",
    fields: {
        onsip_auth_username: attr(),
    },
});
