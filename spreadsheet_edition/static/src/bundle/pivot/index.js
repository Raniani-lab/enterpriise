/** @odoo-module */

import { _t, _lt } from "@web/core/l10n/translation";

import spreadsheet, {
    initCallbackRegistry,
} from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import PivotAutofillPlugin from "./plugins/pivot_autofill_plugin";
import PivotSidePanel from "./side_panels/pivot_list_side_panel";

import "./autofill";
import "./operational_transform";
import { insertPivot } from "./pivot_init_callback";
import { pivotFormulaRegex } from "@spreadsheet/pivot/pivot_helpers";

const { featurePluginRegistry, sidePanelRegistry, cellMenuRegistry } = spreadsheet.registries;

featurePluginRegistry.add("odooPivotAutofillPlugin", PivotAutofillPlugin);

sidePanelRegistry.add("PIVOT_PROPERTIES_PANEL", {
    title: () => _t("Pivot properties"),
    Body: PivotSidePanel,
});

initCallbackRegistry.add("insertPivot", insertPivot);

cellMenuRegistry.add("pivot_properties", {
    name: _lt("See pivot properties"),
    sequence: 170,
    action(env) {
        const position = env.model.getters.getActivePosition();
        const pivotId = env.model.getters.getPivotIdFromPosition(position);
        env.model.dispatch("SELECT_PIVOT", { pivotId });
        env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
    },
    isVisible: (env) => {
        const cell = env.model.getters.getActiveCell();
        return cell && cell.isFormula && cell.content.match(pivotFormulaRegex);
    },
});
