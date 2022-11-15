/* @odoo-module */

import { Voip } from "@voip/voip_service";

import { patch } from "@web/core/utils/patch";

patch(Voip.prototype, "OnSIP compatibility", {
    get areCredentialsSet() {
        return Boolean(this.settings.onsip_auth_username) && this._super();
    },
    get authorizationUsername() {
        return this.settings.onsip_auth_username || "";
    },
});
