/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { DataSource } from "../data_sources/data_source";
import { ServerData } from "../data_sources/server_data";
const { EventBus } = owl;

export class CurrencyDataSource extends DataSource {
    async _load() {
        return true;
    }

    async _createDataSourceModel() {
        this._model = new CurrencyModel(this._orm);
        this._model.addEventListener("currency-fetched", () => this._notify());
        this._notify();
    }

    /**
     * Get the currency rate between the two given currencies
     * @param {string} from Currency from
     * @param {string} to Currency to
     * @param {string|undefined} date
     * @returns {number|undefined}
     */
    getCurrencyRate(from, to, date) {
        return this._model && this._model.getCurrencyRate(from, to, date);
    }
}

class CurrencyModel extends EventBus {
    constructor(orm) {
        super();
        this._orm = orm;

        /**
         * Rates values
         */
        this._rates = {};
        this.serverData = new ServerData(this._orm, {
            whenDataIsFetched: () => this.trigger("currency-fetched"),
        });
    }

    /**
     * Get the currency rate between the two given currencies
     * @param {string} from Currency from
     * @param {string} to Currency to
     * @param {string|undefined} date
     * @returns {number|undefined}
     */
    getCurrencyRate(from, to, date) {
        const data = this.serverData.batch.get("res.currency.rate", "get_rates_for_spreadsheet", {
            from,
            to,
            date,
        });
        const rate = data !== undefined ? data.rate : undefined;
        if (rate === false) {
            throw new Error(_t("Currency rate unavailable."));
        }
        return rate;
    }
}
