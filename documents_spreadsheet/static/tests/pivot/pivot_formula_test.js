/** @odoo-module */

import { parsePivotFormulaFieldValue } from "../../src/bundle/pivot/pivot_model";

QUnit.module("spreadsheet pivot formula", {}, () => {
    QUnit.test("parse values of a selection, char or text field", (assert) => {
        for (const fieldType of ["selection", "text", "char"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            assert.strictEqual(parsePivotFormulaFieldValue(field, "won"), "won");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "1"), "1");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "11/2020"), "11/2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "2020"), "2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "01/11/2020"), "01/11/2020");
            assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
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
            assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
            assert.strictEqual(parsePivotFormulaFieldValue(field, "true"), "true"); // this should throw because it's not a valid date
            assert.strictEqual(parsePivotFormulaFieldValue(field, "won"), "won"); // this should throw because it's not a valid date
        }
    });

    QUnit.test("parse values of boolean field", (assert) => {
        const field = {
            type: "boolean",
            string: "A field",
        };
        assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
        assert.strictEqual(parsePivotFormulaFieldValue(field, "true"), true);
        assert.throws(() => parsePivotFormulaFieldValue(field, "11/2020"));
        assert.throws(() => parsePivotFormulaFieldValue(field, "2020"));
        assert.throws(() => parsePivotFormulaFieldValue(field, "01/11/2020"));
        assert.throws(() => parsePivotFormulaFieldValue(field, "1"));
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
            assert.strictEqual(parsePivotFormulaFieldValue(field, "false"), false);
            assert.throws(() => parsePivotFormulaFieldValue(field, "true"));
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
            assert.throws(() => parsePivotFormulaFieldValue(field, "true"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "11/2020"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "2020"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "01/11/2020"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "1"));
            assert.throws(() => parsePivotFormulaFieldValue(field, "won"));
        }
    });

});
