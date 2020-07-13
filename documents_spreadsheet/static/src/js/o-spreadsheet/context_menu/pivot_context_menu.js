odoo.define("documents_spreadsheet.pivot_context_menu", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const { fetchCache, formatGroupBy, formatHeader } = require("documents_spreadsheet.pivot_utils");

    const _t = core._t;
    const cellMenuRegistry = spreadsheet.registries.cellMenuRegistry;
    const createFullMenuItem = spreadsheet.helpers.createFullMenuItem;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    cellMenuRegistry
        .add("reinsert_pivot", {
            name: _t("Re-insert pivot"),
            sequence: 102,
            children: (env) => Object.values(env.getters.getPivots())
                .map((pivot, index) => (createFullMenuItem(`reinsert_pivot_${pivot.id}`, {
                    name: `${pivot.cache && pivot.cache.modelLabel || pivot.model} (#${pivot.id})`,
                    sequence: index,
                    action: async (env) => {
                        pivot.lastUpdate = undefined;
                        await fetchCache(pivot, env.services.rpc);
                        const zone = env.getters.getSelectedZone();
                        env.dispatch("REBUILD_PIVOT", {
                            id: pivot.id,
                            anchor: [zone.left, zone.top],
                        });
                    }
                })),
            ),
            isVisible: (env) => env.getters.getPivots().length,
        })
        .add("insert_pivot_section", {
            name: _t("Insert pivot section"),
            sequence: 103,
            children: (env) => Object.values(env.getters.getPivots())
                .map((pivot, index) => (createFullMenuItem(`insert_pivot_section_${pivot.id}`, {
                    name: `${pivot.cache && pivot.cache.modelLabel || pivot.model} (#${pivot.id})`,
                    sequence: index,
                    children: () => [pivot.colGroupBys[0], pivot.rowGroupBys[0]].filter(x => x !== undefined)
                        .map((field, index) => (createFullMenuItem(`insert_pivot_section_${pivot.id}_${field}`, {
                            name: `${formatGroupBy(pivot, field)}`,
                            sequence: index,
                            children: () => pivot.cache.getFieldValues(field)
                                .map((value, index) => (createFullMenuItem(`insert_pivot_section_${pivot.id}_${field}_${value}`, {
                                    name: `${formatHeader(pivot, field, value)}`,
                                    sequence: index,
                                    action: (env) => {
                                        const [col, row] = env.getters.getPosition();
                                        env.dispatch("INSERT_HEADER", { id: pivot.id, col, row, field, value });
                                    },
                                }))),
                            }))),
                })),
            ),
            isVisible: (env) => env.getters.getPivots().length,
            separator: true,
        })
        .add("pivot_properties", {
            name: _t("Pivot properties"),
            sequence: 101,
            action(env) {
                env.dispatch("SELECT_PIVOT", { cell: env.getters.getActiveCell() });
                const pivot = env.getters.getSelectedPivot();
                if (pivot) {
                    env.openSidePanel("PIVOT_PROPERTIES_PANEL", { pivot });
                }
            },
            isVisible: (env) => {
                const cell = env.getters.getActiveCell();
                return cell && cell.type === "formula" && cell.content.match(/=\s*PIVOT/);
            }
        });
});
