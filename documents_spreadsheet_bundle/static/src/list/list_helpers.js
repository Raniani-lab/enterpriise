/** @odoo-module */

import { getOdooFunctions } from "../o_spreadsheet/odoo_functions_helpers";

/**
 * Parse a spreadsheet formula and detect the number of LIST functions that are
 * present in the given formula.
 *
 * @param {string} formula
 *
 * @returns {number}
 */
export function getNumberOfListFormulas(formula) {
    return getOdooFunctions(formula, (functionName) =>
      ["LIST", "LIST.HEADER"].includes(functionName)
    ).filter((fn) => fn.isMatched).length;
  }

  /**
   * Get the first List function description of the given formula.
   *
   * @param {string} formula
   *
   * @returns {import("../o_spreadsheet/odoo_functions_helpers").OdooFunctionDescription|undefined}
   */
  export function getFirstListFunction(formula) {
    return getOdooFunctions(formula, (functionName) =>
      ["LIST", "LIST.HEADER"].includes(functionName)
    ).find((fn) => fn.isMatched);
  }
