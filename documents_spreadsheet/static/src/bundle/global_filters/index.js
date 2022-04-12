/** @odoo-module */

import { _t } from "@web/core/l10n/translation";

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import "../pivot/index"; // filter depends on pivot and lists for its getters
import "../list/index"; // filter depends on pivot and lists for its getters


import FiltersPlugin from "./filters_plugin";
import FiltersEvaluationPlugin from "./filters_evaluation_plugin";


import FilterEditorSidePanel from "documents_spreadsheet.filter_editor_side_panel";
import GlobalFiltersSidePanel  from "documents_spreadsheet.global_filters_side_panel";
import { FilterComponent } from "./filter_component";

import "./operational_transform";

const { coreTypes, invalidateEvaluationCommands, readonlyAllowedCommands } =
  spreadsheet;

const {
  corePluginRegistry,
  uiPluginRegistry,
  sidePanelRegistry,
  topbarComponentRegistry,
} = spreadsheet.registries;

corePluginRegistry.add("odooFiltersPlugin", FiltersPlugin);
uiPluginRegistry.add("odooFiltersEvaluationPlugin", FiltersEvaluationPlugin);


coreTypes.add("ADD_GLOBAL_FILTER");
coreTypes.add("EDIT_GLOBAL_FILTER");
coreTypes.add("REMOVE_GLOBAL_FILTER");

invalidateEvaluationCommands.add("ADD_GLOBAL_FILTER");
invalidateEvaluationCommands.add("EDIT_GLOBAL_FILTER");
invalidateEvaluationCommands.add("REMOVE_GLOBAL_FILTER");
invalidateEvaluationCommands.add("SET_GLOBAL_FILTER_VALUE");

readonlyAllowedCommands.add("SET_GLOBAL_FILTER_VALUE");

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
        env.model.getters.getPivotIds().length + env.model.getters.getListIds().length) ||
      (env.model.getters.isReadonly() && env.model.getters.getGlobalFilters().length)
    );
  },
});
