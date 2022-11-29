/** @odoo-module */

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { DataSources } from "@spreadsheet/data_sources/data_sources";
import { migrate } from "@spreadsheet/o_spreadsheet/migration";

const Model = spreadsheet.Model;

/**
 * Convert PIVOT functions from relative to absolute.
 *
 * @param {object} orm
 * @param {object} data
 * @returns {Promise<object>} spreadsheetData
 */
export async function convertFromSpreadsheetTemplate(orm, data) {
    const model = new Model(migrate(data), {
        external: { dataSources: new DataSources(orm) },
    });
    await model.config.external.dataSources.waitForAllLoaded();
    const proms = [];
    for (const pivotId of model.getters.getPivotIds()) {
        proms.push(model.getters.getPivotDataSource(pivotId).prepareForTemplateGeneration());
    }
    await Promise.all(proms);
    model.dispatch("CONVERT_PIVOT_FROM_TEMPLATE");
    return model.exportData();
}
