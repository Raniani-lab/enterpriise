/** @odoo-module */

import { migrate, ODOO_VERSION } from "@spreadsheet/o_spreadsheet/migration";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

const { Model } = spreadsheet;

QUnit.module("spreadsheet > migrations");

QUnit.test("Odoo formulas are migrated", (assert) => {
    const data = {
        sheets: [
            {
                cells: {
                    A1: { content: `=PIVOT("1")` },
                    A2: { content: `=PIVOT.HEADER("1")` },
                    A3: { content: `=FILTER.VALUE("1")` },
                    A4: { content: `=LIST("1")` },
                    A5: { content: `=LIST.HEADER("1")` },
                    A6: { content: `=PIVOT.POSITION("1")` },
                    A7: { content: `=pivot("1")` },
                },
            },
        ],
    };
    const migratedData = migrate(data);
    assert.strictEqual(migratedData.sheets[0].cells.A1.content, `=ODOO.PIVOT("1")`);
    assert.strictEqual(migratedData.sheets[0].cells.A2.content, `=ODOO.PIVOT.HEADER("1")`);
    assert.strictEqual(migratedData.sheets[0].cells.A3.content, `=ODOO.FILTER.VALUE("1")`);
    assert.strictEqual(migratedData.sheets[0].cells.A4.content, `=ODOO.LIST("1")`);
    assert.strictEqual(migratedData.sheets[0].cells.A5.content, `=ODOO.LIST.HEADER("1")`);
    assert.strictEqual(migratedData.sheets[0].cells.A6.content, `=ODOO.PIVOT.POSITION("1")`);
    assert.strictEqual(migratedData.sheets[0].cells.A7.content, `=ODOO.PIVOT("1")`);
});

QUnit.test("Pivot 'day' arguments are migrated", (assert) => {
    const data = {
        odooVersion: 1,
        sheets: [
            {
                cells: {
                    A1: { content: `=ODOO.PIVOT("1","21/07/2022")` },
                    A2: { content: `=ODOO.PIVOT.HEADER("1","11/12/2022")` },
                    A3: { content: `=odoo.pivot("1","21/07/2021")` },
                    A4: { content: `=ODOO.PIVOT("1","test")` },
                    A5: { content: `=odoo.pivot("1","21/07/2021")+"21/07/2021"` },
                    A6: { content: `=BAD_FORMULA(` },
                },
            },
        ],
    };
    const migratedData = migrate(data);
    assert.strictEqual(migratedData.sheets[0].cells.A1.content, `=ODOO.PIVOT("1","07/21/2022")`);
    assert.strictEqual(migratedData.sheets[0].cells.A2.content, `=ODOO.PIVOT.HEADER("1","12/11/2022")`);
    assert.strictEqual(migratedData.sheets[0].cells.A3.content, `=odoo.pivot("1","07/21/2021")`);
    assert.strictEqual(migratedData.sheets[0].cells.A4.content, `=ODOO.PIVOT("1","test")`);
    assert.strictEqual(migratedData.sheets[0].cells.A5.content, `=odoo.pivot("1","07/21/2021")+"21/07/2021"`);
    assert.strictEqual(migratedData.sheets[0].cells.A6.content, `=BAD_FORMULA(`);
});

QUnit.test("Odoo version is exported", (assert) => {
    const model = new Model();
    assert.strictEqual(model.exportData().odooVersion, ODOO_VERSION);
});
