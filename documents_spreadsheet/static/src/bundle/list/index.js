/** @odoo-module */

import { _t, _lt } from "web.core";

import spreadsheet, { initCallbackRegistry } from "../o_spreadsheet/o_spreadsheet_extended";

import "./autofill";
import "./list_functions";
import "./operational_transform";


import ListPlugin from "./plugins/list_plugin";

import ListStructurePlugin from "./plugins/list_structure_plugin";

import ListingAllSidePanel from "./side_panels/listing_all_side_panel";
import ListAutofillPlugin from "./plugins/list_autofill_plugin";

import { insertList } from "./list_init_callback";
import { REINSERT_LIST_CHILDREN, SEE_RECORD_LIST } from "./list_actions"
import { getNumberOfListFormulas } from "./list_helpers";


const { coreTypes, readonlyAllowedCommands } = spreadsheet;
const { corePluginRegistry, uiPluginRegistry, sidePanelRegistry, cellMenuRegistry } = spreadsheet.registries;

corePluginRegistry.add("odooListPlugin", ListPlugin);

uiPluginRegistry.add("odooListStructurePlugin", ListStructurePlugin);
uiPluginRegistry.add("odooListAutofillPlugin", ListAutofillPlugin);


coreTypes.add("INSERT_ODOO_LIST");
coreTypes.add("RENAME_ODOO_LIST");
coreTypes.add("RE_INSERT_ODOO_LIST");

readonlyAllowedCommands.add("ADD_LIST_DOMAIN");

sidePanelRegistry.add("LIST_PROPERTIES_PANEL", {
    title: () => _t("List properties"),
    Body: ListingAllSidePanel,
});

initCallbackRegistry.add("insertList", insertList);

cellMenuRegistry
    .add("listing_properties", {
        name: _lt("List properties"),
        sequence: 190,
        action(env) {
            const { col, row } = env.model.getters.getPosition();
            const sheetId = env.model.getters.getActiveSheetId();
            const listId = env.model.getters.getListIdFromPosition(sheetId, col, row);
            env.model.dispatch("SELECT_ODOO_LIST", { listId });
            env.openSidePanel("LIST_PROPERTIES_PANEL", {});
        },
        isVisible: (env) => {
            const { col, row } = env.model.getters.getPosition();
            const sheetId = env.model.getters.getActiveSheetId();
            return env.model.getters.getListIdFromPosition(sheetId, col, row) !== undefined;
        },
    })
    .add("list_see_record", {
        name: _lt("See record"),
        sequence: 200,
        action: SEE_RECORD_LIST,
        isVisible: (env) => {
            const cell = env.model.getters.getActiveCell();
            return (
                cell &&
                cell.evaluated.value !== "" &&
                getNumberOfListFormulas(cell.content) === 1
            );
        },
    })
    .add("reinsert_list", {
        name: _lt("Re-insert list"),
        sequence: 210,
        children: REINSERT_LIST_CHILDREN,
        isVisible: (env) => env.model.getters.getListIds().length,
        separator: true,
    })
