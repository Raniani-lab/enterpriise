/** @odoo-module */

import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";

const { toCartesian } = spreadsheet.helpers;

/**
 * Get the value of the given cell
 */
export function getCellValue(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const { col, row } = toCartesian(xc);
    const cell = model.getters.getCell(sheetId, col, row);
    if (!cell) {
        return undefined;
    }
    return cell.evaluated.value;
}

/**
 * Get the computed value that would be autofilled starting from the given xc.
 * The starting xc should contains a Pivot formula
 */
export function getPivotAutofillValue(model, xc, { direction, steps }) {
    const content = getCellFormula(model, xc);
    const column = ["left", "right"].includes(direction);
    const increment = ["left", "top"].includes(direction) ? -steps : steps;
    return model.getters.getPivotNextAutofillValue(content, column, increment);
}

/**
 * Get the computed value that would be autofilled starting from the given xc.
 * The starting xc should contains a List formula
 */
export function getListAutofillValue(model, xc, { direction, steps }) {
    const content = getCellFormula(model, xc);
    const column = ["left", "right"].includes(direction);
    const increment = ["left", "top"].includes(direction) ? -steps : steps;
    return model.getters.getNextListValue(content, column, increment);
}

/**
 * Get the cell of the given xc
 */
export function getCell(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const { col, row } = toCartesian(xc);
    return model.getters.getCell(sheetId, col, row);
}

/**
 * Get the cells of the given sheet (or active sheet if not provided)
 */
export function getCells(model, sheetId = model.getters.getActiveSheetId()) {
    return model.getters.getCells(sheetId);
}

/**
 * Get the formula of the given xc
 */
export function getCellFormula(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = getCell(model, xc, sheetId);
    return cell && cell.isFormula() ? model.getters.getFormulaCellContent(sheetId, cell) : "";
}

/**
 * Get the content of the given xc
 */
export function getCellContent(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = getCell(model, xc, sheetId);
    return cell ? model.getters.getCellText(cell, sheetId, true) : "";
}

/**
 * Get the list of the merges (["A1:A2"]) of the sheet
 */
export function getMerges(model, sheetId = model.getters.getActiveSheetId()) {
    return model.exportData().sheets.find((sheet) => sheet.id === sheetId).merges;
}
