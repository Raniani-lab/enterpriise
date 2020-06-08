odoo.define("documents_spreadsheet.menu_item_registry", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const core = require("web.core");

    const _t = core._t;
    const menuItemRegistry = spreadsheet.registries.menuItemRegistry;

    //--------------------------------------------------------------------------
    // Spreadsheet context menu items
    //--------------------------------------------------------------------------

    menuItemRegistry.add("file", { name: _t("File"), sequence: 10 });
    menuItemRegistry.addChild("new_sheet", ["file"], {
        name: _t("New"),
        sequence: 10,
        action: (env) => env.newSpreadsheet(),
    })
    menuItemRegistry.addChild("make_copy", ["file"], {
        name: _t("Make a copy"),
        sequence: 20,
        action: (env) => env.makeCopy(),
    })
    menuItemRegistry.addChild("save", ["file"], {
        name: _t("Save"),
        sequence: 30,
        action: (env) => env.saveData(),
    })
});
