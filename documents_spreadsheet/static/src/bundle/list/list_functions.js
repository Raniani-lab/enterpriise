/** @odoo-module **/

import { _t } from "web.core";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";

const { args, toString, toNumber } = spreadsheet.helpers;
const { functionRegistry } = spreadsheet.registries;

//--------------------------------------------------------------------------
// Spreadsheet functions
//--------------------------------------------------------------------------

functionRegistry.add("LIST", {
    description: _t("Get the value from a list."),
    compute: function (listId, index, fieldName) {
        const id = toString(listId);
        const position = toNumber(index) - 1;
        const field = toString(fieldName);
        return this.getters.getListCellValue(id, position, field);
    },
    args: args(`
        list_id (string) ${_t("ID of the list.")}
        index (string) ${_t("Position of the record in the list.")}
        field_name (string) ${_t("Name of the field.")}
    `),
    returns: ["NUMBER", "STRING"],
});

functionRegistry.add("LIST.HEADER", {
    description: _t("Get the header of a list."),
    compute: function (listId, fieldName) {
        const id = toString(listId);
        const field = toString(fieldName);
        return this.getters.getListHeaderValue(id, field);
    },
    args: args(`
        list_id (string) ${_t("ID of the list.")}
        field_name (string) ${_t("Name of the field.")}
    `),
    returns: ["NUMBER", "STRING"],
});
