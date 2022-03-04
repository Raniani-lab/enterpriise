/** @odoo-module */

import spreadsheet from "../../o_spreadsheet/o_spreadsheet_extended";
import { _t } from "@web/core/l10n/translation";

/**
 * @typedef {import("./list_plugin").SpreadsheetList} SpreadsheetList
 * @typedef {import("../../o_spreadsheet/basic_data_source").Field} Field
 */

export default class ListStructurePlugin extends spreadsheet.UIPlugin {
    constructor(getters, history, dispatch, config) {
        super(getters, history, dispatch, config);
        this.dataSources = config.dataSources;
        /** @type {string} */
        this.selectedListId = undefined;
    }

    /**
     * Handle a spreadsheet command
     * @param {Object} cmd Command
     */
    handle(cmd) {
        switch (cmd.type) {
            case "SELECT_ODOO_LIST":
                this._selectList(cmd.listId);
                break;
            case "ADD_LIST_DOMAIN":
                this._addDomain(cmd.id, cmd.domain, cmd.refresh);
                break;
            case "REFRESH_ODOO_LIST":
                this._refreshOdooList(cmd.listId);
                break;
            case "START":
            case "REFRESH_ALL_DATA_SOURCES":
                this._refreshOdooLists();
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    /**
     * Add an additional domain to a list
     *
     * @private
     *
     * @param {string} listId pivot id
     * @param {Array<Array<any>>} domain
     * @param {boolean} refresh whether the cache should be reloaded or not
     */
    _addDomain(listId, domain, refresh = true) {
        this.getters.getSpreadsheetListDataSource(listId).addDomain(domain);
        if (refresh) {
            this._refreshOdooList(listId);
        }
    }

    /**
     * Refresh the cache of a list
     * @param {string} listId Id of the list
     */
    _refreshOdooList(listId) {
        this.getters.getSpreadsheetListDataSource(listId).get({ forceFetch: true });
    }

    /**
     * Refresh the cache of all the lists
     */
    _refreshOdooLists() {
        for (const listId of this.getters.getListIds()) {
            this._refreshOdooList(listId);
        }
    }

    /**
     * Select the given list id. If the id is undefined, it unselect the list.
     * @param {number|undefined} listId Id of the list, or undefined to remove
     *                                  the selected list
     */
    _selectList(listId) {
        this.selectedListId = listId;
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    /**
     * Get the computed domain of a list
     *
     * @param {string} listId Id of the list
     * @returns {Array}
     */
    getListComputedDomain(listId) {
        return this.getters.getSpreadsheetListDataSource(listId).getComputedDomain();
    }

    /**
     * Get the value of a list header
     *
     * @param {string} listId Id of a list
     * @param {string} fieldName
     */
    getListHeaderValue(listId, fieldName) {
        const model = this.getters.getSpreadsheetListModel(listId);
        if (!model) {
            this.getters.getAsyncSpreadsheetListModel(listId);
            return _t("Loading...");
        }
        return model.getListHeaderValue(fieldName);
    }

    /**
     * Get the value for a field of a record in the list
     * @param {string} listId Id of the list
     * @param {number} position Position of the record in the list
     * @param {string} fieldName Field Name
     *
     * @returns {string|undefined}
     */
    getListCellValue(listId, position, fieldName) {
        const model = this.getters.getSpreadsheetListModel(listId);
        if (!model) {
            this.getters.getAsyncSpreadsheetListModel(listId);
            return _t("Loading...");
        }
        return model.getListCellValue(position, fieldName);
    }

    /**
     * Get the currently selected list id
     * @returns {number|undefined} Id of the list, undefined if no one is selected
     */
    getSelectedListId() {
        return this.selectedListId;
    }
}

ListStructurePlugin.modes = ["normal", "headless"];
ListStructurePlugin.getters = [
    "getListComputedDomain",
    "getListHeaderValue",
    "getListCellValue",
    "getSelectedListId",
];
