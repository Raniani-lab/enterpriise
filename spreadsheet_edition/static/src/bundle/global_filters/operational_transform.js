/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
const { otRegistry } = spreadsheet.registries;

otRegistry.addTransformation(
    "REMOVE_GLOBAL_FILTER",
    ["EDIT_GLOBAL_FILTER"],
    (toTransform, executed) => (toTransform.filter.id === executed.id ? undefined : toTransform)
);
