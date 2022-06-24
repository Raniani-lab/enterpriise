/** @odoo-module **/

import { patchRecordMethods } from "@mail/model/model_core";
import { clear } from "@mail/model/model_field_command";
import "@voip/models/voip"; // ensure the model definition is loaded before the patch

patchRecordMethods("Voip", {
    /**
     * @override
     * @returns {boolean|FieldCommand}
     */
    _computeAreCredentialsSet() {
        if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
            return clear();
        }
        return Boolean(
            this.messaging.currentUser.res_users_settings_id.onsip_auth_username && this._super()
        );
    },
    /**
     * @override
     * @returns {string|FieldCommand}
     */
    _computeAuthorizationUsername() {
        if (!this.messaging.currentUser || !this.messaging.currentUser.res_users_settings_id) {
            return clear();
        }
        return this.messaging.currentUser.res_users_settings_id.onsip_auth_username;
    },
});
