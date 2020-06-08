odoo.define("documents_spreadsheet.pivot_context_menu", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");

    const _t = core._t;
    const contextMenuRegistry = spreadsheet.registries.contextMenuRegistry;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    contextMenuRegistry.add("pivot_properties", {
        type: "action",
        name: "pivot_properties",
        description: _t("Pivot properties"),
        action(env) {
            env.dispatch("SELECT_PIVOT", { cell: env.getters.getActiveCell() });
            const pivot = env.getters.getSelectedPivot();
            if (pivot) {
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivot });
            }
        },
        isEnabled: () => true,
        isVisible: (type, env) => {
            const cell = env.getters.getActiveCell();
            return type === "CELL" && cell && cell.type === "formula" && cell.content.match(/=\s*PIVOT/);
        }
    });
});
