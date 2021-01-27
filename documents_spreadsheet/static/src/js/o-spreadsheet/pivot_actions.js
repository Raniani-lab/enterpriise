odoo.define("documents_spreadsheet.pivot_actions", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const createFullMenuItem = spreadsheet.helpers.createFullMenuItem;
    const { fetchCache, waitForIdle } = require("documents_spreadsheet.pivot_utils");
    const { toXC, toCartesian } = spreadsheet.helpers;

    const REINSERT_PIVOT_CHILDREN = (env) => Object.values(env.getters.getPivots())
    .map((pivot, index) => (createFullMenuItem(`reinsert_pivot_${pivot.id}`, {
        name: `${pivot.cache && pivot.cache.getModelLabel() || pivot.model} (#${pivot.id})`,
        sequence: index,
        action: async (env) => {
            // We need to fetch the cache without the global filters,
            // to get the full pivot structure.
            await fetchCache(pivot, env.services.rpc, {
                dataOnly: true,
                initialDomain: true,
                force: true,
            });
            const zone = env.getters.getSelectedZone();
            env.dispatch("REBUILD_PIVOT", {
                id: pivot.id,
                anchor: [zone.left, zone.top],
            });
            if (env.getters.getActiveFilterCount()) {
                await fetchCache(pivot, env.services.rpc, {
                    dataOnly: true,
                    initialDomain: false,
                    force: true,
                });
            }
            env.dispatch("EVALUATE_CELLS");
        }
    })));

    const INSERT_PIVOT_CELL_CHILDREN = (env) => Object.values(env.getters.getPivots())
    .map((pivot, index) => (createFullMenuItem(`insert_pivot_cell_${pivot.id}`, {
        name: `${pivot.cache && pivot.cache.getModelLabel() || pivot.model} (#${pivot.id})`,
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

            await fetchCache(pivot, env.services.rpc, { dataOnly: true, force: true });
            env.dispatch("EVALUATE_CELLS");
            // Here we need to wait for every cells of the sheet are
            // computed, in order to ensure that the cache of missing
            // values is correctly filled
            await waitForIdle(env.getters);

            env.openPivotDialog({ pivotId: pivot.id, insertPivotValueCallback });
        },
    })));

    return {
        INSERT_PIVOT_CELL_CHILDREN,
        REINSERT_PIVOT_CHILDREN,
    };
});
