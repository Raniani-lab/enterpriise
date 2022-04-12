/** @odoo-module */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { inverseCommandRegistry, otRegistry } = spreadsheet.registries;

function identity(cmd) {
  return [cmd];
}

otRegistry.addTransformation(
  "REMOVE_GLOBAL_FILTER",
  ["EDIT_GLOBAL_FILTER"],
  (toTransform, executed) =>
    toTransform.id === executed.id ? undefined : toTransform
);

inverseCommandRegistry
  .add("EDIT_GLOBAL_FILTER", identity)
  .add("ADD_GLOBAL_FILTER", (cmd) => {
    return [
      {
        type: "REMOVE_GLOBAL_FILTER",
        id: cmd.id,
      },
    ];
  })
  .add("REMOVE_GLOBAL_FILTER", (cmd) => {
    return [
      {
        type: "ADD_GLOBAL_FILTER",
        id: cmd.id,
        filter: {},
      },
    ];
  });
