/** @odoo-module */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
  return [cmd];
}

otRegistry
  .addTransformation("INSERT_PIVOT", ["INSERT_PIVOT"], (toTransform) => ({
    ...toTransform,
    id: (parseInt(toTransform.id, 10) + 1).toString(),
  }))
  .addTransformation("REMOVE_PIVOT", ["RENAME_ODOO_PIVOT"], (toTransform, executed) => {
    if (toTransform.pivotId === executed.pivotId) {
      return undefined;
    }
    return toTransform;
  })
  .addTransformation("REMOVE_PIVOT", ["RE_INSERT_PIVOT"], (toTransform, executed) => {
    if (toTransform.id === executed.pivotId) {
      return undefined;
    }
    return toTransform;
  });

inverseCommandRegistry
  .add("INSERT_PIVOT", identity)
  .add("RENAME_ODOO_PIVOT", identity)
  .add("REMOVE_PIVOT", identity)
  .add("RE_INSERT_PIVOT", identity)

