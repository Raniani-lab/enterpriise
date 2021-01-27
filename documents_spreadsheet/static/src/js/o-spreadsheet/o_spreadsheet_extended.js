odoo.define("documents_spreadsheet.spreadsheet_extended", function (require) {

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const PivotPlugin = require("documents_spreadsheet.PivotPlugin");
    const FiltersPlugin = require("documents_spreadsheet.FiltersPlugin");
    const corePluginRegistry = spreadsheet.registries.corePluginRegistry;

    corePluginRegistry.add("odooPivotPlugin", PivotPlugin);
    corePluginRegistry.add("odooFiltersPlugin", FiltersPlugin);

    return spreadsheet;
});
