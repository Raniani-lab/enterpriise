/** @odoo-module alias=documents_spreadsheet.OperationalTransform */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
    return [cmd];
}

otRegistry

    .addTransformation("INSERT_ODOO_LIST", ["INSERT_ODOO_LIST"], (toTransform) => ({
        ...toTransform,
        id: (parseInt(toTransform.id, 10) + 1).toString(),
    }))
    .addTransformation("REMOVE_ODOO_LIST", ["RENAME_ODOO_LIST"], (toTransform, executed) => {
      if (toTransform.listId === executed.listId) {
        return undefined;
      }
      return toTransform;
    })
    .addTransformation("REMOVE_ODOO_LIST", ["RE_INSERT_ODOO_LIST"], (toTransform, executed) => {
      if (toTransform.id === executed.listId) {
        return undefined;
      }
      return toTransform;
    });;

inverseCommandRegistry
    .add("INSERT_ODOO_LIST", identity)
    .add("RE_INSERT_ODOO_LIST", identity)
    .add("RENAME_ODOO_LIST", identity)
    .add("REMOVE_ODOO_LIST", identity);
