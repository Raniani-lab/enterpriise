odoo.define("documents_spreadsheet.menu_item_registry", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const core = require("web.core");

    const { REINSERT_PIVOT_CHILDREN, INSERT_PIVOT_CELL_CHILDREN } = require("documents_spreadsheet.pivot_actions");
    const _t = core._t;
    const topbarMenuRegistry = spreadsheet.registries.topbarMenuRegistry;
    const createFullMenuItem = spreadsheet.helpers.createFullMenuItem;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    topbarMenuRegistry.add("file", { name: _t("File"), sequence: 10 });
    topbarMenuRegistry.addChild("new_sheet", ["file"], {
        name: _t("New"),
        sequence: 10,
        action: (env) => env.newSpreadsheet(),
    });
    topbarMenuRegistry.addChild("make_copy", ["file"], {
        name: _t("Make a copy"),
        sequence: 20,
        action: (env) => env.makeCopy(),
    });
    topbarMenuRegistry.addChild("save", ["file"], {
        name: _t("Save"),
        sequence: 30,
        action: (env) => env.saveData(),
    });
    topbarMenuRegistry.addChild("save_as_template", ["file"], {
        name: _t("Save as Template"),
        sequence: 40,
        action: (env) => env.saveAsTemplate(),
    });
    topbarMenuRegistry.add("pivots", {
        name: _t("Pivots"),
        sequence: 60,
        children: function(env) {
            const view = _t("View")
            const pivots = env.getters.getPivots()
            const children = pivots
            .map((pivot, index) => (createFullMenuItem(`item_pivot_${pivot.id}`, {
                name: view + " " + `${pivot.cache && pivot.cache.getModelLabel() || pivot.model} (#${pivot.id})`,
                sequence: index,
                action: (env) => {
                    env.dispatch("SELECT_PIVOT", { pivotId: pivot.id });
                    env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
                },
                separator: index === env.getters.getPivots().length - 1,
            })))
            children.push(
                createFullMenuItem(`refresh_pivot`, {
                    name: _t("Refresh pivot values"),
                    sequence: env.getters.getPivots().length + 1,
                    action: (env) => env.dispatch("REFRESH_PIVOT"),
                    separator: true,
                })
            );
            return children;
        },
        isVisible: (env) => env.getters.getPivots().length,
    });
    topbarMenuRegistry.addChild("reinsert_pivot", ["insert"], {
        name: _t("re-Insert Pivot"),
        sequence: 60,
        children: REINSERT_PIVOT_CHILDREN,
        isVisible: (env) => env.getters.getPivots().length,
    });
    topbarMenuRegistry.addChild("insert_pivot_cell", ["insert"], {
        name: _t("Insert pivot cell"),
            sequence: 70,
            children: INSERT_PIVOT_CELL_CHILDREN,
            isVisible: (env) => env.getters.getPivots().length,
    });
});
