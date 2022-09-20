/** @odoo-module **/

import { addFields } from "@mail/model/model_core";
import { attr } from "@mail/model/model_field";
import "@mail/core_models/messaging"; // ensure the model definition is loaded before the patch

addFields("Messaging", {
    hasDocumentsUserGroup: attr({
        default: false,
    })
});
