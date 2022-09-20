/** @odoo-module **/

import { addFields } from "@mail/model/model_core";
import { one } from "@mail/model/model_field";
// ensure that the model definition is loaded before the patch
import "@mail/core_models/messaging";

addFields("Messaging", {
    voip: one("Voip", {
        default: {},
        isCausal: true,
        readonly: true,
        required: true,
    }),
});
