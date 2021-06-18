/** @odoo-module **/

import { registry } from "@web/core/registry";

export const enterpriseService = {
    name: "enterprise",
    dependencies: [],
    start() {
        const { session_info } = odoo;

        return {
            expirationDate: session_info.expiration_date,
            expirationReason: session_info.expiration_reason,
            // Hack: we need to know if there is at least an app installed (except from App and
            // Settings). We use mail to do that, as it is a dependency of almost every addon. To
            // determine whether mail is installed or not, we check for the presence of the key
            // "notification_type" in session_info, as it is added in mail for internal users.
            isMailInstalled: "notification_type" in session_info,
            warning: session_info.warning,
        };
    },
};

registry.category("services").add("enterprise", enterpriseService);
