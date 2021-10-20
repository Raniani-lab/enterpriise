/** @odoo-module **/
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

/**
     * Get the function that have to be executed to insert the given list in the
     * given spreadsheet. The returned function has to be called with the model
     * of the spreadsheet and the dataSource of this list
     *
     * @private
     *
     * @param {SpreadsheetList} list
     * @param {number} threshold
     * @param {object} fields fields coming from list_model
     *
     * @returns {Function}
     */
export async function insertList({list, threshold, fields}) {
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
        list.id = model.getters.getNextListId();
        const types = list.columns.reduce((acc, current) => {
            acc[current] = fields[current].type;
            return acc;
        }, {});
        model.dispatch("BUILD_ODOO_LIST", {
            sheetId: model.getters.getActiveSheetId(),
            anchor: [0, 0],
            list,
            types,
            linesNumber:threshold,
        });
    };
}