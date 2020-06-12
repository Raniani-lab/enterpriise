odoo.define("documents_spreadsheet.pivot_functions", function (require) {
    "use strict";

    const core = require("web.core");
    const pivotUtils = require("documents_spreadsheet.pivot_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");

    const _t = core._t;
    const args = spreadsheet.helpers.args;
    const functionRegistry = spreadsheet.registries.functionRegistry;
    const toString = spreadsheet.helpers.toString;

    //--------------------------------------------------------------------------
    // Spreadsheet functions
    //--------------------------------------------------------------------------

    functionRegistry
        .add("PIVOT", {
            description: _t("Get the value from a pivot."),
            compute: async function (pivotId, measureName, ...domain) {
                const pivot = _getPivot(this.getters, pivotId);
                const measure = toString(measureName);
                _sanitizeArgs(pivot, measure, ...domain);
                await pivotUtils.fetchCache(pivot, this.env.services.rpc);
                const values = _computeValues(pivot, ...domain);
                return _computeValueToReturn(this, values, pivot, measure);
            },
            async: true,
            args: args(`
            pivot_id (string) ${_t("ID of the pivot.")}
            measure_name (string) ${_t("Name of the measure.")}
            domains (string,optional,repeating) ${_t("Domains list.")}
        `),
            // When multi-optional arguments will be implemented:
            // args: args`
            //     pivot_id (string) ID of the pivot.
            //     measure_name (string) Name of the measure.
            //     domains (string,optional,repeating) Field name of the domain.
            //     values (string,optional,repeating) Value for a domain.
            // `,
            returns: ["NUMBER", "STRING"],
        })
        .add("PIVOT_HEADER", {
            description: _t("Get the header of a pivot."),
            compute: async function (pivotId, ...domain) {
                const pivot = _getPivot(this.getters, pivotId);
                await pivotUtils.fetchCache(pivot, this.env.services.rpc);

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
                    return pivot.cache.fields[value].string;
                } else {
                    return await _getValue(pivot, this.env.services.rpc, field, value);
                }
            },
            async: true,
            args: args(`
            pivot_id (string) ${_t("ID of the pivot.")}
            domains (string,optional,repeating) ${_t("Domains list.")}
        `),
            returns: ["NUMBER", "STRING"],
        });

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Compute the values corresponding to a pivot and a given domain
     *
     * For that, we take the intersection of all group_bys
     *
     * @private
     * @param {Object} pivot Pivot object
     * @param  {Array<string>} domain Domain
     *
     * @returns List of values to return
     */
    function _computeValues(pivot, ...domain) {
        let returnValue = pivot.cache.cacheKeys;
        let i = 0;
        while (i < domain.length && returnValue.length) {
            const field = toString(domain[i]);
            if (!(field in pivot.cache.groupBys)) {
                return "";
            }
            const value = toString(domain[i + 1]);
            if (!(value in pivot.cache.groupBys[field])) {
                return "";
            }
            const dimension = pivot.cache.groupBys[field] && pivot.cache.groupBys[field][value];
            returnValue = dimension.filter((x) => returnValue.includes(x));
            //returnValue = returnValue.filter(x => dimension.includes(x));
            i += 2;
        }
        return returnValue;
    }


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
     */
    async function _getValue(pivot, rpc, field, value) {
        const undef = _t("(Undefined)");
        if (!(value in pivot.cache.labels[field]) && pivot.cache.fields[field.split(":")[0]].relation) {
            await pivotUtils.fetchLabel(pivot, rpc, field, value);
        }
        if (["date", "datetime"].includes(pivot.cache.fields[field.split(":")[0]].type)) {
            return pivotUtils.formatDate(field, value);
        }
        return pivot.cache.labels[field][value] || undef;
    }
    /**
     * Process the values computed to return one value
     *
     * @private
     * @param {Object} evalContext (See EvalContext in o-spreadsheet)
     * @param {number[]} values List of values
     * @param {Pivot} pivot Pivot object
     * @param {string} measure Name of the measure
     *
     * @returns Computed value
     */
    function _computeValueToReturn(evalContext, values, pivot, measure) {
        if (values.length === 0) {
            return "";
        }
        if (values.length === 1) {
            return pivot.cache.values[values[0]][measure] || "";
        }
        const operator = pivot.measures.filter((x) => x.field === measure)[0].operator;
        switch (operator) {
            case "array_agg":
                throw Error(_.str.sprintf(_t("Not implemented: %s"), operator));
            case "count":
                return evalContext.COUNT(...values.map((x) => pivot.cache.values[x][measure] || 0));
            case "count_distinct":
                return evalContext.COUNTUNIQUE(
                    ...values.map((x) => pivot.cache.values[x][measure] || 0)
                );
            case "bool_and":
                return evalContext.AND(...values.map((x) => pivot.cache.values[x][measure] || 0));
            case "bool_or":
                return evalContext.OR(...values.map((x) => pivot.cache.values[x][measure] || 0));
            case "max":
                return evalContext.MAX(...values.map((x) => pivot.cache.values[x][measure] || 0));
            case "min":
                return evalContext.MIN(...values.map((x) => pivot.cache.values[x][measure] || 0));
            case "avg":
                return evalContext["AVERAGE.WEIGHTED"](
                    ...values
                        .map((x) => [
                            pivot.cache.values[x][measure] || 0,
                            pivot.cache.values[x]["count"],
                        ])
                        .flat()
                );
            case "sum":
                return evalContext.SUM(...values.map((x) => pivot.cache.values[x][measure] || 0));
            default:
                console.warn(_.str.sprintf(_t("Unknown operator: %s"), operator));
                return "";
        }
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
    function _sanitizeArgs(pivot, measure, ...domain) {
        if (domain.length % 2 !== 0) {
            throw new Error(_t("Function PIVOT takes an even number of arguments."));
        }
        if (!pivot.measures.map((elt) => elt.field).includes(measure)) {
            const validMeasures = `(${pivot.measure.map((elt) => elt.field)})`;
            throw new Error(_.str.sprintf(_t("The argument %s is not a valid measure. Here are the measures: %s"), measure, validMeasures));
        }
    }
});
