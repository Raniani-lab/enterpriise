/** @odoo-module */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
  return [cmd];
}

otRegistry
  .addTransformation("ADD_PIVOT", ["ADD_PIVOT"], (toTransform) => ({
    ...toTransform,
    id: toTransform.id + 1,
    pivot: { ...toTransform.pivot, id: toTransform.pivot.id + 1 },
  }))
  .addTransformation("ADD_PIVOT", ["ADD_PIVOT_FORMULA"], (toTransform) => ({
    ...toTransform,
    args: [toTransform.args[0] + 1, ...toTransform.args.slice(1)],
  }));

inverseCommandRegistry
  .add("ADD_PIVOT", identity)
  .add("ADD_PIVOT_FORMULA", identity);
