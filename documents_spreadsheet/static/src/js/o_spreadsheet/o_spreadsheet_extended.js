/** @odoo-module alias=documents_spreadsheet.spreadsheet_extended */

import "./registries/autofill";
import "./registries/filter_component";
import "./registries/menu_item_registry";
import "./registries/pivot_functions";
import "./registries/pivot_side_panel";
import "./../collaborative/operational_transform";

import spreadsheet from "./o_spreadsheet_loader";
import PivotPlugin from "documents_spreadsheet.PivotPlugin";
import PivotStructurePlugin from "documents_spreadsheet.PivotStructurePlugin";
import PivotTemplatePlugin from "documents_spreadsheet.PivotTemplatePlugin";
import FiltersPlugin from "documents_spreadsheet.FiltersPlugin";

const { coreTypes } = spreadsheet;
const { corePluginRegistry, uiPluginRegistry } = spreadsheet.registries;

corePluginRegistry.add("odooPivotPlugin", PivotPlugin);
corePluginRegistry.add("odooFiltersPlugin", FiltersPlugin);
uiPluginRegistry.add("odooPivotStructurePlugin", PivotStructurePlugin);
uiPluginRegistry.add("odooPivotTemplatePlugin", PivotTemplatePlugin);

coreTypes.add("ADD_PIVOT");
coreTypes.add("ADD_PIVOT_FORMULA");
coreTypes.add("ADD_PIVOT_FILTER");
coreTypes.add("EDIT_PIVOT_FILTER");
coreTypes.add("REMOVE_PIVOT_FILTER");

export default spreadsheet;