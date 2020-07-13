odoo.define("documents_spreadsheet.spreadsheet_extended", function (require) {

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const PivotPlugin = require("documents_spreadsheet.PivotPlugin");
    const pluginRegistry = spreadsheet.registries.pluginRegistry;

    pluginRegistry.add("odooPivotPlugin", PivotPlugin);

    return spreadsheet;
});
