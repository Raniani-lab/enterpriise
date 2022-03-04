/** @odoo-module */

import spreadsheet from "../../o_spreadsheet/o_spreadsheet_extended";
import CommandResult from "../../o_spreadsheet/cancelled_reason";
import { getFirstListFunction } from "../list_helpers";
import { getMaxObjectId } from "../../o_spreadsheet/helpers";
import ListDataSource from "../list_data_source";

import { TOP_LEVEL_STYLE } from "../../o_spreadsheet/constants";

const { astToFormula } = spreadsheet;

/**
 * @typedef {Object} SpreadsheetList
 * @property {Array<string>} columns
 * @property {Object} context
 * @property {Array<Array<string>>} domain
 * @property {string} id The id of the list
 * @property {string} model The technical name of the model we are listing
 * @property {Array<string>} orderBy
 *
 */
export default class ListPlugin extends spreadsheet.CorePlugin {
    constructor(getters, history, range, dispatch, config, uuidGenerator) {
        super(getters, history, range, dispatch, config, uuidGenerator);
        this.odooViewsModels = config.odooViewsModels;
        this.dataSources = config.dataSources;
        this.lists = {};
    }

    allowDispatch(cmd) {
        switch (cmd.type) {
            case "INSERT_ODOO_LIST":
                if (this.lists[cmd.id]) {
                    return CommandResult.ListIdDuplicated;
                }
                break;
        }
        return CommandResult.Success;
    }

    /**
     * Handle a spreadsheet command
     *
     * @param {Object} cmd Command
     */
    handle(cmd) {
        switch (cmd.type) {
            case "INSERT_ODOO_LIST": {
                const { sheetId, col, row, id, definition, dataSourceId, linesNumber, columns } = cmd;
                const anchor = [col, row]
                this._addList(id, definition, dataSourceId);
                this._insertList(sheetId, anchor, id, linesNumber, columns);
                break;
            }
            case "RE_INSERT_ODOO_LIST": {
                const { sheetId, col, row, id, linesNumber, columns } = cmd;
                const anchor = [col, row];
                this._insertList(sheetId, anchor, id, linesNumber, columns);
                break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    getSpreadsheetListModel(id) {
        const dataSourceId = this.lists[id].dataSourceId;
        return this.dataSources.get(dataSourceId).getListModel();
    }

    getSpreadsheetListDataSource(id) {
        const dataSourceId = this.lists[id].dataSourceId;
        return this.dataSources.get(dataSourceId);
    }

    getListDisplayName(id) {
        return `(#${id}) ${this.getSpreadsheetListModel(id).getModelLabel()}`;
    }

    async getAsyncSpreadsheetListModel(id) {
        const dataSourceId = this.lists[id].dataSourceId;
        return this.dataSources.get(dataSourceId).get();
    }

    /**
     * Get the id of the list at the given position. Returns undefined if there
     * is no list at this position
     *
     * @param {string} sheetId Id of the sheet
     * @param {number} col Index of the col
     * @param {number} row Index of the row
     *
     * @returns {string|undefined}
     */
    getListIdFromPosition(sheetId, col, row) {
        const cell = this.getters.getCell(sheetId, col, row);
        if (cell && cell.isFormula()) {
            const listFunction = getFirstListFunction(cell.content);
            if (listFunction) {
                const content = astToFormula(listFunction.args[0]);
                return this.getters.evaluateFormula(content).toString();
            }
        }
        return undefined;
    }

    /**
     * Retrieve all the list ids
     *
     * @returns {Array<string>} list ids
     */
    getListIds() {
        return Object.keys(this.lists);
    }


    /**
     * Retrieve the next available id for a new list
     *
     * @returns {string} id
     */
    getNextListId() {
        return (getMaxObjectId(this.lists) + 1).toString();
    }

    getListDefinition(id) {
        const def = this.lists[id].definition;
        return {
            columns: [...def.metaData.columns],
            domain: [...def.searchParams.domain],
            model: def.metaData.model,
            context: {...def.searchParams.context},
            orderBy: [...def.searchParams.orderBy],
            id,
        }
    }

    // ---------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------

    _addList(id, definition, dataSourceId) {
        const lists = { ...this.lists };
        lists[id] = {
            id,
            definition,
            dataSourceId,
        };

        if (!this.dataSources.contains(dataSourceId)) {
            this.dataSources.add(
                dataSourceId,
                new ListDataSource({
                    odooViewsModels: this.odooViewsModels,
                    definition,
                })
            )
        }
        this.history.update("lists", lists);
    }

    /**
     * Build an Odoo List
     * @param {string} sheetId Id of the sheet
     * @param {[number,number]} anchor Top-left cell in which the list should be inserted
     * @param {string} id Id of the list
     * @param {number} linesNumber Number of records to insert
     * @param {Array<Object>} columns Columns ({name, type})
     */
    _insertList(sheetId, anchor, id, linesNumber, columns) {
        this._resizeSheet(sheetId, anchor, columns.length, linesNumber + 1);
        this._insertHeaders(sheetId, anchor, id, columns);
        this._insertValues(sheetId, anchor, id, columns, linesNumber);
    }

    _insertHeaders(sheetId, anchor, id, columns) {
        let [col, row] = anchor;
        for (const column of columns) {
            this.dispatch("UPDATE_CELL", {
                sheetId,
                col,
                row,
                content: `=LIST.HEADER("${id}","${column.name}")`,
            })
            col++;
        }
        this.dispatch("SET_FORMATTING", {
            sheetId,
            style: TOP_LEVEL_STYLE,
            target: [
                {
                    top: anchor[1],
                    bottom: anchor[1],
                    left: anchor[0],
                    right: anchor[0] + columns.length - 1,
                },
            ],
        });
    }

    _insertValues(sheetId, anchor, id, columns, linesNumber) {
        let col = anchor[0];
        let row = anchor[1] + 1;
        for (let i = 1; i <= linesNumber; i++) {
            col = anchor[0];
            for (const column of columns) {
                this.dispatch("UPDATE_CELL", {
                    sheetId,
                    col,
                    row,
                    content: `=LIST("${id}","${i}","${column.name}")`,
                });
                col++;
            }
            row++;
        }
        col = anchor[0];
        for (const column of columns) {
            if (["integer", "float", "monetary"].includes(column.type)) {
                this.dispatch("SET_FORMATTING", {
                    sheetId,
                    format: "#,##0.00",
                    target: [
                        {
                            top: anchor[1],
                            bottom: anchor[1] + linesNumber,
                            left: col,
                            right: col,
                        },
                    ],
                });
            }
            col++;
        }
    }

    /**
     * Resize the sheet to match the size of the listing. Columns and/or rows
     * could be added to be sure to insert the entire sheet.
     *
     * @param {string} sheetId Id of the sheet
     * @param {[number,number]} anchor Anchor of the list [col,row]
     * @param {number} columns Number of columns of the list
     * @param {number} rows Number of rows of the list
     */
    _resizeSheet(sheetId, anchor, columns, rows) {
        const sheet = this.getters.getSheet(sheetId);
        const numberCols = sheet.cols.length;
        const deltaCol = numberCols - anchor[0];
        if (deltaCol < columns) {
            this.dispatch("ADD_COLUMNS_ROWS", {
                dimension: "COL",
                base: numberCols - 1,
                sheetId: sheetId,
                quantity: columns - deltaCol,
                position: "after",
            });
        }
        const numberRows = sheet.rows.length;
        const deltaRow = numberRows - anchor[1];
        if (deltaRow < rows) {
            this.dispatch("ADD_COLUMNS_ROWS", {
                dimension: "ROW",
                base: numberRows - 1,
                sheetId: sheetId,
                quantity: rows - deltaRow,
                position: "after",
            });
        }
    }

    // ---------------------------------------------------------------------
    // Import/Export
    // ---------------------------------------------------------------------

    /**
     * Import the lists
     *
     * @param {Object} data
     */
    import(data) {
        if (data.lists) {
            for (const [id, list] of Object.entries(data.lists)) {
                const definition = {
                    metaData: {
                        model: list.model,
                        columns: list.columns,
                    },
                    searchParams: {
                        domain: list.domain,
                        context: list.context,
                        orderBy: list.orderBy,
                    }
                }
                this._addList(id, definition, this.uuidGenerator.uuidv4());
            }
        }
    }
    /**
     * Export the lists
     *
     * @param {Object} data
     */
    export(data) {
        data.lists = {};
        for (const id in this.lists) {
            data.lists[id] = JSON.parse(JSON.stringify(this.getListDefinition(id)));
        }
    }

}

ListPlugin.modes = ["normal", "headless"];
ListPlugin.getters = [
    "getSpreadsheetListModel",
    "getSpreadsheetListDataSource",
    "getListDisplayName",
    "getAsyncSpreadsheetListModel",
    "getListDefinition",
    "getListIdFromPosition",
    "getListIds",
    "getNextListId",
];
