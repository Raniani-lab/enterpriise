/** @odoo-module */

import { OdooViewsDataSource } from "@spreadsheet/data_sources/odoo_views_data_source";
import { _t } from "@web/core/l10n/translation";
import { GraphModel } from "@web/views/graph/graph_model";

// @ts-ignore
export default class GraphDataSource extends OdooViewsDataSource {
    /**
     * @override
     * @param {Object} services Services (see DataSource)
     */
    constructor(services, params) {
        super(services, params);
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
}
