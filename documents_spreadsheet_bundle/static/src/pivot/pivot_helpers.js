/** @odoo-module alias=documents_spreadsheet.pivot_utils default=0 **/

import { _t } from "web.core";
import { removeContextUserInfo } from "@documents_spreadsheet/helpers";
import { formats } from "../o_spreadsheet/constants";
import { getOdooFunctions } from "../o_spreadsheet/odoo_functions_helpers";


export const pivotFormulaRegex = /^=.*PIVOT/;

export const PERIODS = {
  day: _t("Day"),
  week: _t("Week"),
  month: _t("Month"),
  quarter: _t("Quarter"),
  year: _t("Year"),
};

//--------------------------------------------------------------------------
// Public
//--------------------------------------------------------------------------

/**
 * Format a data
 *
 * @param {string} field fieldName:interval
 * @param {string} value
 */
export function formatDate(field, value) {
  const interval = field.split(":")[1];
  const output = formats[interval].display;
  const input = formats[interval].out;
  const date = moment(value, input);
  return date.isValid() ? date.format(output) : _t("(Undefined)");
}

/**
 * Create the pivot object
 *
 * @param {PivotModel} instance of PivotModel
 *
 * @returns {Pivot}
 */
export function sanitizePivot(pivotModel) {
  let measures = _sanitizeFields(
    pivotModel.metaData.activeMeasures,
    pivotModel.metaData.measures
  );
  measures = pivotModel.metaData.activeMeasures.map((measure) => {
    const fieldName = measure.split(":")[0];
    const fieldDesc = pivotModel.metaData.measures[fieldName];
    const operator =
      (fieldDesc.group_operator && fieldDesc.group_operator.toLowerCase()) ||
      (fieldDesc.type === "many2one" ? "count_distinct" : "sum");
    return {
      field: measure,
      operator,
    };
  });
  const rowGroupBys = _sanitizeFields(
    pivotModel.metaData.fullRowGroupBys,
    pivotModel.metaData.fields
  );
  const colGroupBys = _sanitizeFields(
    pivotModel.metaData.fullColGroupBys,
    pivotModel.metaData.fields
  );
  return {
    model: pivotModel.metaData.resModel,
    rowGroupBys,
    colGroupBys,
    measures,
    domain: pivotModel.searchParams.domain,
    context: removeContextUserInfo(pivotModel.searchParams.context),
  };
}

//--------------------------------------------------------------------------
// Private
//--------------------------------------------------------------------------

/**
 * Add a default interval for the date and datetime fields
 *
 * @param {Array<string>} fields List of the fields to sanitize
 * @param {Object} allFields fields_get result
 */
function _sanitizeFields(fields, allFields) {
  return fields.map((field) => {
    let [fieldName, group] = field.split(":");
    const fieldDesc = allFields[fieldName];
    if (["date", "datetime"].includes(fieldDesc.type)) {
      if (!group) {
        group = "month";
      }
      return `${fieldName}:${group}`;
    }
    return fieldName;
  });
}

/**
 * Parse a spreadsheet formula and detect the number of PIVOT functions that are
 * present in the given formula.
 *
 * @param {string} formula
 *
 * @returns {number}
 */
export function getNumberOfPivotFormulas(formula) {
  return getOdooFunctions(formula, (functionName) =>
    ["PIVOT", "PIVOT.HEADER", "PIVOT.POSITION"].includes(functionName)
  ).filter((fn) => fn.isMatched).length;
}

/**
 * Get the first Pivot function description of the given formula.
 *
 * @param {string} formula
 *
 * @returns {import("../o_spreadsheet/odoo_functions_helpers").OdooFunctionDescription|undefined}
 */
export function getFirstPivotFunction(formula) {
  return getOdooFunctions(formula, (functionName) =>
    ["PIVOT", "PIVOT.HEADER", "PIVOT.POSITION"].includes(functionName)
  ).find((fn) => fn.isMatched);
}
