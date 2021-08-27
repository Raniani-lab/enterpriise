/** @odoo-module */

import { UNTITLED_SPREADSHEET_NAME } from "../../../constants";
import CommandResult from "../plugins/cancelled_reason";

/**
 * Get the intersection of two arrays
 *
 * @param {Array} a
 * @param {Array} b
 *
 * @private
 * @returns {Array} intersection between a and b
 */
export function intersect(a, b) {
    return a.filter((x) => b.includes(x));
}

/**
 * Create a new empty spreadsheet
 *
 * @param {Function} rpc RPC function
 *
 * @private
 * @returns ID of the newly created spreadsheet
 */
export async function createEmptySpreadsheet(rpc) {
    return rpc({
        model: "documents.document",
        method: "create",
        args: [
            {
                name: UNTITLED_SPREADSHEET_NAME,
                mimetype: "application/o-spreadsheet",
                handler: "spreadsheet",
                raw: "{}",
            },
        ],
    });
}

/**
 * Given an object of form {"1": {...}, "2": {...}, ...} get the maximum ID used
 * in this object
 * If the object has no keys, return 0
 *
 * @param {Object} o an object for which the keys are an ID
 *
 * @returns {number}
 */
export function getMaxObjectId(o) {
    const keys = Object.keys(o);
    if (!keys.length) {
        return 0;
    }
    const nums = keys.map((id) => parseInt(id, 10));
    const max = Math.max(...nums);
    return max;
}

export function checkFiltersTypeValueCombination(type, value) {
    if (value !== undefined) {
        switch (type) {
            case "text":
                if (typeof value !== "string") {
                    return CommandResult.InvalidValueTypeCombination;
                }
                break;
            case "date":
                if (typeof value !== "object" || Array.isArray(value)) {
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
