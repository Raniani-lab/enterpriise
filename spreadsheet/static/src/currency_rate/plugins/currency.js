/** @odoo-module */

import spreadsheet from "../../o_spreadsheet/o_spreadsheet_extended";
import { CurrencyDataSource } from "../currency_data_source";
const { uiPluginRegistry } = spreadsheet.registries;

const DATA_SOURCE_ID = "CURRENCY_RATES";

class CurrencyPlugin extends spreadsheet.UIPlugin {
    constructor(getters, history, dispatch, config) {
        super(getters, history, dispatch, config);
        this.dataSources = config.dataSources;
        if (this.dataSources) {
            this.dataSources.add(DATA_SOURCE_ID, CurrencyDataSource);
            this.dataSources.load(DATA_SOURCE_ID);
        }
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    /**
     * Get the currency rate between the two given currencies
     * @param {string} from Currency from
     * @param {string} to Currency to
     * @param {string} date
     * @returns {number|string}
     */
    getCurrencyRate(from, to, date) {
        return (
            this.dataSources && this.dataSources.get(DATA_SOURCE_ID).getCurrencyRate(from, to, date)
        );
    }
}

CurrencyPlugin.modes = ["normal", "headless"];
CurrencyPlugin.getters = ["getCurrencyRate"];

uiPluginRegistry.add("odooCurrency", CurrencyPlugin);
