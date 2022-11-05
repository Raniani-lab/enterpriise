/** @odoo-module **/

import { Patch } from "@mail/model";

Patch({
    name: "Document",
    fields: {
        isViewable: {
            compute() {
                let result = this._super();
                if (result && this.record) {
                    result = this.record.data.handler !== "spreadsheet";
                }
                return result;
            },
        },
    },
});
