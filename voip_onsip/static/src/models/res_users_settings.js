/** @odoo-module **/

import { attr, Patch } from "@mail/model";

Patch({
    name: "res.users.settings",
    fields: {
        onsip_auth_username: attr(),
    },
});
