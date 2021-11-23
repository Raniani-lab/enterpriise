/** @odoo-module alias=documents_spreadsheet.OperationalTransform */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
    return [cmd];
}

otRegistry

    .addTransformation("ADD_ODOO_LIST", ["ADD_ODOO_LIST_FORMULA"], (toTransform) => ({
        ...toTransform,
        args: [toTransform.args[0] + 1, ...toTransform.args.slice(1)],
    }))
    .addTransformation("ADD_ODOO_LIST", ["ADD_ODOO_LIST"], (toTransform) => ({
        ...toTransform,
        list: { ...toTransform.list, id: toTransform.list.id + 1 },
    }));

inverseCommandRegistry
    .add("ADD_ODOO_LIST", identity)
    .add("ADD_ODOO_LIST_FORMULA", identity);
