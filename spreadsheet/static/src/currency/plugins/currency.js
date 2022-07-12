/** @odoo-module */

import spreadsheet from "../../o_spreadsheet/o_spreadsheet_extended";
import { CurrencyDataSource } from "../currency_data_source";
const { uiPluginRegistry } = spreadsheet.registries;

const DATA_SOURCE_ID = "CURRENCIES";

/**
 * @typedef {import("../currency_data_source").Currency} Currency
 */

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
            this.dataSources &&
            this.dataSources.get(DATA_SOURCE_ID).getCurrencyRate(from, to, date)
        );
    }

    /**
     * Returns the default display format of a given currency
     * @param {string} currencyName
     * @returns {string | undefined}
     */
    getCurrencyFormat(currencyName) {
        const currency =
            currencyName &&
            this.dataSources &&
            this.dataSources.get(DATA_SOURCE_ID).getCurrency(currencyName);
        if (!currency) {
            return undefined;
        }
        const decimalFormatPart = currency.decimalPlaces
            ? "." + "0".repeat(currency.decimalPlaces)
            : "";
        const numberFormat = "#,##0" + decimalFormatPart;
        const symbolFormatPart = "[$" + currency.symbol + "]";
        return currency.position === "after"
            ? numberFormat + symbolFormatPart
            : symbolFormatPart + numberFormat;
    }
}

CurrencyPlugin.modes = ["normal", "headless"];
CurrencyPlugin.getters = ["getCurrencyRate", "getCurrencyFormat"];

uiPluginRegistry.add("odooCurrency", CurrencyPlugin);
