/** @odoo-module */

import { nextTick } from "@web/../tests/helpers/utils";

import { addGlobalFilter, selectCell } from "@spreadsheet/../tests/utils/commands";
import { createSpreadsheetWithPivot } from "@spreadsheet/../tests/utils/pivot";
import { getCellContent } from "@spreadsheet/../tests/utils/getters";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";

const { cellMenuRegistry } = spreadsheet.registries;
const { getMenuChildren } = spreadsheet.helpers;

QUnit.module("documents_spreadsheet > menu", {}, () => {
    QUnit.test(
        "Re-insert a pivot with a global filter should re-insert the full pivot",
        async function (assert) {
            assert.expect(1);

            const { model, env } = await createSpreadsheetWithPivot({
                arch: /*xml*/ `
                <pivot>
                    <field name="product_id" type="col"/>
                    <field name="name" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            });
            await addGlobalFilter(model, {
                filter: {
                    id: "41",
                    type: "relation",
                    label: "41",
                    defaultValue: [41],
                    pivotFields: { 1: { field: "product_id", type: "many2one" } },
                },
            });
            selectCell(model, "A6");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot = getMenuChildren(root, env)[0];
            await reinsertPivot.action(env);
            await nextTick();
            assert.equal(getCellContent(model, "B6"), getCellContent(model, "B1"));
        }
    );
});
