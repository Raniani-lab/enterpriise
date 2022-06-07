/** @odoo-module */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { getFirstListFunction } from "./list_helpers";

const { astToFormula } = spreadsheet;
const { createFullMenuItem } = spreadsheet.helpers;

export const REINSERT_LIST_CHILDREN = (env) =>
    env.model.getters.getListIds().map((listId, index) => {
        return createFullMenuItem(`reinsert_list_${listId}`, {
            name: env.model.getters.getListDisplayName(listId),
            sequence: index,
            action: async (env) => {
                const zone = env.model.getters.getSelectedZone();
                const model = await env.model.getters.getAsyncSpreadsheetListModel(listId);
                const list = env.model.getters.getListDefinition(listId);
                const columns = list.columns.map((name) => ({ name, type: model.getField(name).type}));
                env.getLinesNumber((linesNumber) => {
                    env.model.dispatch("RE_INSERT_ODOO_LIST", {
                        sheetId: env.model.getters.getActiveSheetId(),
                        col: zone.left,
                        row: zone.top,
                        id: listId,
                        linesNumber,
                        columns: columns,
                    })
                });
            },
        });
    });

export const SEE_RECORD_LIST = async (env) => {
    const cell = env.model.getters.getActiveCell();
    const {col, row, sheetId } = env.model.getters.getCellPosition(cell.id);
    if (!cell) {
        return;
    }
    const { args } = getFirstListFunction(cell.content);
    const evaluatedArgs = args
        .map(astToFormula)
        .map((arg) => env.model.getters.evaluateFormula(arg));
    const listId = env.model.getters.getListIdFromPosition(sheetId, col, row);
    const { model } = env.model.getters.getListDefinition(listId);
    const listModel = await env.model.getters.getAsyncSpreadsheetListModel(listId);
    const recordId = listModel.getIdFromPosition(evaluatedArgs[1] - 1);
    if (!recordId) {
        return;
    }
    await env.services.action.doAction({
        type: "ir.actions.act_window",
        res_model: model,
        res_id: recordId,
        views: [[false, "form"]],
        view_mode: "form",
    });
}
