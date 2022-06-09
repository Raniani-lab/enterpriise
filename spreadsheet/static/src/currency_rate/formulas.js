/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { formatDate } from "@web/core/l10n/dates";
const { args, toString, toJsDate } = spreadsheet.helpers;
const { functionRegistry } = spreadsheet.registries;
const { DateTime } = luxon;

const SERVER_DATE_FORMAT = "yyyy-MM-dd";

/**
 * For a currency rate formula, we generate the day client side from the date
 * param (which is a number). When this number is transformed into a Date object,
 * it takes the timezone of the browser. With timezone: true, we ensure that it
 * convert the date to the day we want, regardless of the timezone.
 *
 */
function formatDateWithoutTimezone(value) {
    const date = DateTime.fromJSDate(toJsDate(value));
    return formatDate(date, {
        timezone: true,
        format: SERVER_DATE_FORMAT,
    });
}

functionRegistry.add("ODOO.CURRENCY.RATE", {
    description: _t(
        "This function takes in two currency codes as arguments, and returns the exchange rate from the first currency to the second as float."
    ),
    compute: function (currencyFrom, currencyTo, date) {
        const from = toString(currencyFrom);
        const to = toString(currencyTo);
        const _date = date ? formatDateWithoutTimezone(date) : undefined;
        return this.getters.getCurrencyRate(from, to, _date);
    },
    args: args(`
            currency_from (string) ${_t("First currency code.")}
            currency_to (string) ${_t("Second currency code.")}
            date (date, optional) ${_t("Date of the rate.")}
        `),
    returns: ["NUMBER"],
});
