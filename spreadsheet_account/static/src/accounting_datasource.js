/** @odoo-module */
import { camelToSnakeObject, sum, toServerDateString } from "@spreadsheet/helpers/helpers";
import { DataSource } from "@spreadsheet/data_sources/data_source";
import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";

import { ServerData } from "@spreadsheet/data_sources/server_data";

const { EventBus } = owl;

/**
 * @typedef {import("./accounting_functions").DateRange} DateRange
 */

export class AccountingDataSource extends DataSource {
    async _load() {
        return true;
    }

    async _createDataSourceModel() {
        /** @type {AccountingModel} */
        this._model = new AccountingModel(this._orm);
        this._model.addEventListener("account-aggregate-fetched", () => this._notify());
        this._model.addEventListener("company-fiscal-year-fetched", () => this._notify());
        // notify that the model now exists and can be called
        this._notify();
    }

    /**
     * Gets the total credit for a given account code prefix
     * @param {string[]} codes prefixes of the accounts codes
     * @param {DateRange} dateRange start date of the period to look
     * @param {number} offset end date of the period to look
     * @param {number} companyId specific company to target
     * @param {boolean} includeUnposted wether or not select unposted entries
     * @returns {number | undefined}
     */
    getCredit(codes, dateRange, offset, companyId, includeUnposted) {
        return this._model && this._model.getCredit(codes, dateRange, offset, companyId, includeUnposted);
    }

    /**
     * Gets the total debit for a given account code prefix
     * @param {string[]} codes prefixes of the accounts codes
     * @param {DateRange} dateRange start date of the period to look
     * @param {number} offset end  date of the period to look
     * @param {number} companyId specific company to target
     * @param {boolean} includeUnposted wether or not select unposted entries
     * @returns {number | undefined}
     */
    getDebit(codes, dateRange, offset, companyId, includeUnposted) {
        return this._model && this._model.getDebit(codes, dateRange, offset, companyId, includeUnposted);
    }

    /**
     * @param {Date} date
     * @param {number | null} companyId
     * @returns {string}
     */
    getFiscalStartDate(date, companyId) {
        return this._model && this._model.getFiscalStartDate(date, companyId);
    }

    /**
     * @param {Date} date
     * @param {number | null} companyId
     * @returns {string}
     */
    getFiscalEndDate(date, companyId) {
        return this._model && this._model.getFiscalEndDate(date, companyId);
    }

    /**
     * @param {number} accountTypeId
     * @returns {string[]}
     */
    getAccountGroupCodes(accountTypeId) {
        return this._model && this._model.getAccountGroupCodes(accountTypeId);
    }
}

class AccountingModel extends EventBus {
    constructor(orm) {
        super();
        this.serverData = new ServerData(orm, {
            whenDataIsFetched: () => this.trigger("account-aggregate-fetched"),
        });
    }

    // %%%%%%%%%%%%%%%%%
    //      PUBLIC
    // %%%%%%%%%%%%%%%%%

    /**
     * Gets the total credit for a given account code prefix
     * @param {string[]} codes prefixes of the accounts codes
     * @param {DateRange} dateRange start date of the period to look
     * @param {number} offset end  date of the period to look
     * @param {number | null} companyId specific companyId to target
     * @param {boolean} includeUnposted wether or not select unposted entries
     * @returns {number}
     */
    getCredit(codes, dateRange, offset, companyId, includeUnposted) {
        const data = this._fetchAccountData(codes, dateRange, offset, companyId, includeUnposted);
        return data.credit;
    }

    /**
     * Gets the total debit for a given account code prefix
     * @param {string[]} codes prefixes of the accounts codes
     * @param {DateRange} dateRange start date of the period to look
     * @param {number} offset end  date of the period to look
     * @param {number | null} companyId specific companyId to target
     * @param {boolean} includeUnposted wether or not select unposted entries
     * @returns {number}
     */
    getDebit(codes, dateRange, offset, companyId, includeUnposted) {
        const data = this._fetchAccountData(codes, dateRange, offset, companyId, includeUnposted);
        return data.debit;
    }

    /**
     * @param {Date} date Date included in the fiscal year
     * @param {number | null} companyId specific company to target
     * @returns {string}
     */
    getFiscalStartDate(date, companyId) {
        return this._fetchCompanyData(date, companyId).start;
    }

    /**
     * @param {Date} date Date included in the fiscal year
     * @param {number | null} companyId specific company to target
     * @returns {string}
     */
    getFiscalEndDate(date, companyId) {
        return this._fetchCompanyData(date, companyId).end;
    }

    /**
     * @param {number} accountTypeId
     * @returns {string[]}
     */
    getAccountGroupCodes(accountTypeId) {
        return this.serverData.batch.get("account.account", "get_account_group", accountTypeId);
    }

    // %%%%%%%%%%%%%%%%%%
    //      PRIVATE
    // %%%%%%%%%%%%%%%%%%

    /**
     * Fetch the account information (credit/debit) for a given account code
     * @param {string[]} codes prefix of the accounts' codes
     * @param {DateRange} dateRange start date of the period to look
     * @param {number} offset end  date of the period to look
     * @param {number | null} companyId specific companyId to target
     * @param {boolean} includeUnposted wether or not select unposted entries
     * @returns {{ debit: number, credit: number }}
     */
    _fetchAccountData(codes, dateRange, offset, companyId, includeUnposted) {
        dateRange.year += offset;
        // Excel dates start at 1899-12-30, we should not support date ranges
        // that do not cover dates prior to it.
        // Unfortunately, this check needs to be done right before the server
        // call as a date to low (year <= 1) can raise an error server side.
        if (dateRange.year < 1900) {
            throw new Error(sprintf(_t("%s is not a valid year."), dateRange.year))
        }
        const results = [];
        let error = undefined;
        // If some payload were to raise an error, we still need to process the others
        // to make sure they are part of the next batch call.
        for (const code of codes) {
            try {
                const result = this.serverData.batch.get(
                    "account.account",
                    "spreadsheet_fetch_debit_credit",
                    camelToSnakeObject({ dateRange, code, companyId, includeUnposted })
                );
                results.push(result);
            } catch (err) {
                error = error || err;
            }
        }
        if (error) {
            throw error;
        }
        return {
            debit: sum(results.map((values) => values.debit)),
            credit: sum(results.map((values) => values.credit)),
        };
    }

    /**
     * Fetch the start and end date of the fiscal year enclosing a given date
     * Defaults on the currentuser company if not provided
     * @param {Date} date
     * @param {number | null} companyId
     * @returns {{start: string, end: string}}
     */
    _fetchCompanyData(date, companyId) {
        const result = this.serverData.batch.get("res.company", "get_fiscal_dates", {
            date: toServerDateString(date),
            company_id: companyId,
        });
        if (result === false) {
            throw new Error(_t("The company fiscal year could not be found."));
        }
        return result;
    }
}
