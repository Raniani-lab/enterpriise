/** @odoo-module */

import { OdooViewsDataSource } from "@spreadsheet/data_sources/odoo_views_data_source";
import { SpreadsheetListModel } from "./list_model";

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
        await this._fetchMetadata();
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
}
