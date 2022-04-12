/** @odoo-module */

import { MAXIMUM_CELLS_TO_INSERT } from "../o_spreadsheet/constants";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";

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
                    linesNumber = Math.min(
                        linesNumber,
                        Math.floor(MAXIMUM_CELLS_TO_INSERT / list.columns.length)
                    );
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
