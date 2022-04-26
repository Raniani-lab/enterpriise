/** @odoo-module */

import { _t, _lt } from "web.core";

import spreadsheet, { initCallbackRegistry } from "../o_spreadsheet/o_spreadsheet_extended";

import PivotPlugin from "./plugins/pivot_plugin";
import PivotStructurePlugin from "./plugins/pivot_structure_plugin";
import PivotTemplatePlugin from "documents_spreadsheet.PivotTemplatePlugin";
import PivotAutofillPlugin from "./plugins/pivot_autofill_plugin";
import PivotSidePanel from "./side_panels/pivot_list_side_panel";

import "./autofill";
import "./operational_transform";
import { insertPivot } from "./pivot_init_callback";
import { REINSERT_PIVOT_CHILDREN, INSERT_PIVOT_CELL_CHILDREN } from "./pivot_actions";
import { pivotFormulaRegex, getNumberOfPivotFormulas, getFirstPivotFunction } from "./pivot_helpers";


const { coreTypes, readonlyAllowedCommands, astToFormula } = spreadsheet;
const { corePluginRegistry, uiPluginRegistry, sidePanelRegistry, cellMenuRegistry } = spreadsheet.registries;

corePluginRegistry.add("odooPivotPlugin", PivotPlugin);

uiPluginRegistry.add("odooPivotStructurePlugin", PivotStructurePlugin);
uiPluginRegistry.add("odooPivotAutofillPlugin", PivotAutofillPlugin);
uiPluginRegistry.add("odooPivotTemplatePlugin", PivotTemplatePlugin);

coreTypes.add("INSERT_PIVOT");
coreTypes.add("RE_INSERT_PIVOT");

readonlyAllowedCommands.add("ADD_PIVOT_DOMAIN");

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
    })
    .add("see records", {
        name: _lt("See records"),
        sequence: 175,
        async action(env) {
            const cell = env.model.getters.getActiveCell();
            const {col, row, sheetId } = env.model.getters.getCellPosition(cell.id);
            const { args, functionName } = getFirstPivotFunction(cell.content);
            const evaluatedArgs = args
                .map(astToFormula)
                .map((arg) => env.model.getters.evaluateFormula(arg));
            const pivotId = env.model.getters.getPivotIdFromPosition(sheetId, col, row);
            const { model } = env.model.getters.getPivotDefinition(pivotId);
            const pivotModel = await env.model.getters.getAsyncSpreadsheetPivotModel(pivotId);
            const slice = functionName === "PIVOT.HEADER" ? 1 : 2
            let argsDomain = evaluatedArgs.slice(slice);
            if (argsDomain[argsDomain.length - 2] === "measure") {
                // We have to remove the measure from the domain
                argsDomain = argsDomain.slice(0, argsDomain.length - 2)
            }
            const domain = pivotModel.getPivotCellDomain(argsDomain);
            const name = pivotModel.getModelLabel();
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
                getNumberOfPivotFormulas(cell.content) === 1
            );
        },
    });
