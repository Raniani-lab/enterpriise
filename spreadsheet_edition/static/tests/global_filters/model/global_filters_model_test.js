/** @odoo-module */

import { nextTick } from "@web/../tests/helpers/utils";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { getCellValue } from "@spreadsheet/../tests/utils/getters";
import { addGlobalFilter, selectCell, setCellContent } from "@spreadsheet/../tests/utils/commands";
import { createSpreadsheetWithPivot } from "@spreadsheet/../tests/utils/pivot";

const { registries } = spreadsheet;
const { cellMenuRegistry } = registries;

QUnit.module("spreadsheet_edition > Global filters model", {}, () => {
    QUnit.test("Can set a value from a pivot header context menu", async function (assert) {
        const { env, model } = await createSpreadsheetWithPivot({
            arch: /*xml*/ `
                <pivot>
                    <field name="product_id" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
        });
        assert.strictEqual(getCellValue(model, "B3"), 10);
        assert.strictEqual(getCellValue(model, "B4"), 121.0);
        await addGlobalFilter(model, {
            filter: {
                id: "42",
                type: "relation",
                defaultValue: [41],
                pivotFields: { 1: { field: "product_id", type: "many2one" } },
            },
        });
        assert.strictEqual(getCellValue(model, "B3"), "");
        assert.strictEqual(getCellValue(model, "B4"), 121);
        selectCell(model, "A3");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "use_global_filter");
        assert.strictEqual(root.isVisible(env), true);
        await root.action(env);
        await nextTick();
        assert.strictEqual(getCellValue(model, "B3"), 10);
        assert.strictEqual(getCellValue(model, "B4"), "");
        await root.action(env);
        await nextTick();
        assert.strictEqual(getCellValue(model, "B3"), 10);
        assert.strictEqual(getCellValue(model, "B4"), 121);
    });

    QUnit.test(
        "Set as filter is not visible if there is no pivot formula",
        async function (assert) {
            const { env, model } = await createSpreadsheetWithPivot();
            selectCell(model, "A1");
            setCellContent(model, "A1", "=1");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "use_global_filter");
            assert.strictEqual(root.isVisible(env), false);
        }
    );

    QUnit.test(
        "menu to set filter value is not visible if no filter matches",
        async function (assert) {
            const { env, model } = await createSpreadsheetWithPivot();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "relation",
                    defaultValue: [41],
                    pivotFields: { 1: { field: "product_id", type: "many2one" } },
                },
            });
            selectCell(model, "A30");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "use_global_filter");
            assert.strictEqual(root.isVisible(env), false);
        }
    );
});
