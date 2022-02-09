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
                const columns = env.model.getters.getListColumns(listId);
                env.getLinesNumber((linesNumber) => {
                    linesNumber = Math.min(
                        linesNumber,
                        Math.floor(MAXIMUM_CELLS_TO_INSERT / columns.length)
                    );
                    env.model.dispatch("REBUILD_ODOO_LIST", {
                        listId: listId,
                        anchor: [zone.left, zone.top],
                        sheetId: env.model.getters.getActiveSheetId(),
                        linesNumber,
                    });
                });
            },
        });
    });
