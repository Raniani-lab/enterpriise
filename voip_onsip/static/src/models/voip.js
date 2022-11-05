/** @odoo-module **/

import { clear, registerPatch } from "@mail/model";

registerPatch({
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
