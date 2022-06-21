/** @odoo-module **/

import { addFields } from "@mail/model/model_core";
import { attr } from "@mail/model/model_field";
import "@mail/models/res_users_settings"; // ensure the model definition is loaded before the patch

addFields("res.users.settings", {
    onsip_auth_username: attr(),
});
