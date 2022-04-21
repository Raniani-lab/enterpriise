/** @odoo-module alias=documents_spreadsheet.OperationalTransform */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
    return [cmd];
}

otRegistry

    .addTransformation("INSERT_ODOO_LIST", ["INSERT_ODOO_LIST"], (toTransform) => ({
        ...toTransform,
        id: toTransform.id + 1,
    }))

inverseCommandRegistry
    .add("INSERT_ODOO_LIST", identity)
    .add("RE_INSERT_ODOO_LIST", identity)
    .add("RENAME_ODOO_LIST", identity);
