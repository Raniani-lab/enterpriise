/** @odoo-module **/

import { addFields } from "@mail/model/model_core";
import { attr } from "@mail/model/model_field";
import "@mail/models/res_users_settings"; // ensure the model definition is loaded before the patch

addFields("res.users.settings", {
    external_device_number: attr(),
    how_to_call_on_mobile: attr(),
    should_auto_reject_incoming_calls: attr(),
    should_call_from_another_device: attr(),
    voip_secret: attr(),
    voip_username: attr(),
});
