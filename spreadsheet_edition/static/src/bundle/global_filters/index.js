/** @odoo-module */

import { _t } from "@web/core/l10n/translation";

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import FilterEditorSidePanel from "./filter_editor_side_panel";
import GlobalFiltersSidePanel from "./global_filters_side_panel";
import { FilterComponent } from "./filter_component";

import "./operational_transform";

const { sidePanelRegistry, topbarComponentRegistry } = spreadsheet.registries;

sidePanelRegistry.add("FILTERS_SIDE_PANEL", {
    title: _t("Filter properties"),
    Body: FilterEditorSidePanel,
});

sidePanelRegistry.add("GLOBAL_FILTERS_SIDE_PANEL", {
    title: _t("Filters"),
    Body: GlobalFiltersSidePanel,
});

topbarComponentRegistry.add("filter_component", {
    component: FilterComponent,
    isVisible: (env) => {
        return (
            (!env.model.getters.isReadonly() &&
                env.model.getters.getPivotIds().length +
                    env.model.getters.getListIds().length +
                    env.model.getters.getOdooChartIds().length) ||
            (env.model.getters.isReadonly() && env.model.getters.getGlobalFilters().length)
        );
    },
});
