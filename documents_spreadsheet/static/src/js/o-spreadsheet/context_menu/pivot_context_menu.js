odoo.define("documents_spreadsheet.pivot_context_menu", function (require) {
    "use strict";

    const core = require("web.core");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { fetchCache, formatGroupBy, formatHeader } = require("documents_spreadsheet.pivot_utils");

    const _t = core._t;
    const contextMenuRegistry = spreadsheet.registries.contextMenuRegistry;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    contextMenuRegistry
        .add("reinsert_pivot", {
            type: "root",
            name: "reinsert_pivot",
            description: _t("Re-insert pivot"),
            subMenus: (env) => Object.values(env.getters.getPivots())
                .map((pivot) => ({
                    type: "action",
                    name: `reinsert_pivot_${pivot.id}`,
                    description: `${pivot.cache && pivot.cache.modelLabel || pivot.model} (#${pivot.id})`,
                    action: async (env) => {
                        pivot.lastUpdate = undefined;
                        await fetchCache(pivot, env.services.rpc);
                        const zone = env.getters.getSelectedZone();
                        env.dispatch("REBUILD_PIVOT", {
                            id: pivot.id,
                            anchor: [zone.left, zone.top],
                        });
                    }
                })
            ),
            isVisible: (type, env) => type === "CELL" && env.getters.getPivots().length,
        })
        .add("insert_pivot_section", {
            type: "root",
            name: "insert_pivot_section",
            description: _t("Insert pivot section"),
            subMenus: (env) => Object.values(env.getters.getPivots())
                .map((pivot) => ({
                    type: "root",
                    name: `insert_pivot_section_${pivot.id}`,
                    description: `${pivot.cache && pivot.cache.modelLabel || pivot.model} (#${pivot.id})`,
                    subMenus: () => [pivot.colGroupBys[0], pivot.rowGroupBys[0]].filter(x => x !== undefined)
                        .map((field) => ({
                            type: "root",
                            name: `insert_pivot_section_${pivot.id}_${field}`,
                            description: `${formatGroupBy(pivot, field)}`,
                            subMenus: () => Object.keys(pivot.cache.groupBys[field])
                                .map((value) => ({
                                    type: "action",
                                    name: `insert_pivot_section_${pivot.id}_${field}_${value}`,
                                    description: `${formatHeader(pivot, field, value)}`,
                                    action: (env) => {
                                        const [col, row] = env.getters.getPosition();
                                        env.dispatch("INSERT_HEADER", { id: pivot.id, col, row, field, value });
                                    },
                                })),
                            })),
                })
            ),
            isVisible: (type, env) => type === "CELL" && env.getters.getPivots().length,
        })
        .add("pivot_properties", {
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
