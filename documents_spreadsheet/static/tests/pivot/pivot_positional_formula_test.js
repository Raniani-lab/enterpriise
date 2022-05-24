/** @odoo-module */

import { click } from "@web/../tests/helpers/utils";
import { setCellContent } from "../utils/commands_helpers";
import { getCell, getCellValue } from "../utils/getters_helpers";
import { createSpreadsheetFromPivot } from "../utils/pivot_helpers";
import { getBasicData } from "../utils/spreadsheet_test_data";

QUnit.module("documents_spreadsheet > positional pivot formula", {}, () => {
    QUnit.test("Can have positional args in pivot formula", async function (assert) {
        const { model } = await createSpreadsheetFromPivot();

        // Columns
        setCellContent(model, "H1", `=PIVOT(1,"probability","#foo", 1)`);
        setCellContent(model, "H2", `=PIVOT(1,"probability","#foo", 2)`);
        setCellContent(model, "H3", `=PIVOT(1,"probability","#foo", 3)`);
        setCellContent(model, "H4", `=PIVOT(1,"probability","#foo", 4)`);
        setCellContent(model, "H5", `=PIVOT(1,"probability","#foo", 5)`);
        assert.strictEqual(getCellValue(model, "H1"), 11);
        assert.strictEqual(getCellValue(model, "H2"), 15);
        assert.strictEqual(getCellValue(model, "H3"), 10);
        assert.strictEqual(getCellValue(model, "H4"), 95);
        assert.strictEqual(getCellValue(model, "H5"), "");

        // Rows
        setCellContent(model, "I1", `=PIVOT(1,"probability","#bar", 1)`);
        setCellContent(model, "I2", `=PIVOT(1,"probability","#bar", 2)`);
        setCellContent(model, "I3", `=PIVOT(1,"probability","#bar", 3)`);
        assert.strictEqual(getCellValue(model, "I1"), 15);
        assert.strictEqual(getCellValue(model, "I2"), 116);
        assert.strictEqual(getCellValue(model, "I3"), "");
    });

    QUnit.test("Can have positional args in pivot headers formula", async function (assert) {
        const { model } = await createSpreadsheetFromPivot();
        // Columns
        setCellContent(model, "H1", `=PIVOT.HEADER(1,"#foo",1)`);
        setCellContent(model, "H2", `=PIVOT.HEADER(1,"#foo",2)`);
        setCellContent(model, "H3", `=PIVOT.HEADER(1,"#foo",3)`);
        setCellContent(model, "H4", `=PIVOT.HEADER(1,"#foo",4)`);
        setCellContent(model, "H5", `=PIVOT.HEADER(1,"#foo",5)`);
        setCellContent(model, "H6", `=PIVOT.HEADER(1,"#foo",5, "measure", "probability")`);
        assert.strictEqual(getCellValue(model, "H1"), 1);
        assert.strictEqual(getCellValue(model, "H2"), 2);
        assert.strictEqual(getCellValue(model, "H3"), 12);
        assert.strictEqual(getCellValue(model, "H4"), 17);
        assert.strictEqual(getCellValue(model, "H5"), "");
        assert.strictEqual(getCellValue(model, "H6"), "Probability");

        // Rows
        setCellContent(model, "I1", `=PIVOT.HEADER(1,"#bar",1)`);
        setCellContent(model, "I2", `=PIVOT.HEADER(1,"#bar",2)`);
        setCellContent(model, "I3", `=PIVOT.HEADER(1,"#bar",3)`);
        setCellContent(model, "I4", `=PIVOT.HEADER(1,"#bar",3, "measure", "probability")`);
        assert.strictEqual(getCellValue(model, "I1"), "No");
        assert.strictEqual(getCellValue(model, "I2"), "Yes");
        assert.strictEqual(getCellValue(model, "I3"), "");
        assert.strictEqual(getCellValue(model, "I4"), "Probability");
    });

    QUnit.test("pivot positional with two levels of group bys in rows", async (assert) => {
        const productModelName = 'Product';
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelector("tbody .o_pivot_header_cell_closed"));
                const models = target.querySelectorAll(`.dropdown-item`);
                const productElement = [...models].filter(el => el.innerText === productModelName)[0];
                await click(productElement);
            },
        });
        // Rows Headers
        setCellContent(model, "H1", `=PIVOT.HEADER(1,"bar","false","#product_id",1)`);
        setCellContent(model, "H2", `=PIVOT.HEADER(1,"bar","true","#product_id",1)`);
        setCellContent(model, "H3", `=PIVOT.HEADER(1,"#bar",1,"#product_id",1)`);
        setCellContent(model, "H4", `=PIVOT.HEADER(1,"#bar",2,"#product_id",1)`);
        setCellContent(model, "H5", `=PIVOT.HEADER(1,"#bar",3,"#product_id",1)`);
        assert.strictEqual(getCellValue(model, "H1"), "xpad");
        assert.strictEqual(getCellValue(model, "H2"), "xphone");
        assert.strictEqual(getCellValue(model, "H3"), "xpad");
        assert.strictEqual(getCellValue(model, "H4"), "xphone");
        assert.strictEqual(getCellValue(model, "H5"), "");

        // Cells
        setCellContent(model, "H1", `=PIVOT(1,"probability","#bar",1,"#product_id",1,"#foo",2)`);
        setCellContent(model, "H2", `=PIVOT(1,"probability","#bar",1,"#product_id",2,"#foo",2)`);
        assert.strictEqual(getCellValue(model, "H1"), 15);
        assert.strictEqual(getCellValue(model, "H2"), "");
    });

    QUnit.test("Positional argument without a number should crash", async (assert) => {
        const { model } = await createSpreadsheetFromPivot();
        setCellContent(model, "A10", `=PIVOT.HEADER(1,"#bar","this is not a number")`);
        assert.strictEqual(getCellValue(model, "A10"), "#ERROR");
        assert.strictEqual(
            getCell(model, "A10").evaluated.error,
            "The function PIVOT.HEADER expects a number value, but 'this is not a number' is a string, and cannot be coerced to a number."
        );
    });

    QUnit.test("sort first pivot column (ascending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelector("thead .o_pivot_measure_row"));
            },
        });
        setCellContent(model, "A1", `=PIVOT.HEADER(1,"#bar",1)`);
        setCellContent(model, "A2", `=PIVOT.HEADER(1,"#bar",2)`);
        setCellContent(model, "B1", `=PIVOT(1,"probability","#bar",1,"#foo",1)`);
        setCellContent(model, "B2", `=PIVOT(1,"probability","#bar",2,"#foo",1)`);
        setCellContent(model, "C1", `=PIVOT(1,"probability","#bar",1,"#foo",2)`);
        setCellContent(model, "C2", `=PIVOT(1,"probability","#bar",2,"#foo",2)`);
        setCellContent(model, "D1", `=PIVOT(1,"probability","#bar",1)`);
        setCellContent(model, "D2", `=PIVOT(1,"probability","#bar",2)`);
        assert.strictEqual(getCellValue(model, "A1"), "No");
        assert.strictEqual(getCellValue(model, "A2"), "Yes");
        assert.strictEqual(getCellValue(model, "B1"), "");
        assert.strictEqual(getCellValue(model, "B2"), 11);
        assert.strictEqual(getCellValue(model, "C1"), 15);
        assert.strictEqual(getCellValue(model, "C2"), "");
        assert.strictEqual(getCellValue(model, "D1"), 15);
        assert.strictEqual(getCellValue(model, "D2"), 116);
    });

    QUnit.test("sort first pivot column (descending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelector("thead .o_pivot_measure_row")); // first click toggles ascending
                await click(target.querySelector("thead .o_pivot_measure_row")); // second is descending
            },
        });
        setCellContent(model, "A1", `=PIVOT.HEADER(1,"#bar",1)`);
        setCellContent(model, "A2", `=PIVOT.HEADER(1,"#bar",2)`);
        setCellContent(model, "B1", `=PIVOT(1,"probability","#bar",1,"#foo",1)`);
        setCellContent(model, "B2", `=PIVOT(1,"probability","#bar",2,"#foo",1)`);
        setCellContent(model, "C1", `=PIVOT(1,"probability","#bar",1,"#foo",2)`);
        setCellContent(model, "C2", `=PIVOT(1,"probability","#bar",2,"#foo",2)`);
        setCellContent(model, "D1", `=PIVOT(1,"probability","#bar",1)`);
        setCellContent(model, "D2", `=PIVOT(1,"probability","#bar",2)`);
        assert.strictEqual(getCellValue(model, "A1"), "Yes");
        assert.strictEqual(getCellValue(model, "A2"), "No");
        assert.strictEqual(getCellValue(model, "B1"), 11);
        assert.strictEqual(getCellValue(model, "B2"), "");
        assert.strictEqual(getCellValue(model, "C1"), "");
        assert.strictEqual(getCellValue(model, "C2"), 15);
        assert.strictEqual(getCellValue(model, "D1"), 116);
        assert.strictEqual(getCellValue(model, "D2"), 15);
    });

    QUnit.test("sort second pivot column (ascending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]);
            },
        });
        setCellContent(model, "A1", `=PIVOT.HEADER(1,"#bar",1)`);
        setCellContent(model, "A2", `=PIVOT.HEADER(1,"#bar",2)`);
        setCellContent(model, "B1", `=PIVOT(1,"probability","#bar",1,"#foo",1)`);
        setCellContent(model, "B2", `=PIVOT(1,"probability","#bar",2,"#foo",1)`);
        setCellContent(model, "C1", `=PIVOT(1,"probability","#bar",1,"#foo",2)`);
        setCellContent(model, "C2", `=PIVOT(1,"probability","#bar",2,"#foo",2)`);
        setCellContent(model, "D1", `=PIVOT(1,"probability","#bar",1)`);
        setCellContent(model, "D2", `=PIVOT(1,"probability","#bar",2)`);
        assert.strictEqual(getCellValue(model, "A1"), "Yes");
        assert.strictEqual(getCellValue(model, "A2"), "No");
        assert.strictEqual(getCellValue(model, "B1"), 11);
        assert.strictEqual(getCellValue(model, "B2"), "");
        assert.strictEqual(getCellValue(model, "C1"), "");
        assert.strictEqual(getCellValue(model, "C2"), 15);
        assert.strictEqual(getCellValue(model, "D1"), 116);
        assert.strictEqual(getCellValue(model, "D2"), 15);
    });

    QUnit.test("sort second pivot column (descending)", async (assert) => {
        const { model } = await createSpreadsheetFromPivot({
            actions: async (target) => {
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]); // first click toggles ascending
                await click(target.querySelectorAll("thead .o_pivot_measure_row")[1]); // second is descending
            },
        });
        setCellContent(model, "A1", `=PIVOT.HEADER(1,"#bar",1)`);
        setCellContent(model, "A2", `=PIVOT.HEADER(1,"#bar",2)`);
        setCellContent(model, "B1", `=PIVOT(1,"probability","#bar",1,"#foo",1)`);
        setCellContent(model, "B2", `=PIVOT(1,"probability","#bar",2,"#foo",1)`);
        setCellContent(model, "C1", `=PIVOT(1,"probability","#bar",1,"#foo",2)`);
        setCellContent(model, "C2", `=PIVOT(1,"probability","#bar",2,"#foo",2)`);
        setCellContent(model, "D1", `=PIVOT(1,"probability","#bar",1)`);
        setCellContent(model, "D2", `=PIVOT(1,"probability","#bar",2)`);
        assert.strictEqual(getCellValue(model, "A1"), "No");
        assert.strictEqual(getCellValue(model, "A2"), "Yes");
        assert.strictEqual(getCellValue(model, "B1"), "");
        assert.strictEqual(getCellValue(model, "B2"), 11);
        assert.strictEqual(getCellValue(model, "C1"), 15);
        assert.strictEqual(getCellValue(model, "C2"), "");
        assert.strictEqual(getCellValue(model, "D1"), 15);
        assert.strictEqual(getCellValue(model, "D2"), 116);
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
        setCellContent(model, "A10", `=PIVOT.HEADER(1,"#product_id",1)`);
        setCellContent(model, "A11", `=PIVOT.HEADER(1,"#product_id",2)`);
        setCellContent(model, "B10", `=PIVOT(1,"probability","#product_id",1)`);
        setCellContent(model, "B11", `=PIVOT(1,"probability","#product_id",2)`);
        setCellContent(model, "C10", `=PIVOT(1,"foo","#product_id",1)`);
        setCellContent(model, "C11", `=PIVOT(1,"foo","#product_id",2)`);
        assert.strictEqual(getCellValue(model, "A10"), "xphone");
        assert.strictEqual(getCellValue(model, "A11"), "xpad");
        assert.strictEqual(getCellValue(model, "B10"), 10);
        assert.strictEqual(getCellValue(model, "B11"), 121);
        assert.strictEqual(getCellValue(model, "C10"), 12);
        assert.strictEqual(getCellValue(model, "C11"), 20);
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
        setCellContent(model, "A10", `=PIVOT.HEADER(1,"#product_id",1)`);
        setCellContent(model, "A11", `=PIVOT.HEADER(1,"#product_id",2)`);
        setCellContent(model, "B10", `=PIVOT(1,"probability","#product_id",1)`);
        setCellContent(model, "B11", `=PIVOT(1,"probability","#product_id",2)`);
        setCellContent(model, "C10", `=PIVOT(1,"foo","#product_id",1)`);
        setCellContent(model, "C11", `=PIVOT(1,"foo","#product_id",2)`);
        assert.strictEqual(getCellValue(model, "A10"), "xpad");
        assert.strictEqual(getCellValue(model, "A11"), "xphone");
        assert.strictEqual(getCellValue(model, "B10"), 121);
        assert.strictEqual(getCellValue(model, "B11"), 10);
        assert.strictEqual(getCellValue(model, "C10"), 20);
        assert.strictEqual(getCellValue(model, "C11"), 12);
    });

});
