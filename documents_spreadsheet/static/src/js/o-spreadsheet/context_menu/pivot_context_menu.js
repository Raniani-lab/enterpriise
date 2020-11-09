odoo.define("documents_spreadsheet.pivot_context_menu", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const { REINSERT_PIVOT_CHILDREN, INSERT_PIVOT_CELL_CHILDREN } = require("documents_spreadsheet.pivot_actions");

    const _t = core._t;
    const cellMenuRegistry = spreadsheet.registries.cellMenuRegistry;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    cellMenuRegistry
        .add("reinsert_pivot", {
            name: _t("Re-insert pivot"),
            sequence: 122,
            children: REINSERT_PIVOT_CHILDREN,
            isVisible: (env) => env.getters.getPivots().length,
        })
        .add("insert_pivot_cell", {
            name: _t("Insert pivot cell"),
            sequence: 123,
            children: INSERT_PIVOT_CELL_CHILDREN,
            isVisible: (env) => env.getters.getPivots().length,
            separator: true,
        })
        .add("pivot_properties", {
            name: _t("Pivot properties"),
            sequence: 121,
            action(env) {
                const [col,row] = env.getters.getPosition();
                const pivotId = env.getters.getPivotFromPosition(col, row);
                env.dispatch("SELECT_PIVOT", { pivotId });
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { });
            },
            isVisible: (env) => env.getters.getPivots().length,
        });
});
