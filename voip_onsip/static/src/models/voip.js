/** @odoo-module **/

import { patchFields } from "@mail/model/model_core";
import { clear } from "@mail/model/model_field_command";
import "@voip/models/voip"; // ensure the model definition is loaded before the patch

patchFields("Voip", {
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
});
