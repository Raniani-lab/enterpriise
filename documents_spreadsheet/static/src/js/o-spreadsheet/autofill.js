odoo.define("documents_spreadsheet.autofill", function (require) {
    "use strict";

    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const autofillRulesRegistry = spreadsheet.registries.autofillRulesRegistry;
    const autofillModifiersRegistry = spreadsheet.registries.autofillModifiersRegistry;

    //--------------------------------------------------------------------------
    // Autofill Rules
    //--------------------------------------------------------------------------

    autofillRulesRegistry.add("autofill_pivot", {
        condition: (cell) => cell && cell.type === "formula" && cell.content.match(/=\s*PIVOT/),
        generateRule: (cell, cells) => {
            const increment = cells.filter(
                (cell) => cell && cell.type === "formula" && cell.content.match(/=\s*PIVOT/)
            ).length;
            return { type: "PIVOT_UPDATER", increment, current: 0 };
        },
        sequence: 1,
    });

    //--------------------------------------------------------------------------
    // Autofill Modifier
    //--------------------------------------------------------------------------

    autofillModifiersRegistry.add("PIVOT_UPDATER", {
        apply: (rule, data, getters, direction) => {
            rule.current += rule.increment;
            let isColumn;
            let steps;
            switch (direction) {
                case 0: //UP
                    isColumn = false;
                    steps = -rule.current;
                    break;
                case 1: //DOWN
                    isColumn = false;
                    steps = rule.current;
                    break;
                case 2: //LEFT
                    isColumn = true;
                    steps = -rule.current;
                    break;
                case 3: //RIGHT
                    isColumn = true;
                    steps = rule.current;
            }
            return {
                style: undefined,
                format: undefined,
                border: undefined,
                content: getters.getNextValue(data.content, isColumn, steps)
            };
        },
    });
});
