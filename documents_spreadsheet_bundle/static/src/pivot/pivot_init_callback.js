/** @odoo-module **/
import { sanitizePivot } from "./pivot_helpers";
import PivotDataSource from "./pivot_data_source";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

export async function getPivotCache(pivot, orm) {
    const dataSource = new PivotDataSource({
        rpc: orm,
        definition: pivot,
        model: pivot.model,
    });
    return dataSource.get({ domain: pivot.domain });
}

export async function insertPivot(pivotModel) {
    const pivot = sanitizePivot(pivotModel);
    const cache = await getPivotCache(pivot, this.orm);
    return (model) => {
        if (!this.isEmptySpreadsheet) {
            const sheetId = uuidGenerator.uuidv4();
            const sheetIdFrom = model.getters.getActiveSheetId();
            model.dispatch("CREATE_SHEET", {
                sheetId,
                position: model.getters.getVisibleSheets().length,
            });
            model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId });
        }
        pivot.id = model.getters.getNextPivotId();
        model.dispatch("BUILD_PIVOT", {
            sheetId: model.getters.getActiveSheetId(),
            pivot,
            cache,
            anchor: [0, 0],
        });
    };
}
