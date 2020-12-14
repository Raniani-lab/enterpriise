/** @odoo-module alias=documents_spreadsheet.pivot_actions default=0 **/

import spreadsheet from "../o_spreadsheet_loader";
import { waitForIdle } from "../helpers/pivot_helpers";

const { createFullMenuItem } = spreadsheet.helpers;

function getPivotName(getters, pivot) {
    return getters.isCacheLoaded(pivot.id)
            ? getters.getCache(pivot.id).getModelLabel()
            : pivot.model;
}

export const REINSERT_PIVOT_CHILDREN = (env) => Object.values(env.getters.getPivots())
    .map((pivot, index) => (createFullMenuItem(`reinsert_pivot_${pivot.id}`, {
        name: `${getPivotName(env.getters, pivot)} (#${pivot.id})`,
        sequence: index,
        action: async (env) => {
            // We need to fetch the cache without the global filters,
            // to get the full pivot structure.
            await env.getters.getAsyncCache(pivot.id, {
                dataOnly: true,
                initialDomain: true,
                force: true,
            })
            const zone = env.getters.getSelectedZone();
            env.dispatch("REBUILD_PIVOT", {
                id: pivot.id,
                anchor: [zone.left, zone.top],
            });
            if (env.getters.getActiveFilterCount()) {
                await env.getters.getAsyncCache(pivot.id, {
                    dataOnly: true,
                    initialDomain: false,
                    force: true,
                })
            }
            env.dispatch("EVALUATE_CELLS", { sheetId: env.getters.getActiveSheetId() });
        }
    }))
);

export const INSERT_PIVOT_CELL_CHILDREN = (env) => Object.values(env.getters.getPivots())
    .map((pivot, index) => (createFullMenuItem(`insert_pivot_cell_${pivot.id}`, {
        name: `${getPivotName(env.getters, pivot)} (#${pivot.id})`,
        sequence: index,
        action: async (env) => {
            const sheetId = env.getters.getActiveSheetId();
            const [ col, row ] = env.getters.getMainCell(sheetId, ...env.getters.getPosition());
            const insertPivotValueCallback = (formula) => {
                env.dispatch("UPDATE_CELL", {
                    sheetId,
                    col,
                    row,
                    content: formula,
                });
            }
            await env.getters.getAsyncCache(pivot.id, { dataOnly: true, force: true });
            env.dispatch("EVALUATE_CELLS", { sheetId: env.getters.getActiveSheetId() });
            // Here we need to wait for every cells of the sheet are
            // computed, in order to ensure that the cache of missing
            // values is correctly filled
            await waitForIdle(env.getters);

            env.openPivotDialog({ pivotId: pivot.id, insertPivotValueCallback });
        },
    }))
);
