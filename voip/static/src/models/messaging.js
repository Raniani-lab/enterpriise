/** @odoo-module **/

import { addFields } from "@mail/model/model_core";
import { one } from "@mail/model/model_field";
import { insertAndReplace } from "@mail/model/model_field_command";
// ensure that the model definition is loaded before the patch
import "@mail/models/messaging";

addFields("Messaging", {
    voip: one("Voip", {
        default: insertAndReplace(),
        isCausal: true,
        readonly: true,
        required: true,
    }),
});
