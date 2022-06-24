/** @odoo-module */

import { _t, _lt } from "@web/core/l10n/translation";

import spreadsheet, {
    initCallbackRegistry
} from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import PivotAutofillPlugin from "./plugins/pivot_autofill_plugin";
import PivotSidePanel from "./side_panels/pivot_list_side_panel";

import "./autofill";
import "./operational_transform";
import { insertPivot } from "./pivot_init_callback";
import { REINSERT_PIVOT_CHILDREN, INSERT_PIVOT_CELL_CHILDREN } from "./pivot_actions";
import { pivotFormulaRegex } from "@spreadsheet/pivot/pivot_helpers";

const { uiPluginRegistry, sidePanelRegistry, cellMenuRegistry } = spreadsheet.registries;

uiPluginRegistry.add("odooPivotAutofillPlugin", PivotAutofillPlugin);

sidePanelRegistry.add("PIVOT_PROPERTIES_PANEL", {
    title: () => _t("Pivot properties"),
    Body: PivotSidePanel,
});

initCallbackRegistry.add("insertPivot", insertPivot);

cellMenuRegistry
    .add("reinsert_pivot", {
        name: _lt("Re-insert pivot"),
        sequence: 185,
        children: REINSERT_PIVOT_CHILDREN,
        isVisible: (env) => env.model.getters.getPivotIds().length,
        separator: true,
    })
    .add("insert_pivot_cell", {
        name: _lt("Insert pivot cell"),
        sequence: 180,
        children: INSERT_PIVOT_CELL_CHILDREN,
        isVisible: (env) => env.model.getters.getPivotIds().length,
    })
    .add("pivot_properties", {
        name: _lt("Pivot properties"),
        sequence: 170,
        action(env) {
            const { col, row } = env.model.getters.getPosition();
            const sheetId = env.model.getters.getActiveSheetId();
            const pivotId = env.model.getters.getPivotIdFromPosition(sheetId, col, row);
            env.model.dispatch("SELECT_PIVOT", { pivotId });
            env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
        },
        isVisible: (env) => {
            const cell = env.model.getters.getActiveCell();
            return cell && cell.isFormula() && cell.content.match(pivotFormulaRegex);
        },
    });
