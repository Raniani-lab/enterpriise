/** @odoo-module */

import { session } from "@web/session";
import { nextTick, patchWithCleanup } from "@web/../tests/helpers/utils";

import CommandResult from "@spreadsheet/o_spreadsheet/cancelled_reason";
import { createModelWithDataSource, waitForDataSourcesLoaded } from "../utils/model";
import { setCellContent } from "../utils/commands";
import {
    getCell,
    getCellContent,
    getCellFormula,
    getCells,
    getCellValue,
} from "../utils/getters";
import { createSpreadsheetWithList } from "../utils/list";

QUnit.module("spreadsheet > list plugin", {}, () => {
    QUnit.test("List export", async (assert) => {
        const { model } = await createSpreadsheetWithList();
        const total = 4 + 10 * 4; // 4 Headers + 10 lines
        assert.strictEqual(Object.values(getCells(model)).length, total);
        assert.strictEqual(getCellFormula(model, "A1"), `=LIST.HEADER(1,"foo")`);
        assert.strictEqual(getCellFormula(model, "B1"), `=LIST.HEADER(1,"bar")`);
        assert.strictEqual(getCellFormula(model, "C1"), `=LIST.HEADER(1,"date")`);
        assert.strictEqual(getCellFormula(model, "D1"), `=LIST.HEADER(1,"product_id")`);
        assert.strictEqual(getCellFormula(model, "A2"), `=LIST(1,1,"foo")`);
        assert.strictEqual(getCellFormula(model, "B2"), `=LIST(1,1,"bar")`);
        assert.strictEqual(getCellFormula(model, "C2"), `=LIST(1,1,"date")`);
        assert.strictEqual(getCellFormula(model, "D2"), `=LIST(1,1,"product_id")`);
        assert.strictEqual(getCellFormula(model, "A3"), `=LIST(1,2,"foo")`);
        assert.strictEqual(getCellFormula(model, "A11"), `=LIST(1,10,"foo")`);
        assert.strictEqual(getCellFormula(model, "A12"), "");
    });

    QUnit.test("Return display name of selection field", async (assert) => {
        const { model } = await createSpreadsheetWithList({
            model: "documents.document",
            columns: ["handler"],
        });
        assert.strictEqual(getCellValue(model, "A2", "Spreadsheet"));
    });

    QUnit.test("Return name_get of many2one field", async (assert) => {
        const { model } = await createSpreadsheetWithList({ columns: ["product_id"] });
        assert.strictEqual(getCellValue(model, "A2"), "xphone");
    });

    QUnit.test("Boolean fields are correctly formatted", async (assert) => {
        const { model } = await createSpreadsheetWithList({ columns: ["bar"] });
        assert.strictEqual(getCellValue(model, "A2"), "TRUE");
        assert.strictEqual(getCellValue(model, "A5"), "FALSE");
    });

    QUnit.test("Can display a field which is not in the columns", async function (assert) {
        const { model } = await createSpreadsheetWithList();
        setCellContent(model, "A1", `=LIST(1,1,"active")`);
        assert.strictEqual(getCellValue(model, "A1"), undefined);
        await nextTick(); // Await for batching collection of missing fields
        await waitForDataSourcesLoaded(model);
        assert.strictEqual(getCellValue(model, "A1"), true);
    });

    QUnit.test("Can remove a list with undo after editing a cell", async function (assert) {
        const { model } = await createSpreadsheetWithList();
        assert.ok(getCellContent(model, "B1").startsWith("=LIST.HEADER"));
        setCellContent(model, "G10", "should be undoable");
        model.dispatch("REQUEST_UNDO");
        assert.equal(getCellContent(model, "G10"), "");
        model.dispatch("REQUEST_UNDO");
        assert.equal(getCellContent(model, "B1"), "");
        assert.equal(model.getters.getListIds().length, 0);
    });

    QUnit.test(
        "List is correctly formatted at insertion and re-insertion",
        async function (assert) {
            const { model } = await createSpreadsheetWithList({
                columns: ["foo", "bar", "date", "create_date", "product_id"],
            });
            assert.strictEqual(getCell(model, "A2").format, "#,##0.00");
            assert.strictEqual(getCell(model, "B2").format, undefined);
            assert.strictEqual(getCell(model, "C2").format, "m/d/yyyy");
            assert.strictEqual(getCell(model, "D2").format, "m/d/yyyy hh:mm:ss");
            await waitForDataSourcesLoaded(model);
            const listModel = await model.getters.getAsyncSpreadsheetListModel("1");
            const list = model.getters.getListDefinition("1");
            const columns = list.columns.map((name) => ({
                name,
                type: listModel.getField(name).type,
            }));
            model.dispatch("RE_INSERT_ODOO_LIST", {
                sheetId: model.getters.getActiveSheetId(),
                col: 0,
                row: 10,
                id: "1",
                linesNumber: 10,
                columns,
            });
            assert.strictEqual(getCell(model, "A12").format, "#,##0.00");
            assert.strictEqual(getCell(model, "B12").format, undefined);
            assert.strictEqual(getCell(model, "C12").format, "m/d/yyyy");
            assert.strictEqual(getCell(model, "D12").format, "m/d/yyyy hh:mm:ss");
        }
    );

    QUnit.test("can select a List from cell formula", async function (assert) {
        const { model } = await createSpreadsheetWithList();
        const sheetId = model.getters.getActiveSheetId();
        const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
        model.dispatch("SELECT_ODOO_LIST", { listId });
        const selectedListId = model.getters.getSelectedListId();
        assert.strictEqual(selectedListId, "1");
    });

    QUnit.test(
        "can select a List from cell formula with '-' before the formula",
        async function (assert) {
            const { model } = await createSpreadsheetWithList();
            setCellContent(model, "A1", `=-LIST("1","1","foo")`);
            const sheetId = model.getters.getActiveSheetId();
            const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
            model.dispatch("SELECT_ODOO_LIST", { listId });
            const selectedListId = model.getters.getSelectedListId();
            assert.strictEqual(selectedListId, "1");
        }
    );
    QUnit.test(
        "can select a List from cell formula with other numerical values",
        async function (assert) {
            const { model } = await createSpreadsheetWithList();
            setCellContent(model, "A1", `=3*LIST("1","1","foo")`);
            const sheetId = model.getters.getActiveSheetId();
            const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
            model.dispatch("SELECT_ODOO_LIST", { listId });
            const selectedListId = model.getters.getSelectedListId();
            assert.strictEqual(selectedListId, "1");
        }
    );

    QUnit.test("can select a List from cell formula within a formula", async function (assert) {
        const { model } = await createSpreadsheetWithList();
        setCellContent(model, "A1", `=SUM(LIST("1","1","foo"),1)`);
        const sheetId = model.getters.getActiveSheetId();
        const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
        model.dispatch("SELECT_ODOO_LIST", { listId });
        const selectedListId = model.getters.getSelectedListId();
        assert.strictEqual(selectedListId, "1");
    });

    QUnit.test(
        "can select a List from cell formula where the id is a reference",
        async function (assert) {
            const { model } = await createSpreadsheetWithList();
            setCellContent(model, "A1", `=LIST(G10,"1","foo")`);
            setCellContent(model, "G10", "1");
            const sheetId = model.getters.getActiveSheetId();
            const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
            model.dispatch("SELECT_ODOO_LIST", { listId });
            const selectedListId = model.getters.getSelectedListId();
            assert.strictEqual(selectedListId, "1");
        }
    );

    QUnit.test("Referencing non-existing fields does not crash", async function (assert) {
        assert.expect(4);
        const forbiddenFieldName = "product_id";
        let spreadsheetLoaded = false;
        const { model } = await createSpreadsheetWithList({
            columns: ["bar", "product_id"],
            mockRPC: async function (route, args, performRPC) {
                if (
                    spreadsheetLoaded &&
                    args.method === "search_read" &&
                    args.model === "partner" &&
                    args.kwargs.fields &&
                    args.kwargs.fields.includes(forbiddenFieldName)
                ) {
                    // We should not go through this condition if the forbidden fields is properly filtered
                    assert.ok(false, `${forbiddenFieldName} should have been ignored`);
                }
                if (this) {
                    // @ts-ignore
                    return this._super.apply(this, arguments);
                }
            },
        });
        const listId = model.getters.getListIds()[0];
        // remove forbidden field from the fields of the list.
        delete model.getters.getSpreadsheetListModel(listId).getFields()[forbiddenFieldName];
        spreadsheetLoaded = true;
        model.dispatch("REFRESH_ALL_DATA_SOURCES");
        setCellContent(model, "A1", `=LIST.HEADER("1", "${forbiddenFieldName}")`);
        setCellContent(model, "A2", `=LIST("1","1","${forbiddenFieldName}")`);

        assert.equal(
            model.getters.getSpreadsheetListModel(listId).getFields()[forbiddenFieldName],
            undefined
        );
        assert.strictEqual(getCellValue(model, "A1"), forbiddenFieldName);
        const A2 = getCell(model, "A2");
        assert.equal(A2.evaluated.type, "error");
        assert.equal(
            A2.evaluated.error,
            `The field ${forbiddenFieldName} does not exist or you do not have access to that field`
        );
    });

    QUnit.test("don't fetch list data if no formula use it", async function (assert) {
        const spreadsheetData = {
            sheets: [
                {
                    id: "sheet1",
                },
                {
                    id: "sheet2",
                    cells: {
                        A1: { content: `=LIST("1", "1", "foo")` },
                    },
                },
            ],
            lists: {
                1: {
                    id: 1,
                    columns: ["foo", "contact_name"],
                    domain: [],
                    model: "partner",
                    orderBy: [],
                    context: {},
                },
            },
        };
        const model = await createModelWithDataSource({
            spreadsheetData,
            mockRPC: function (_, { model, method }) {
                if (!["partner", "ir.model"].includes(model)) {
                    return;
                }
                assert.step(`${model}/${method}`);
            },
        });
        assert.verifySteps([]);
        model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: "sheet1", sheetIdTo: "sheet2" });
        assert.equal(getCellValue(model, "A1"), "Loading...");
        await nextTick();
        assert.equal(getCellValue(model, "A1"), 12);
        assert.verifySteps(["partner/fields_get", "ir.model/search_read", "partner/search_read"]);
    });

    QUnit.test("user context is combined with list context to fetch data", async function (assert) {
        const context = {
            allowed_company_ids: [15],
            default_stage_id: 5,
            search_default_stage_id: 5,
            tz: "bx",
            lang: "FR",
            uid: 4,
        };
        const testSession = {
            uid: 4,
            user_companies: {
                allowed_companies: {
                    15: { id: 15, name: "Hermit" },
                    16: { id: 16, name: "Craft" },
                },
                current_company: 15,
            },
            user_context: context,
        };
        const spreadsheetData = {
            sheets: [
                {
                    id: "sheet1",
                    cells: {
                        A1: { content: `=LIST("1", "1", "name")` },
                    },
                },
            ],
            lists: {
                1: {
                    id: 1,
                    columns: ["name", "contact_name"],
                    domain: [],
                    model: "partner",
                    orderBy: [],
                    context: {
                        allowed_company_ids: [16],
                        default_stage_id: 9,
                        search_default_stage_id: 90,
                        tz: "nz",
                        lang: "EN",
                        uid: 40,
                    },
                },
            },
        };
        const expectedFetchContext = {
            allowed_company_ids: [15],
            default_stage_id: 9,
            search_default_stage_id: 90,
            tz: "bx",
            lang: "FR",
            uid: 4,
        };
        patchWithCleanup(session, testSession);
        await createModelWithDataSource({
            spreadsheetData,
            mockRPC: function (route, { model, method, kwargs }) {
                if (model !== "partner") {
                    return;
                }
                switch (method) {
                    case "search_read":
                        assert.step("search_read");
                        assert.deepEqual(
                            kwargs.context,
                            expectedFetchContext,
                            "search_read context"
                        );
                        break;
                }
            },
        });
        assert.verifySteps(["search_read"]);
    });

    QUnit.test("rename list with empty name is refused", async (assert) => {
        const { model } = await createSpreadsheetWithList();
        const result = model.dispatch("RENAME_ODOO_LIST", {
            listId: "1",
            name: "",
        });
        assert.deepEqual(result.reasons, [CommandResult.EmptyName]);
    });

    QUnit.test("rename list with incorrect id is refused", async (assert) => {
        const { model } = await createSpreadsheetWithList();
        const result = model.dispatch("RENAME_ODOO_LIST", {
            listId: "invalid",
            name: "name",
        });
        assert.deepEqual(result.reasons, [CommandResult.ListIdNotFound]);
    });

    QUnit.test("Undo/Redo for RENAME_ODOO_LIST", async function (assert) {
        assert.expect(4);
        const { model } = await createSpreadsheetWithList();
        assert.equal(model.getters.getListName("1"), "List");
        model.dispatch("RENAME_ODOO_LIST", { listId: "1", name: "test" });
        assert.equal(model.getters.getListName("1"), "test");
        model.dispatch("REQUEST_UNDO");
        assert.equal(model.getters.getListName("1"), "List");
        model.dispatch("REQUEST_REDO");
        assert.equal(model.getters.getListName("1"), "test");
    });

    QUnit.test("Can delete list", async function (assert) {
        const { model } = await createSpreadsheetWithList();
        model.dispatch("REMOVE_ODOO_LIST", { listId: "1" });
        assert.strictEqual(model.getters.getListIds().length, 0);
        const B4 = getCell(model, "B4");
        assert.equal(B4.evaluated.error, `There is no list with id "1"`);
        assert.equal(B4.evaluated.value, `#ERROR`);
    });

    QUnit.test("Can undo/redo a delete list", async function (assert) {
        const { model } = await createSpreadsheetWithList();
        const value = getCell(model, "B4").evaluated.value;
        model.dispatch("REMOVE_ODOO_LIST", { listId: "1" });
        model.dispatch("REQUEST_UNDO");
        assert.strictEqual(model.getters.getListIds().length, 1);
        let B4 = getCell(model, "B4");
        assert.equal(B4.evaluated.error, undefined);
        assert.equal(B4.evaluated.value, value);
        model.dispatch("REQUEST_REDO");
        assert.strictEqual(model.getters.getListIds().length, 0);
        B4 = getCell(model, "B4");
        assert.equal(B4.evaluated.error, `There is no list with id "1"`);
        assert.equal(B4.evaluated.value, `#ERROR`);
    });
});
