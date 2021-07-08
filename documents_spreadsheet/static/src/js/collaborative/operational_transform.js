/** @odoo-module alias=documents_spreadsheet.OperationalTransform */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_loader";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
    return [cmd];
}

otRegistry
    .addTransformation("REMOVE_PIVOT_FILTER", ["EDIT_PIVOT_FILTER"], (toTransform, executed) =>
        toTransform.id === executed.id ? undefined : toTransform
    )
    .addTransformation("ADD_PIVOT", ["ADD_PIVOT"], (toTransform) => ({
        ...toTransform,
        id: toTransform.id + 1,
        pivot: { ...toTransform.pivot, id: toTransform.pivot.id + 1 },
    }))
    .addTransformation("ADD_PIVOT", ["ADD_PIVOT_FORMULA"], (toTransform) => ({
        ...toTransform,
        args: [toTransform.args[0] + 1, ...toTransform.args.slice(1)],
    }))
    .addTransformation("ADD_ODOO_LIST", ["ADD_ODOO_LIST_FORMULA"], (toTransform) => ({
        ...toTransform,
        args: [toTransform.args[0] + 1, ...toTransform.args.slice(1)],
    }))
    .addTransformation("ADD_ODOO_LIST", ["ADD_ODOO_LIST"], (toTransform) => ({
        ...toTransform,
        list: { ...toTransform.list, id: toTransform.list.id + 1 },
    }));

inverseCommandRegistry
    .add("ADD_PIVOT_FILTER", (cmd) => {
        return [
            {
                type: "REMOVE_PIVOT_FILTER",
                id: cmd.id,
            },
        ];
    })
    .add("REMOVE_PIVOT_FILTER", (cmd) => {
        return [
            {
                type: "ADD_PIVOT_FILTER",
                id: cmd.id,
                filter: {},
            },
        ];
    })
    .add("ADD_PIVOT", identity)
    .add("ADD_PIVOT_FORMULA", identity)
    .add("ADD_ODOO_LIST", identity)
    .add("ADD_ODOO_LIST_FORMULA", identity);
