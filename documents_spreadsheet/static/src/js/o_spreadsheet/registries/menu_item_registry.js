/** @odoo-module alias=documents_spreadsheet.MenuItemRegistry */

import { _t } from "web.core";
import { pivotFormulaRegex } from "../helpers/pivot_helpers";
import spreadsheet from "../o_spreadsheet_loader";
import { INSERT_PIVOT_CELL_CHILDREN, REINSERT_PIVOT_CHILDREN } from "./pivot_actions";

const { cellMenuRegistry, topbarMenuRegistry } = spreadsheet.registries;
const { createFullMenuItem } = spreadsheet.helpers;

function getPivotName(getters, pivot) {
    return getters.isCacheLoaded(pivot.id)
            ? getters.getCache(pivot.id).getModelLabel()
            : pivot.model;
}

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
topbarMenuRegistry.addChild("save_as_template", ["file"], {
    name: _t("Save as Template"),
    sequence: 40,
    action: (env) => env.saveAsTemplate(),
});
topbarMenuRegistry.addChild("download", ["file"], {
    name: _t("Download"),
    sequence: 50,
    action: (env) => env.download(),
});
topbarMenuRegistry.add("pivots", {
    name: _t("Pivots"),
    sequence: 60,
    children: function(env) {
        const view = _t("View")
        const pivots = env.getters.getPivots()
        const children = pivots
        .map((pivot, index) => (createFullMenuItem(`item_pivot_${pivot.id}`, {
            name: view + " " + `${getPivotName(env.getters, pivot)} (#${pivot.id})`,
            sequence: index,
            action: (env) => {
                env.dispatch("SELECT_PIVOT", { pivotId: pivot.id });
                env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
            },
            separator: index === env.getters.getPivots().length - 1,
        })))
        return children.concat([
            createFullMenuItem(`refresh_pivot`, {
                name: _t("Refresh pivot values"),
                sequence: env.getters.getPivots().length + 1,
                action: (env) => env.dispatch("REFRESH_PIVOT"),
                separator: true,
            }),
            createFullMenuItem(`reinsert_pivot`, {
                name: _t("re-Insert Pivot"),
                sequence: 60,
                children: REINSERT_PIVOT_CHILDREN,
                isVisible: (env) => env.getters.getPivots().length,
            }),
            createFullMenuItem(`insert_pivot_cell`, {
                name: _t("Insert pivot cell"),
                sequence: 70,
                children: INSERT_PIVOT_CELL_CHILDREN,
                isVisible: (env) => env.getters.getPivots().length,
            }),
        ]);
    },
    isVisible: (env) => env.getters.getPivots().length,
});

cellMenuRegistry.add("reinsert_pivot", {
    name: _t("Re-insert pivot"),
    sequence: 160,
    children: REINSERT_PIVOT_CHILDREN,
    isVisible: (env) => env.getters.getPivots().length,
}).add("insert_pivot_cell", {
    name: _t("Insert pivot cell"),
    sequence: 170,
    children: INSERT_PIVOT_CELL_CHILDREN,
    isVisible: (env) => env.getters.getPivots().length,
}).add("pivot_properties", {
    name: _t("Pivot properties"),
    sequence: 150,
    action(env) {
        const [col, row] = env.getters.getPosition();
        const pivotId = env.getters.getPivotFromPosition(col, row);
        env.dispatch("SELECT_PIVOT", { pivotId });
        env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
    },
    isVisible: (env) => {
        const cell = env.getters.getActiveCell();
        return cell && cell.type === "formula" && cell.formula.text.match(pivotFormulaRegex);
    }
});
