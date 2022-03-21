/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { DataSource } from "../o_spreadsheet/data_sources/data_source";
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

class CurrencyModel extends EventBus{
    constructor(orm) {
        super();
        this._orm = orm;

        /**
         * Rates values
         */
        this._rates = {};

        /**
         * Pending currencies to fetch during the next clock
         */
        this._pending = [];

        /**
         * Control the fetching
         */
        this._fetchingPromise = undefined;
    }


    /**
     * Get the currency rate between the two given currencies
     * @param {string} from Currency from
     * @param {string} to Currency to
     * @param {string|undefined} date
     * @returns {number|undefined}
     */
    getCurrencyRate(from, to, date) {
        const key = this._getCacheKey(from, to, date);
        if (!(key in this._rates)) {
            this._rates[key] = undefined;
            this._pending.push({ from, to, date });
            this._triggerFetching();
            return undefined;
        }
        const rate = this._rates[key];
        if (rate instanceof Error) {
            throw rate;
        }
        return rate;
    }

    _getCacheKey(from, to, date) {
        return JSON.stringify({ from, to, date });
    }

    /**
     * Trigger the fetching of currency rates during the next clock
     */
    _triggerFetching() {
        if (this._fetchingPromise) {
            return;
        }
        this._fetchingPromise = Promise.resolve().then(() => {
            new Promise(async (resolve) => {
                const rates = [...new Set(this._pending)];
                this._pending = [];
                const records = await this._orm.call(
                    "res.currency.rate",
                    "get_rates_for_spreadsheet",
                    [rates]
                );
                for (const record of records) {
                    this._rates[this._getCacheKey(record.from, record.to, record.date)] = record.rate
                        ? record.rate
                        : new Error(_t("Currency rate unavailable."));
                }
                this._fetchingPromise = undefined;
                this.trigger("currency-fetched");
                resolve();
            });
        });
    }
}
