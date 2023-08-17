/* @odoo-module */

import { activityService, ActivityService } from "@mail/core/web/activity_service";

import { patch } from "@web/core/utils/patch";

patch(ActivityService.prototype, {
    /** @override */
    _serialize(activity) {
        const data = { ...activity };
        if (Object.hasOwn(data, "partner")) {
            data.partner = { ...data.partner };
            // remove cyclic references
            delete data.partner.Model;
            delete data.partner._store;
        }
        return super._serialize(data);
    },
});

activityService.dependencies.push("mail.persona");
