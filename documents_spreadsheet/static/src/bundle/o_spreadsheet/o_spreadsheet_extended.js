/** @odoo-module alias=documents_spreadsheet.spreadsheet */

/** @type {import("./o_spreadsheet")}*/
const spreadsheet = window.o_spreadsheet;
export const initCallbackRegistry = new spreadsheet.Registry();

import { _t } from "@web/core/l10n/translation";
window.o_spreadsheet.setTranslationMethod(_t);

export default spreadsheet;
