/** @odoo-module **/

import { attr, Patch } from "@mail/model";

Patch({
    name: "res.users.settings",
    fields: {
        external_device_number: attr(),
        how_to_call_on_mobile: attr(),
        should_auto_reject_incoming_calls: attr(),
        should_call_from_another_device: attr(),
        voip_secret: attr(),
        voip_username: attr(),
    },
});
