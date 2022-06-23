/** @odoo-module */

import spreadsheet from "./o_spreadsheet_extended";
const { load, CorePlugin, tokenize } = spreadsheet;
const { corePluginRegistry } = spreadsheet.registries;

export const ODOO_VERSION = 1;

const MAP = {
    PIVOT: "ODOO.PIVOT",
    "PIVOT.HEADER": "ODOO.PIVOT.HEADER",
    "PIVOT.POSITION": "ODOO.PIVOT.POSITION",
    "FILTER.VALUE": "ODOO.FILTER.VALUE",
    LIST: "ODOO.LIST",
    "LIST.HEADER": "ODOO.LIST.HEADER",
};

export function migrate(data) {
    let _data = load(data);
    const version = _data.odooVersion || 0;
    if (version < 1) {
        _data = migrate0to1(_data);
    }
    return _data;
}

function tokensToString(tokens) {
    return tokens.reduce((acc, token) => acc + token.value, "");
}

function migrate0to1(data) {
    for (const sheet of data.sheets) {
        for (const xc in sheet.cells || []) {
            const cell = sheet.cells[xc];
            if (cell.content && cell.content.startsWith("=")) {
                const tokens = tokenize(cell.content);
                for (const token of tokens) {
                    if (token.type === "SYMBOL" && token.value.toUpperCase() in MAP) {
                        token.value = MAP[token.value.toUpperCase()];
                    }
                }
                cell.content = tokensToString(tokens);
            }
        }
    }
    return data;
}

export default class OdooVersion extends CorePlugin {
    export(data) {
        data.odooVersion = ODOO_VERSION;
    }
}

OdooVersion.getters = [];

corePluginRegistry.add("odooMigration", OdooVersion);
