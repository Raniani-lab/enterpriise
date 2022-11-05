/** @odoo-module **/

import { attr, one, registerModel } from "@mail/model";

registerModel({
    name: "UserAgent",
    fields: {
        legacyUserAgent: attr(),
        registerer: one("Registerer", {
            inverse: "userAgent",
        }),
        voip: one("Voip", {
            identifying: true,
            inverse: "userAgent",
        }),
        __sipJsUserAgent: attr(),
    },
});
