/** @odoo-module */

import { _t, _lt } from "web.core";

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { initCallbackRegistry } from "../o_spreadsheet/o_spreadsheet_extended";

import "./autofill";
import "./list_functions";
import "./operational_transform";


import ListPlugin from "./plugins/list_plugin";

import ListStructurePlugin from "./plugins/list_structure_plugin";

import ListingAllSidePanel from "./side_panels/listing_all_side_panel";
import ListAutofillPlugin from "./plugins/list_autofill_plugin";

import { insertList } from "./list_init_callback";
import { REINSERT_LIST_CHILDREN } from "./list_actions"


const { coreTypes, readonlyAllowedCommands } = spreadsheet;
const { corePluginRegistry, uiPluginRegistry, sidePanelRegistry, cellMenuRegistry } = spreadsheet.registries;

corePluginRegistry.add("odooListPlugin", ListPlugin);

uiPluginRegistry.add("odooListStructurePlugin", ListStructurePlugin);
uiPluginRegistry.add("odooListAutofillPlugin", ListAutofillPlugin);


coreTypes.add("ADD_ODOO_LIST");
coreTypes.add("ADD_ODOO_LIST_FORMULA");

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
            const [col, row] = env.getters.getPosition();
            const sheetId = env.getters.getActiveSheetId();
            const listId = env.getters.getListIdFromPosition(sheetId, col, row);
            env.dispatch("SELECT_ODOO_LIST", { listId });
            env.openSidePanel("LIST_PROPERTIES_PANEL", {});
        },
        isVisible: (env) => {
            const [col, row] = env.getters.getPosition();
            const sheetId = env.getters.getActiveSheetId();
            return env.getters.getListIdFromPosition(sheetId, col, row) !== undefined;
        },
    })
    .add("reinsert_list", {
        name: _lt("Re-insert list"),
        sequence: 195,
        children: REINSERT_LIST_CHILDREN,
        isVisible: (env) => env.getters.getListIds().length,
        separator: true,
    })