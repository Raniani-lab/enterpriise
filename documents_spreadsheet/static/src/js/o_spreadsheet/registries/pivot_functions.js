/** @odoo-module alias=documents_spreadsheet.pivot_functions **/

import { _t } from "web.core";
import { fetchLabel, formatDate } from "../helpers/pivot_helpers";
import spreadsheet from "../o_spreadsheet_loader";
const { args, toString } = spreadsheet.helpers;
const { functionRegistry } = spreadsheet.registries;

//--------------------------------------------------------------------------
// Spreadsheet functions
//--------------------------------------------------------------------------

functionRegistry
    .add("FILTER_VALUE", {
        description: _t("Return the current value of a spreadsheet filter."),
        compute: async function (filterName) {
            return this.getters.getFilterDisplayValue(filterName)
        },
        async: true,
        args: args(`
            filter_name (string) ${_t("The label of the filter whose value to return.")}
        `),
        returns: ["STRING"],
    })
    .add("PIVOT", {
        description: _t("Get the value from a pivot."),
        compute: async function (pivotId, measureName, ...domain) {
            const pivot = _getPivot(this.getters, pivotId);
            const measure = toString(measureName);
            _sanitizeArgs(pivot, measure, domain);
            const cache = await this.getters.getAsyncCache(pivot.id);
            const operator = pivot.measures.filter((m) => m.field === measure)[0].operator;
            cache.markAsValueUsed(domain, measure);
            return cache.getMeasureValue(this, measure, operator, domain);
        },
        async: true,
        args: args(`
        pivot_id (string) ${_t("ID of the pivot.")}
        measure_name (string) ${_t("Name of the measure.")}
        domain_field_name (string,optional,repeating) ${_t("Field name.")}
        domain_value (string,optional,repeating) ${_t("Value.")}
    `),
        returns: ["NUMBER", "STRING"],
    })
    .add("PIVOT_HEADER", {
        description: _t("Get the header of a pivot."),
        compute: async function (pivotId, ...domain) {
            const pivot = _getPivot(this.getters, pivotId);
            const cache = await this.getters.getAsyncCache(pivot.id);
            cache.markAsHeaderUsed(domain);
            const len = domain.length;
            if (len === 0) {
                return _t("Total");
            }
            const field = toString(domain[len - 2]);
            const value = toString(domain[len - 1]);
            if (field === "measure") {
                if (value === "__count") {
                    return _t("Count");
                }
                return cache.getField(value).string;
            } else {
                return (await _getValue(pivot, cache, this.env.services.rpc, field, value)) || "";
            }
        },
        async: true,
        args: args(`
        pivot_id (string) ${_t("ID of the pivot.")}
        domain_field_name (string,optional,repeating) ${_t("Field name.")}
        domain_value (string,optional,repeating) ${_t("Value.")}
    `),
        returns: ["NUMBER", "STRING"],
    })
    .add("PIVOT.POSITION", {
        description: _t("Get the absolute ID of an element in the pivot"),
        compute: function () {
            throw new Error(
                _t(`[[FUNCTION_NAME]] cannot be called from the spreadsheet.`)
            );
        },
        args: args(`
            pivot_id (string) ${_t("ID of the pivot.")}
            field_name (string) ${_t("Name of the field.")}
            position (number) ${_t("Position in the pivot")}
        `),
        returns: ["STRING"],
    });

//--------------------------------------------------------------------------
// Private
//--------------------------------------------------------------------------

/**
 * Get the pivot object with the given ID
 * @param {Object} getters (See EvalContext.getters in o-spreadsheet)
 * @param {string} pivotId Id of the pivot
 *
 * @private
 * @returns {Pivot}
 */
function _getPivot(getters, pivotId) {
    pivotId = toString(pivotId);
    const pivot = getters.getPivot(pivotId);
    if (!pivot) {
        throw new Error(_.str.sprintf(_t('There is no pivot with id "%s"'), pivotId));
    }
    return pivot;
}
/**
 * Return the label to display from a value and a field
 * @param {Pivot} pivot
 * @param {Function} rpc
 * @param {string} field
 * @param {string} value
 * @returns {Promise<string | undefined>}
 */
async function _getValue(pivot, cache, rpc, field, value) {
    const undef = _t("(Undefined)");
    if (
        !cache.isGroupLabelLoaded(field, value) &&
        cache.getField(field.split(":")[0]).relation &&
        value !== "false"
    ) {
        await fetchLabel(cache, rpc, field, value);
    }
    if (["date", "datetime"].includes(cache.getField(field.split(":")[0]).type)) {
        return formatDate(field, value);
    }
    return cache.getGroupLabel(field, value) || undef;
}
/**
 * Sanitize arguments given to the PIVOT function
 *
 * @private
 * @param {Pivot} pivot pivot
 * @param {string} measure Name of the measure
 * @param {Array<string>} domain domain (list of field and value)
 *
 */
function _sanitizeArgs(pivot, measure, domain) {
    if (domain.length % 2 !== 0) {
        throw new Error(_t("Function PIVOT takes an even number of arguments."));
    }
    if (!pivot.measures.map((elt) => elt.field).includes(measure)) {
        const validMeasures = `(${pivot.measure.map((elt) => elt.field)})`;
        throw new Error(_.str.sprintf(_t("The argument %s is not a valid measure. Here are the measures: %s"), measure, validMeasures));
    }
}
