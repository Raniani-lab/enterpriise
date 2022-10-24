/** @odoo-module **/

import { registerPatch } from "@mail/model/model_core";

registerPatch({
    name: "DocumentList",
    fields: {
        viewableDocuments: {
            compute() {
                return this._super().filter(doc => doc.record.data.handler !== "spreadsheet");
            }
        },
    },
});
