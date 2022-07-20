/** @odoo-module */

import { serializeDate, serializeDateTime } from "@web/core/l10n/dates";
import { Domain } from "@web/core/domain";

import CommandResult from "@spreadsheet/o_spreadsheet/cancelled_reason";
import { RELATIVE_DATE_RANGE_TYPES } from "@spreadsheet/helpers/constants";

export function checkFiltersTypeValueCombination(type, value) {
    if (value !== undefined) {
        switch (type) {
            case "text":
                if (typeof value !== "string") {
                    return CommandResult.InvalidValueTypeCombination;
                }
                break;
            case "date":
                if (typeof value === "string") {
                    const expectedValues = RELATIVE_DATE_RANGE_TYPES.map((val) => val.type);
                    if (!expectedValues.includes(value)) {
                        return CommandResult.InvalidValueTypeCombination;
                    }
                } else if (typeof value !== "object" || Array.isArray(value)) {
                    // not a date
                    return CommandResult.InvalidValueTypeCombination;
                }
                break;
            case "relation":
                if (!Array.isArray(value)) {
                    return CommandResult.InvalidValueTypeCombination;
                }
                break;
        }
    }
    return CommandResult.Success;
}

/**
 * Get a date domain relative to the current date.
 * The domain will span the amount of time specified in rangeType and end the day before the current day.
 *
 *
 * @param {Object} now current time, as luxon time
 * @param {number} offset offset to add to the date
 * @param {"last_month" | "last_week" | "last_year" | "last_three_years"} rangeType
 * @param {string} fieldName
 * @param {"date" | "datetime"} fieldType
 *
 * @returns {Domain|undefined}
 */
export function getRelativeDateDomain(now, offset, rangeType, fieldName, fieldType) {
    let endDate = now.minus({ day: 1 }).endOf("day");
    let startDate = endDate;
    switch (rangeType) {
        case "last_week": {
            const offsetParam = { day: 7 * offset };
            endDate = endDate.plus(offsetParam);
            startDate = now.minus({ day: 7 }).plus(offsetParam);
            break;
        }
        case "last_month": {
            const offsetParam = { day: 30 * offset };
            endDate = endDate.plus(offsetParam);
            startDate = now.minus({ day: 30 }).plus(offsetParam);
            break;
        }
        case "last_year": {
            const offsetParam = { day: 365 * offset };
            endDate = endDate.plus(offsetParam);
            startDate = now.minus({ day: 365 }).plus(offsetParam);
            break;
        }
        case "last_three_years": {
            const offsetParam = { day: 3 * 365 * offset };
            endDate = endDate.plus(offsetParam);
            startDate = now.minus({ day: 3 * 365 }).plus(offsetParam);
            break;
        }
        default:
            return undefined;
    }
    startDate = startDate.startOf("day");

    let leftBound, rightBound;
    if (fieldType === "date") {
        // TODO : simplify this once "serializeDate()" is fixed
        // We have to use setZone utc + keepLocalTime to make sure the date don't change because of
        // timezones in serializeDate.
        leftBound = serializeDate(startDate.setZone("utc", { keepLocalTime: true }));
        rightBound = serializeDate(endDate.setZone("utc", { keepLocalTime: true }));
    } else {
        leftBound = serializeDateTime(startDate);
        rightBound = serializeDateTime(endDate);
    }

    return new Domain(["&", [fieldName, ">=", leftBound], [fieldName, "<=", rightBound]]);
}
