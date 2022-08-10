/** @odoo-module */

import { OdooViewsDataSource } from "@spreadsheet/data_sources/odoo_views_data_source";
import { SpreadsheetListModel } from "./list_model";

/** @typedef {import("@spreadsheet/data_sources/metadata_repository").Field} Field */

export default class ListDataSource extends OdooViewsDataSource {
    /**
     * @override
     * @param {Object} services Services (see DataSource)
     * @param {Object} params
     * @param {import("./list_model").ListMetaData} params.metaData
     * @param {import("./list_model").ListSearchParams} params.searchParams
     * @param {number} params.limit
     */
    constructor(services, params) {
        super(services, params);
        this.limit = params.limit;
    }

    async _createDataSourceModel() {
        await this.loadMetadata();
        /** @type {SpreadsheetListModel} */
        this._model = new SpreadsheetListModel(
            {
                metaData: this._metaData,
                limit: this.limit,
            },
            {
                orm: this._orm,
                metadataRepository: this._metadataRepository,
            }
        );
        this._model.addEventListener("limit-exceeded", () => this.load({ reload: true }));
    }

    /**
     * @param {number} position
     * @returns {number}
     */
    getIdFromPosition(position) {
        this._assertDataIsLoaded();
        return this._model.getIdFromPosition(position);
    }

    /**
     * @param {string} fieldName
     * @returns {string}
     */
    getListHeaderValue(fieldName) {
        this._assertDataIsLoaded();
        return this._model.getListHeaderValue(fieldName);
    }

    /**
     * @param {number} position
     * @param {string} fieldName
     * @returns {string|number|undefined}
     */
    getListCellValue(position, fieldName) {
        this._assertDataIsLoaded();
        return this._model.getListCellValue(position, fieldName);
    }
}
