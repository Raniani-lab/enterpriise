/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { OdooViewsDataSource } from "../data_sources/odoo_views_data_source";
import { SpreadsheetPivotModel } from "./pivot_model";

export default class PivotDataSource extends OdooViewsDataSource {
    /**
     *
     * @override
     * @param {Object} services Services (see DataSource)
     * @param {Object} params
     * @param {import("./pivot_model").PivotMetaData} params.metaData
     * @param {import("./pivot_model").PivotSearchParams} params.searchParams
     */
    constructor(services, params) {
        super(services, params);
    }

    async _createDataSourceModel() {
        await this._fetchMetadata();
        this._model = new SpreadsheetPivotModel(
            { _t },
            {
                metaData: this._metaData,
                searchParams: this._searchParams,
            },
            {
                orm: this._orm,
                metadataRepository: this._metadataRepository,
            }
        );
    }

    async copyModelWithOriginalDomain() {
        await this._fetchMetadata();
        const model = new SpreadsheetPivotModel(
            { _t },
            {
                metaData: this._metaData,
                searchParams: this._searchParams,
            },
            {
                orm: this._orm,
                metadataRepository: this._metadataRepository,
            }
        );
        await model.load(this._searchParams);
        return model;
    }
}
