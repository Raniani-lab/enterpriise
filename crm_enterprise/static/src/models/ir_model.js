/** @odoo-module **/

import { registerPatch } from "@mail/model";

registerPatch({
    name: "ir.model",
    fields: {
        availableWebViews: {
            compute() {
                if (this.model === "crm.lead") {
                    return [
                        'list',
                        'kanban',
                        'form',
                        'calendar',
                        'pivot',
                        'cohort',
                        'dashboard',
                        'map',
                        'activity',
                    ];
                }
                return this._super();
            },
        },
    },
});
