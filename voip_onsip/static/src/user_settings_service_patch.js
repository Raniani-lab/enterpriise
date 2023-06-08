/* @odoo-module */

import { UserSettings } from "@mail/core/common/user_settings_service";

import { patch } from "@web/core/utils/patch";

patch(UserSettings.prototype, "OnSIP compatibility", {
    updateFromCommands(settings) {
        this._super(settings);
        if ("onsip_auth_username" in settings) {
            this.onsip_auth_username = settings.onsip_auth_username;
        }
    },
});
