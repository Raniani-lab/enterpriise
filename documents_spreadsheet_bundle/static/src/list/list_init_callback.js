/** @odoo-module **/
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import ListDataSource from "./list_data_source";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

/**
     * Get the function that have to be executed to insert the given list in the
     * given spreadsheet. The returned function has to be called with the model
     * of the spreadsheet and the dataSource of this list
     *
     * @private
     *
     * @param {import("./plugins/list_plugin").SpreadsheetList} list
     * @param {number} threshold
     * @param {object} fields fields coming from list_model
     *
     * @returns {Function}
     */
export function insertList({list, threshold, fields}) {
    const definition = {
        metaData: {
            model: list.model,
            columns: list.columns.map((column) => column.name),
            fields,
        },
        searchParams: {
            domain: list.domain,
            context: list.context,
            orderBy: list.orderBy,
        },
        limit: threshold,
    }
    return async (model) => {
        const dataSource = new ListDataSource({
            odooViewsModels: model.config.odooViewsModels,
            definition,
        });
        await dataSource.get();
        if (!this.isEmptySpreadsheet) {
            const sheetId = uuidGenerator.uuidv4();
            const sheetIdFrom = model.getters.getActiveSheetId();
            model.dispatch("CREATE_SHEET", {
                sheetId,
                position: model.getters.getVisibleSheets().length,
            });
            model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId });
        }
        const dataSourceId = uuidGenerator.uuidv4();
        model.config.dataSources.add(dataSourceId, dataSource);
        const defWithoutFields = JSON.parse(JSON.stringify(definition));
        defWithoutFields.metaData.fields = undefined;
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("INSERT_ODOO_LIST", {
            sheetId,
            col: 0,
            row: 0,
            id: model.getters.getNextListId(),
            definition: defWithoutFields,
            dataSourceId,
            linesNumber: threshold,
            columns: list.columns,
        });
        const columns = [];
        for (let col = 0; col <= list.columns.length; col++) {
            columns.push(col);
        }
        model.dispatch("AUTORESIZE_COLUMNS", { sheetId, cols: columns });
    };
}
