/* @odoo-module */

import { Record } from "@mail/core/common/record";
import { Activity } from "@mail/core/web/activity_model";

import { patch } from "@web/core/utils/patch";

patch(Activity, {
    /** @override */
    setup() {
        super.setup();
        this.partner = Record.one("Persona");
    },
    /** @override */
    insert(data) {
        const activity = super.insert(...arguments);
        if (Object.hasOwn(data, "partner")) {
            activity.partner = this.store.Persona.insert({
                ...data.partner,
                type: "partner",
            });
        }
        return activity;
    },
});
