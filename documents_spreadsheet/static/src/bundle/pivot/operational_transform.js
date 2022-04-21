/** @odoo-module */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
  return [cmd];
}

otRegistry
  .addTransformation("INSERT_PIVOT", ["INSERT_PIVOT"], (toTransform) => ({
    ...toTransform,
    id: toTransform.id + 1,
  }));

inverseCommandRegistry
  .add("INSERT_PIVOT", identity)
  .add("RENAME_ODOO_PIVOT", identity)
  .add("RE_INSERT_PIVOT", identity)

