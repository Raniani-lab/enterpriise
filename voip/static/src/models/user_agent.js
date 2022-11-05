/** @odoo-module **/

import { attr, one, Model } from "@mail/model";

Model({
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
