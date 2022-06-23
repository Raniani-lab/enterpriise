/** @odoo-module */

import { _lt } from "@web/core/l10n/translation";

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

import PivotPlugin from "./plugins/pivot_plugin";
import PivotStructurePlugin from "./plugins/pivot_structure_plugin";

import { getNumberOfPivotFormulas, getFirstPivotFunction } from "@spreadsheet/pivot/pivot_helpers";

const { coreTypes, readonlyAllowedCommands, astToFormula } = spreadsheet;
const { corePluginRegistry, uiPluginRegistry, cellMenuRegistry } = spreadsheet.registries;

const { inverseCommandRegistry } = spreadsheet.registries;

function identity(cmd) {
    return [cmd];
}

corePluginRegistry.add("odooPivotPlugin", PivotPlugin);

uiPluginRegistry.add("odooPivotStructurePlugin", PivotStructurePlugin);

coreTypes.add("INSERT_PIVOT");
coreTypes.add("RENAME_ODOO_PIVOT");
coreTypes.add("REMOVE_PIVOT");
coreTypes.add("RE_INSERT_PIVOT");

readonlyAllowedCommands.add("ADD_PIVOT_DOMAIN");

cellMenuRegistry.add("pivot_see_records", {
    name: _lt("See records"),
    sequence: 175,
    async action(env) {
        const cell = env.model.getters.getActiveCell();
        const { col, row, sheetId } = env.model.getters.getCellPosition(cell.id);
        const { args, functionName } = getFirstPivotFunction(cell.content);
        const evaluatedArgs = args
            .map(astToFormula)
            .map((arg) => env.model.getters.evaluateFormula(arg));
        const pivotId = env.model.getters.getPivotIdFromPosition(sheetId, col, row);
        const { model } = env.model.getters.getPivotDefinition(pivotId);
        const pivotModel = await env.model.getters.getAsyncSpreadsheetPivotModel(pivotId);
        const slice = functionName === "ODOO.PIVOT.HEADER" ? 1 : 2;
        let argsDomain = evaluatedArgs.slice(slice);
        if (argsDomain[argsDomain.length - 2] === "measure") {
            // We have to remove the measure from the domain
            argsDomain = argsDomain.slice(0, argsDomain.length - 2);
        }
        const domain = pivotModel.getPivotCellDomain(argsDomain);
        const name = await env.model.getters.getSpreadsheetPivotDataSource(pivotId).getModelLabel();
        await env.services.action.doAction({
            type: "ir.actions.act_window",
            name,
            res_model: model,
            view_mode: "list",
            views: [[false, "list"]],
            target: "current",
            domain,
        });
    },
    isVisible: (env) => {
        const cell = env.model.getters.getActiveCell();
        return (
            cell &&
            cell.evaluated.value !== "" &&
            !cell.evaluated.error &&
            getNumberOfPivotFormulas(cell.content) === 1
        );
    },
});

inverseCommandRegistry
    .add("INSERT_PIVOT", identity)
    .add("RENAME_ODOO_PIVOT", identity)
    .add("REMOVE_PIVOT", identity)
    .add("RE_INSERT_PIVOT", identity);
