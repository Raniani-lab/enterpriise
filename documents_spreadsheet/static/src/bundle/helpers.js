/** @odoo-module */

import { Model } from "@odoo/o-spreadsheet";
import { DataSources } from "@spreadsheet/data_sources/data_sources";
import { migrate } from "@spreadsheet/o_spreadsheet/migration";

/**
 * Convert PIVOT functions from relative to absolute.
 *
 * @param {object} orm
 * @param {object} data
 * @returns {Promise<object>} spreadsheetData
 */
export async function convertFromSpreadsheetTemplate(orm, data) {
    const model = new Model(migrate(data), {
        custom: { dataSources: new DataSources(orm) },
    });
    await model.config.custom.dataSources.waitForAllLoaded();
    const proms = [];
    for (const pivotId of model.getters.getPivotIds()) {
        proms.push(model.getters.getPivotDataSource(pivotId).prepareForTemplateGeneration());
    }
    await Promise.all(proms);
    model.dispatch("CONVERT_PIVOT_FROM_TEMPLATE");
    return model.exportData();
}
