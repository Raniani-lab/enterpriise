/** @odoo-module */

import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import { waitForDataSourcesLoaded } from "../spreadsheet_test_utils";

const { toCartesian, toZone } = spreadsheet.helpers;

/**
 * Select a cell
 */
export function selectCell(model, xc) {
    const { col, row } = toCartesian(xc);
    return model.selection.selectCell(col, row);
}

/**
 * Add a global filter and ensure the data sources are completely reloaded
 */
export async function addGlobalFilter(model, filter) {
    const result = model.dispatch("ADD_GLOBAL_FILTER", filter);
    await waitForDataSourcesLoaded(model);
    return result;
}

/**
 * Remove a global filter and ensure the data sources are completely reloaded
 */
export async function removeGlobalFilter(model, id) {
    const result = model.dispatch("REMOVE_GLOBAL_FILTER", { id });
    await waitForDataSourcesLoaded(model);
    return result;
}

/**
 * Edit a global filter and ensure the data sources are completely reloaded
 */
export async function editGlobalFilter(model, filter) {
    const result = model.dispatch("EDIT_GLOBAL_FILTER", filter);
    await waitForDataSourcesLoaded(model);
    return result;
}

/**
 * Set the value of a global filter and ensure the data sources are completely
 * reloaded
 */
export async function setGlobalFilterValue(model, payload) {
    const result = model.dispatch("SET_GLOBAL_FILTER_VALUE", payload);
    await waitForDataSourcesLoaded(model);
    return result;
}

/**
 * Set the selection
 */
export function setSelection(model, xc) {
    const zone = toZone(xc);
    model.selection.selectZone({ cell: { col: zone.left, row: zone.top }, zone });
}

/**
 * Autofill from a zone to a cell
 */
export function autofill(model, from, to) {
    setSelection(model, from);
    model.dispatch("AUTOFILL_SELECT", toCartesian(to));
    model.dispatch("AUTOFILL");
}

/**
 * Set the content of a cell
 */
export function setCellContent(model, xc, content, sheetId = model.getters.getActiveSheetId()) {
    model.dispatch("UPDATE_CELL", { ...toCartesian(xc), sheetId, content });
}
