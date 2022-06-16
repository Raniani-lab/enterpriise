/** @odoo-module */

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { nextTick, getFixture } from "@web/../tests/helpers/utils";
import { createSpreadsheet } from "../spreadsheet_test_utils";
import { getBasicData, getBasicPivotArch, getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { getCell, getCellFormula, getCellValue } from "@spreadsheet/../tests/utils/getters";
import {
    addGlobalFilter,
    selectCell,
    setCellContent,
    setGlobalFilterValue,
} from "@spreadsheet/../tests/utils/commands";
import { createSpreadsheetFromPivotView } from "../utils/pivot_helpers";
import {
    createSpreadsheetWithPivot,
    insertPivotInSpreadsheet,
} from "@spreadsheet/../tests/utils/pivot";

const { toCartesian, toZone } = spreadsheet.helpers;
const { cellMenuRegistry, topbarMenuRegistry } = spreadsheet.registries;

let target;

QUnit.module(
    "documents_spreadsheet > Pivot Menu Items",
    {
        beforeEach: function () {
            target = getFixture();
        },
    },
    function () {
        QUnit.test("Reinsert a pivot", async function (assert) {
            const { model, env } = await createSpreadsheetWithPivot();
            selectCell(model, "D8");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(
                getCellFormula(model, "E10"),
                `=PIVOT(1,"probability","bar","false","foo",1)`,
                "It should contain a pivot formula"
            );
        });

        QUnit.test("Reinsert a pivot in a too small sheet", async function (assert) {
            const { model, env } = await createSpreadsheetWithPivot();
            const sheetId = model.getters.getActiveSheetId();
            model.dispatch("CREATE_SHEET", { cols: 1, rows: 1, sheetId: "111" });
            model.dispatch("ACTIVATE_SHEET", {
                sheetIdFrom: sheetId,
                sheetIdTo: "111",
            });
            selectCell(model, "A1");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getActiveSheet().cols.length, 6);
            assert.equal(model.getters.getActiveSheet().rows.length, 5);
            assert.equal(
                getCellFormula(model, "B3"),
                `=PIVOT(1,"probability","bar","false","foo",1)`,
                "It should contain a pivot formula"
            );
        });

        QUnit.test("Reinsert a pivot with new data", async function (assert) {
            const data = getBasicData();

            const { model, env } = await createSpreadsheetWithPivot({
                serverData: {
                    models: data,
                    views: getBasicServerData().views,
                },
            });
            data.partner.records.push({
                active: true,
                id: 5,
                foo: 25, // <- New value inserted
                bar: false,
                date: "2016-12-11",
                product_id: 41,
                probability: 15,
                field_with_array_agg: 4,
                create_date: "2016-12-11",
                tag_ids: [],
            });
            selectCell(model, "D8");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(getCellFormula(model, "I8"), `=PIVOT.HEADER(1,"foo",25)`);
            assert.equal(
                getCellFormula(model, "I10"),
                `=PIVOT(1,"probability","bar","false","foo",25)`
            );
        });

        QUnit.test("Reinsert a pivot with an updated record", async function (assert) {
            const data = getBasicData();

            const { model, env } = await createSpreadsheetWithPivot({
                serverData: {
                    models: data,
                    views: getBasicServerData().views,
                },
            });
            assert.equal(getCellValue(model, "B1"), 1);
            assert.equal(getCellValue(model, "C1"), 2);
            assert.equal(getCellValue(model, "D1"), 12);
            data.partner.records[0].foo = 99;
            data.partner.records[1].foo = 99;
            // updated measures
            data.partner.records[0].probability = 88;
            data.partner.records[1].probability = 77;
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            await nextTick();
            assert.equal(getCellValue(model, "D1"), 99, "The header should have been updated");
            assert.equal(getCellValue(model, "D4"), 77 + 88, "The value should have been updated");
        });

        QUnit.test(
            "Reinsert a pivot which has no formula on the sheet (meaning the data is not loaded)",
            async function (assert) {
                const spreadsheetData = {
                    sheets: [
                        {
                            id: "sheet1",
                        },
                    ],
                    pivots: {
                        1: {
                            id: 1,
                            colGroupBys: ["foo"],
                            domain: [],
                            measures: [{ field: "probability", operator: "avg" }],
                            model: "partner",
                            rowGroupBys: ["bar"],
                            context: {},
                        },
                    },
                };
                const serverData = getBasicServerData();
                serverData.models["documents.document"].records.push({
                    id: 45,
                    raw: JSON.stringify(spreadsheetData),
                    name: "Spreadsheet",
                    handler: "spreadsheet",
                });
                const { model, env } = await createSpreadsheet({
                    serverData,
                    spreadsheetId: 45,
                });
                const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
                const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
                await reinsertPivot1.action(env);
                assert.equal(getCellFormula(model, "C1"), `=PIVOT.HEADER(1,"foo",2)`);
                assert.equal(
                    getCellFormula(model, "C2"),
                    `=PIVOT.HEADER(1,"foo",2,"measure","probability")`
                );
                assert.equal(
                    getCellFormula(model, "C3"),
                    `=PIVOT(1,"probability","bar","false","foo",2)`
                );
                await nextTick();
                assert.equal(getCellValue(model, "C1"), 2);
                assert.equal(getCellValue(model, "C2"), "Probability");
                assert.equal(getCellValue(model, "C3"), 15);
            }
        );

        QUnit.test("Keep applying filter when pivot is re-inserted", async function (assert) {
            const { model, env } = await createSpreadsheetWithPivot({
                arch: /*xml*/ `
                    <pivot>
                        <field name="bar" type="col"/>
                        <field name="product_id" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
            });
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "relation",
                    label: "Filter",
                    pivotFields: {
                        1: {
                            field: "product_id",
                            type: "many2one",
                        },
                    },
                },
            });
            await nextTick();
            await setGlobalFilterValue(model, {
                id: "42",
                value: [41],
            });
            await nextTick();
            assert.equal(getCellValue(model, "B3"), "", "The value should have been filtered");
            assert.equal(getCellValue(model, "C3"), "", "The value should have been filtered");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            await nextTick();
            assert.equal(getCellValue(model, "B3"), "", "The value should still be filtered");
            assert.equal(getCellValue(model, "C3"), "", "The value should still be filtered");
        });

        QUnit.test("undo pivot reinsert", async function (assert) {
            const { model, env } = await createSpreadsheetWithPivot();
            const sheetId = model.getters.getActiveSheetId();
            selectCell(model, "D8");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(
                getCellFormula(model, "E10"),
                `=PIVOT(1,"probability","bar","false","foo",1)`,
                "It should contain a pivot formula"
            );
            model.dispatch("REQUEST_UNDO");
            assert.notOk(
                model.getters.getCell(sheetId, 4, 9),
                "It should have removed the re-inserted pivot"
            );
        });

        QUnit.test("reinsert pivot with anchor on merge but not top left", async function (assert) {
            const { model, env } = await createSpreadsheetWithPivot();
            const sheetId = model.getters.getActiveSheetId();
            assert.equal(
                getCellFormula(model, "B2"),
                `=PIVOT.HEADER(1,"foo",1,"measure","probability")`,
                "It should contain a pivot formula"
            );
            model.dispatch("ADD_MERGE", {
                sheetId,
                target: [{ top: 0, bottom: 1, left: 0, right: 0 }],
            });
            selectCell(model, "A2"); // A1 and A2 are merged; select A2
            const { col, row } = toCartesian("A2");
            assert.ok(model.getters.isInMerge(sheetId, col, row));
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(
                getCellFormula(model, "B2"),
                `=PIVOT.HEADER(1,"foo",1,"measure","probability")`,
                "It should contain a pivot formula"
            );
        });

        QUnit.test("Verify absence of pivot properties on non-pivot cell", async function (assert) {
            const { model, env } = await createSpreadsheetWithPivot();
            selectCell(model, "Z26");
            const root = cellMenuRegistry.getAll().find((item) => item.id === "pivot_properties");
            assert.notOk(root.isVisible(env));
        });

        QUnit.test(
            "verify absence of pivots in top menu bar in a spreadsheet without a pivot",
            async function (assert) {
                await createSpreadsheet();
                assert.containsNone(target, "div[data-id='pivots']");
            }
        );

        QUnit.test(
            "Verify presence of pivots in top menu bar in a spreadsheet with a pivot",
            async function (assert) {
                const { model, env } = await createSpreadsheetFromPivotView();
                await insertPivotInSpreadsheet(model, { arch: getBasicPivotArch() });
                assert.ok(
                    target.querySelector("div[data-id='data']"),
                    "The 'Pivots' menu should be in the dom"
                );

                const root = topbarMenuRegistry.getAll().find((item) => item.id === "data");
                const children = topbarMenuRegistry.getChildren(root, env);
                assert.equal(children.length, 6, "There should be 6 children in the menu");
                assert.equal(children[0].name, "(#1) Partners by Foo");
                assert.equal(children[1].name, "(#2) Partner Pivot");
                // bottom children
                assert.equal(children[2].name, "Refresh all data");
                assert.equal(children[3].name, "Re-insert pivot");
                assert.equal(children[4].name, "Insert pivot cell");
                assert.equal(children[5].name, "Re-insert list");
            }
        );

        QUnit.test("Pivot focus changes on top bar menu click", async function (assert) {
            const { model, env } = await createSpreadsheetFromPivotView();
            await insertPivotInSpreadsheet(model, { arch: getBasicPivotArch() });

            const root = topbarMenuRegistry.getAll().find((item) => item.id === "data");
            const children = topbarMenuRegistry.getChildren(root, env);

            env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
            assert.notOk(model.getters.getSelectedPivotId(), "No pivot should be selected");
            children[0].action(env);
            assert.equal(
                model.getters.getSelectedPivotId(),
                "1",
                "The selected pivot should have id 1"
            );
            children[1].action(env);
            assert.equal(
                model.getters.getSelectedPivotId(),
                "2",
                "The selected pivot should have id 2"
            );
        });

        QUnit.test(
            "Can rebuild the Odoo domain of records based on the according merged pivot cell",
            async function (assert) {
                const { webClient, model } = await createSpreadsheetFromPivotView();
                const env = {
                    ...webClient.env,
                    model,
                    services: {
                        ...model.config.evalContext.env.services,
                        action: {
                            doAction: (params) => {
                                assert.step(params.res_model);
                                assert.step(JSON.stringify(params.domain));
                            },
                        },
                    },
                };
                model.dispatch("ADD_MERGE", {
                    sheetId: model.getters.getActiveSheetId(),
                    target: [toZone("C3:D3")],
                    force: true, // there are data in D3
                });
                selectCell(model, "D3");
                await nextTick();
                const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
                await root.action(env);
                assert.verifySteps(["partner", `[["foo","=",2],["bar","=",false]]`]);
            }
        );

        QUnit.test(
            "See records is visible even if the formula is lowercase",
            async function (assert) {
                const { env, model } = await createSpreadsheetWithPivot();
                selectCell(model, "B4");
                await nextTick();
                const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
                assert.ok(root.isVisible(env));
                setCellContent(model, "B4", getCellFormula(model, "B4").replace("PIVOT", "pivot"));
                assert.ok(root.isVisible(env));
            }
        );

        QUnit.test(
            "See records is not visible if the formula is in error",
            async function (assert) {
                const { env, model } = await createSpreadsheetWithPivot();
                selectCell(model, "B4");
                await nextTick();
                const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
                assert.ok(root.isVisible(env));
                setCellContent(
                    model,
                    "B4",
                    getCellFormula(model, "B4").replace(`PIVOT(1`, `PIVOT("5)`)
                ); //Invalid id
                assert.ok(getCell(model, "B4").evaluated.error.message);
                assert.notOk(root.isVisible(env));
            }
        );
    }
);
