/** @odoo-module */

import { OdooViewsDataSource } from "@spreadsheet/data_sources/odoo_views_data_source";
import { _t } from "@web/core/l10n/translation";
import { GraphModel } from "@web/views/graph/graph_model";

/** @typedef {import("@spreadsheet/data_sources/metadata_repository").Field} Field */

export default class GraphDataSource extends OdooViewsDataSource {
    /**
     * @override
     * @param {Object} services Services (see DataSource)
     */
    constructor(services, params) {
        super(services, params);
    }

    /**
     * @returns {Record<string, Field>} field definitions
     */
    getFields() {
        return this._metaData.fields;
    }

    /**
     * @param {string} fieldName
     * @returns {Field}
     */
    getField(fieldName) {
        return this.getFields()[fieldName];
    }

    /**
     * @protected
     */
    async _createDataSourceModel() {
        await this._fetchMetadata();
        const metaData = {
            fieldAttrs: {},
            ...this._metaData,
        };
        this._model = new GraphModel(
            {
                _t,
            },
            metaData,
            {
                orm: this._orm,
            }
        );
    }

    getData() {
        if (!this.isReady()) {
            this.load();
            return { datasets: [], labels: [] };
        }
        return this._model.data;
    }
}
