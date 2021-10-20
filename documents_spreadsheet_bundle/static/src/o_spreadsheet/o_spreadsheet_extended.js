/** @odoo-module alias=documents_spreadsheet.spreadsheet_extended */

import { _t } from "web.core";
import spreadsheet from "./o_spreadsheet_loader";

export const initCallbackRegistry = new spreadsheet.Registry();


const { autofillRulesRegistry } = spreadsheet.registries;

//--------------------------------------------------------------------------
// Autofill Rules
//--------------------------------------------------------------------------

autofillRulesRegistry
    .add("autofill_pivot", {
        condition: (cell) =>
            cell && cell.isFormula() && cell.content.match(/=\s*PIVOT/),
        generateRule: (cell, cells) => {
            const increment = cells.filter(
                (cell) => cell && cell.isFormula() && cell.content.match(/=\s*PIVOT/)
            ).length;
            return { type: "PIVOT_UPDATER", increment, current: 0 };
        },
        sequence: 2,
    })
    .add("autofill_pivot_position", {
        condition: (cell) =>
            cell && cell.isFormula() && cell.content.match(/=.*PIVOT.*PIVOT\.POSITION/),
        generateRule: () => ({ type: "PIVOT_POSITION_UPDATER", current: 0 }),
        sequence: 1,
    });


export default spreadsheet;
