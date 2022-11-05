/** @odoo-module **/

import { Patch } from "@mail/model";

Patch({
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
