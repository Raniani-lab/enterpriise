/** @odoo-module */

import { click } from "@web/../tests/helpers/utils";
import { parsePivotFormulaFieldValue } from "../../src/bundle/pivot/pivot_model";
import { createModelWithDataSource } from "../spreadsheet_test_utils";
import { getCellValue } from "../utils/getters_helpers";
import { createSpreadsheetFromPivot } from "../utils/pivot_helpers";
import { getBasicData } from "../utils/spreadsheet_test_data";

QUnit.module("documents_spreadsheet > pivot formula", {}, () => {
    QUnit.test("parse values of a selection, char or text field", (assert) => {
        for (const fieldType of ["selection", "text", "char"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            assert.strictEqual(parsePivotFormulaFieldValue(field, "won"), "won");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "1"), "1");
            assert.strictEqual(parsePivotFormulaFieldValue(field, 1), "1");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "11/2020"), "11/2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "2020"), "2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "01/11/2020"), "01/11/2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
            assert.strictEqual(parsePivotFormulaFieldValue(field, false), false);
            assert.strictEqual(parsePivotFormulaFieldValue(field, "true"), "true");
        }
    });

    QUnit.test("parse values of time fields", (assert) => {
        for (const fieldType of ["date", "datetime"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            assert.strictEqual(parsePivotFormulaFieldValue(field, "11/2020"), "11/2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "2020"), "2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "01/11/2020"), "01/11/2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "1"), "1");
            assert.strictEqual(parsePivotFormulaFieldValue(field, 1), "1");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
            assert.strictEqual(parsePivotFormulaFieldValue(field, false), false);
            assert.strictEqual(parsePivotFormulaFieldValue(field, "true"), "true"); // this should throw because it's not a valid date
            assert.strictEqual(parsePivotFormulaFieldValue(field, true), "true"); // this should throw because it's not a valid date
            assert.strictEqual(parsePivotFormulaFieldValue(field, "won"), "won"); // this should throw because it's not a valid date
        }
    });

    QUnit.test("parse values of boolean field", (assert) => {
        const field = {
            type: "boolean",
            string: "A field",
        };
        assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
        assert.strictEqual(parsePivotFormulaFieldValue(field, false), false);
        assert.strictEqual(parsePivotFormulaFieldValue(field, "true"), true);
        assert.strictEqual(parsePivotFormulaFieldValue(field, true), true);
        assert.throws(() => parsePivotFormulaFieldValue(field, "11/2020"));
        assert.throws(() => parsePivotFormulaFieldValue(field, "2020"));
        assert.throws(() => parsePivotFormulaFieldValue(field, "01/11/2020"));
        assert.throws(() => parsePivotFormulaFieldValue(field, "1"));
        assert.throws(() => parsePivotFormulaFieldValue(field, 1));
        assert.throws(() => parsePivotFormulaFieldValue(field, "won"));
    });

    QUnit.test("parse values of numeric fields", (assert) => {
        for (const fieldType of ["float", "integer", "monetary", "many2one"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            assert.strictEqual(parsePivotFormulaFieldValue(field, "2020"), 2020);
            assert.strictEqual(parsePivotFormulaFieldValue(field, "01/11/2020"), 43841); // a date is actually a number in a spreadsheet
            assert.strictEqual(parsePivotFormulaFieldValue(field, "1"), 1);
            assert.strictEqual(parsePivotFormulaFieldValue(field, 1), 1);
            assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
            assert.strictEqual(parsePivotFormulaFieldValue(field, false), false);
            assert.throws(() => parsePivotFormulaFieldValue(field, "true"));
            assert.throws(() => parsePivotFormulaFieldValue(field, true));
            assert.throws(() => parsePivotFormulaFieldValue(field, "won"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "11/2020"));
        }
    });

    QUnit.test("parse values of unsupported fields", (assert) => {
        for (const fieldType of ["one2many", "many2many", "binary", "html"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            assert.throws(() => parsePivotFormulaFieldValue(field, "false"));
            assert.throws(() => parsePivotFormulaFieldValue(field, false));
            assert.throws(() => parsePivotFormulaFieldValue(field, "true"));
            assert.throws(() => parsePivotFormulaFieldValue(field, true));
            assert.throws(() => parsePivotFormulaFieldValue(field, "11/2020"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "2020"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "01/11/2020"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "1"));
            assert.throws(() => parsePivotFormulaFieldValue(field, 1));
            assert.throws(() => parsePivotFormulaFieldValue(field, "won"));
        }
    });

    QUnit.test("sort first pivot column (ascending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelector("thead .o_pivot_measure_row"));
            },
        });
        assert.strictEqual(getCellValue(model, "A3"), "No");
        assert.strictEqual(getCellValue(model, "A4"), "Yes");
        assert.strictEqual(getCellValue(model, "B3"), "");
        assert.strictEqual(getCellValue(model, "B4"), 11);
        assert.strictEqual(getCellValue(model, "C3"), 15);
        assert.strictEqual(getCellValue(model, "C4"), "");
        assert.strictEqual(getCellValue(model, "F3"), 15);
        assert.strictEqual(getCellValue(model, "F4"), 116);
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            groupId: [[], [1]],
            measure: "probability",
            order: "asc",
            originIndexes: [0],
        });
    });

    QUnit.test("sort first pivot column (descending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelector("thead .o_pivot_measure_row")); // first click toggles ascending
                await click(target.querySelector("thead .o_pivot_measure_row")); // second is descending
            },
        });
        assert.strictEqual(getCellValue(model, "A3"), "Yes");
        assert.strictEqual(getCellValue(model, "A4"), "No");
        assert.strictEqual(getCellValue(model, "B3"), 11);
        assert.strictEqual(getCellValue(model, "B4"), "");
        assert.strictEqual(getCellValue(model, "C3"), "");
        assert.strictEqual(getCellValue(model, "C4"), 15);
        assert.strictEqual(getCellValue(model, "F3"), 116);
        assert.strictEqual(getCellValue(model, "F4"), 15);
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            groupId: [[], [1]],
            measure: "probability",
            order: "desc",
            originIndexes: [0],
        });
    });

    QUnit.test("sort second pivot column (ascending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]);
            },
        });
        assert.strictEqual(getCellValue(model, "A3"), "Yes");
        assert.strictEqual(getCellValue(model, "A4"), "No");
        assert.strictEqual(getCellValue(model, "B3"), 11);
        assert.strictEqual(getCellValue(model, "B4"), "");
        assert.strictEqual(getCellValue(model, "C3"), "");
        assert.strictEqual(getCellValue(model, "C4"), 15);
        assert.strictEqual(getCellValue(model, "F3"), 116);
        assert.strictEqual(getCellValue(model, "F4"), 15);
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            groupId: [[], [2]],
            measure: "probability",
            order: "asc",
            originIndexes: [0],
        });
    });

    QUnit.test("sort second pivot column (descending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]); // first click toggles ascending
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]); // second is descending
            },
        });
        assert.strictEqual(getCellValue(model, "A3"), "No");
        assert.strictEqual(getCellValue(model, "A4"), "Yes");
        assert.strictEqual(getCellValue(model, "B3"), "");
        assert.strictEqual(getCellValue(model, "B4"), 11);
        assert.strictEqual(getCellValue(model, "C3"), 15);
        assert.strictEqual(getCellValue(model, "C4"), "");
        assert.strictEqual(getCellValue(model, "F3"), 15);
        assert.strictEqual(getCellValue(model, "F4"), 116);
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            groupId: [[], [2]],
            measure: "probability",
            order: "desc",
            originIndexes: [0],
        });
    });

    QUnit.test("sort second pivot measure (ascending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": /* xml */ `
                        <pivot string="Partners">
                            <field name="product_id" type="row"/>
                            <field name="probability" type="measure"/>
                            <field name="foo" type="measure"/>
                        </pivot>`,
                    "partner,false,search": /* xml */ `<search/>`,
                },
            },
            actions: async (target) => {
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]);
            },
        });
        assert.strictEqual(getCellValue(model, "A3"), "xphone");
        assert.strictEqual(getCellValue(model, "A4"), "xpad");
        assert.strictEqual(getCellValue(model, "B3"), 10);
        assert.strictEqual(getCellValue(model, "B4"), 121);
        assert.strictEqual(getCellValue(model, "C3"), 12);
        assert.strictEqual(getCellValue(model, "C4"), 20);
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            groupId: [[], []],
            measure: "foo",
            order: "asc",
            originIndexes: [0],
        });
    });

    QUnit.test("sort second pivot measure (descending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": /* xml */ `
                        <pivot string="Partners">
                            <field name="product_id" type="row"/>
                            <field name="probability" type="measure"/>
                            <field name="foo" type="measure"/>
                        </pivot>`,
                    "partner,false,search": /* xml */ `<search/>`,
                },
            },
            actions: async (target) => {
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]);
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]);
            },
        });
        assert.strictEqual(getCellValue(model, "A3"), "xpad");
        assert.strictEqual(getCellValue(model, "A4"), "xphone");
        assert.strictEqual(getCellValue(model, "B3"), 121);
        assert.strictEqual(getCellValue(model, "B4"), 10);
        assert.strictEqual(getCellValue(model, "C3"), 20);
        assert.strictEqual(getCellValue(model, "C4"), 12);
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            groupId: [[], []],
            measure: "foo",
            order: "desc",
            originIndexes: [0],
        });
    });

    QUnit.test("can import/export sorted pivot", async (assert) => {
        const spreadsheetData = {
            pivots: {
                1: {
                    id: "1",
                    colGroupBys: ["foo"],
                    domain: [],
                    measures: [{ field: "probability" }],
                    model: "partner",
                    rowGroupBys: ["bar"],
                    sortedColumn: {
                        measure: "probability",
                        order: "asc",
                        groupId: [[], [1]],
                    },
                    name: "A pivot",
                    context: {},
                },
            },
        };
        const model = await createModelWithDataSource({ spreadsheetData });
        assert.deepEqual(model.getters.getPivotDefinition(1).sortedColumn, {
            measure: "probability",
            order: "asc",
            groupId: [[], [1]],
        });
        assert.deepEqual(model.exportData().pivots, spreadsheetData.pivots);
    });
});
