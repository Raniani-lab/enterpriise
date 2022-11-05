/** @odoo-module **/

import { clear, Patch } from "@mail/model";

Patch({
    name: "Voip",
    fields: {
        areCredentialsSet: {
            compute() {
                if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
                    return clear();
                }
                return Boolean(this.messaging.currentUser.res_users_settings_id.onsip_auth_username) && this._super();
            },
        },
        authorizationUsername: {
            compute() {
                if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
                    return clear();
                }
                return this.messaging.currentUser.res_users_settings_id.onsip_auth_username;
            },
        },
    },
});
