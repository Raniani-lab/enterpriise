/** @odoo-module */

import { _lt } from "@web/core/l10n/translation";

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import "./list_functions";

import ListPlugin from "@spreadsheet/list/plugins/list_plugin";
import ListStructurePlugin from "@spreadsheet/list/plugins/list_structure_plugin";

import { SEE_RECORD_LIST } from "./list_actions";
import { getNumberOfListFormulas } from "@spreadsheet/list/list_helpers";
const { inverseCommandRegistry } = spreadsheet.registries;

function identity(cmd) {
    return [cmd];
}

const { coreTypes, readonlyAllowedCommands } = spreadsheet;
const { corePluginRegistry, uiPluginRegistry, cellMenuRegistry } = spreadsheet.registries;

corePluginRegistry.add("odooListPlugin", ListPlugin);

uiPluginRegistry.add("odooListStructurePlugin", ListStructurePlugin);

coreTypes.add("INSERT_ODOO_LIST");
coreTypes.add("RENAME_ODOO_LIST");
coreTypes.add("REMOVE_ODOO_LIST");
coreTypes.add("RE_INSERT_ODOO_LIST");

readonlyAllowedCommands.add("ADD_LIST_DOMAIN");

cellMenuRegistry.add("list_see_record", {
    name: _lt("See record"),
    sequence: 200,
    action: SEE_RECORD_LIST,
    isVisible: (env) => {
        const cell = env.model.getters.getActiveCell();
        return (
            cell &&
            cell.evaluated.value !== "" &&
            !cell.evaluated.error &&
            getNumberOfListFormulas(cell.content) === 1
        );
    },
});

inverseCommandRegistry
    .add("INSERT_ODOO_LIST", identity)
    .add("RE_INSERT_ODOO_LIST", identity)
    .add("RENAME_ODOO_LIST", identity)
    .add("REMOVE_ODOO_LIST", identity);

