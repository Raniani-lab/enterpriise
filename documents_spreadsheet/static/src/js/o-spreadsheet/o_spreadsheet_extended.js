odoo.define("documents_spreadsheet.spreadsheet_extended", function (require) {

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const PivotPlugin = require("documents_spreadsheet.PivotPlugin");
    const PivotStructurePlugin = require("documents_spreadsheet.PivotStructurePlugin");
    const FiltersPlugin = require("documents_spreadsheet.FiltersPlugin");
    const corePluginRegistry = spreadsheet.registries.corePluginRegistry;
    const uiPluginRegistry = spreadsheet.registries.uiPluginRegistry;

    corePluginRegistry.add("odooPivotPlugin", PivotPlugin);
    corePluginRegistry.add("odooFiltersPlugin", FiltersPlugin);
    uiPluginRegistry.add("odooPivotStructurePlugin", PivotStructurePlugin);

    return spreadsheet;
});
