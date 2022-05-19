/** @odoo-module */
/* global $ */

import ListView from "web.ListView";
import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import { createView, dom } from "web.test_utils";
import { getBasicData, getBasicServerData, getBasicListArch } from "../utils/spreadsheet_test_data";
import { insertList } from "../../src/bundle/list/list_init_callback";
import {
    getCell,
    getCellContent,
    getCellFormula,
    getCells,
    getCellValue,
} from "../utils/getters_helpers";
import { selectCell, setCellContent } from "../utils/commands_helpers";
import { createSpreadsheetFromList } from "../utils/list_helpers";
import { nextTick, getFixture, patchWithCleanup, click } from "@web/../tests/helpers/utils";
import { session } from "@web/session";
import { createModelWithDataSource, waitForDataSourcesLoaded } from "../spreadsheet_test_utils";
import CommandResult from "@documents_spreadsheet/bundle/o_spreadsheet/cancelled_reason";

const { toZone } = spreadsheet.helpers;
const { topbarMenuRegistry, cellMenuRegistry } = spreadsheet.registries;

QUnit.module("documents_spreadsheet > list_controller", {}, () => {
    QUnit.test("List export", async (assert) => {
        assert.expect(12);
        const { model } = await createSpreadsheetFromList();
        const total = 4 + 10 * 4; // 4 Headers + 10 lines
        assert.strictEqual(Object.values(getCells(model)).length, total);
        assert.strictEqual(getCellFormula(model, "A1"), `=LIST.HEADER("1","foo")`);
        assert.strictEqual(getCellFormula(model, "B1"), `=LIST.HEADER("1","bar")`);
        assert.strictEqual(getCellFormula(model, "C1"), `=LIST.HEADER("1","date")`);
        assert.strictEqual(getCellFormula(model, "D1"), `=LIST.HEADER("1","product_id")`);
        assert.strictEqual(getCellFormula(model, "A2"), `=LIST("1","1","foo")`);
        assert.strictEqual(getCellFormula(model, "B2"), `=LIST("1","1","bar")`);
        assert.strictEqual(getCellFormula(model, "C2"), `=LIST("1","1","date")`);
        assert.strictEqual(getCellFormula(model, "D2"), `=LIST("1","1","product_id")`);
        assert.strictEqual(getCellFormula(model, "A3"), `=LIST("1","2","foo")`);
        assert.strictEqual(getCellFormula(model, "A11"), `=LIST("1","10","foo")`);
        assert.strictEqual(getCellFormula(model, "A12"), "");
    });

    QUnit.test("List export with a invisible field", async (assert) => {
        assert.expect(1);
        const { model } = await createSpreadsheetFromList({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,list": `
                        <tree string="Partners">
                            <field name="foo" invisible="1"/>
                            <field name="bar"/>
                        </tree>`,
                    "partner,false,search": "<search/>",
                },
            },
        });
        assert.strictEqual(getCellFormula(model, "A1"), `=LIST.HEADER("1","bar")`);
    });

    QUnit.test("List export with a widget handle", async (assert) => {
        assert.expect(1);
        const { model } = await createSpreadsheetFromList({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,list": `
                            <tree string="Partners">
                                <field name="foo" widget="handle"/>
                                <field name="bar"/>
                            </tree>`,
                    "partner,false,search": "<search/>",
                },
            },
        });
        assert.strictEqual(getCellFormula(model, "A1"), `=LIST.HEADER("1","bar")`);
    });

    QUnit.test("Return display name of selection field", async (assert) => {
        assert.expect(1);
        const { model } = await createSpreadsheetFromList({
            model: "documents.document",
            serverData: {
                models: getBasicData(),
                views: {
                    "documents.document,false,list": `
                        <tree string="Documents">
                            <field name="name"/>
                            <field name="handler"/>
                        </tree>`,
                    "documents.document,false,search": "<search/>",
                },
            },
        });
        assert.strictEqual(getCellValue(model, "B2", "Spreadsheet"));
    });

    QUnit.test("Return name_get of many2one field", async (assert) => {
        assert.expect(1);
        const { model } = await createSpreadsheetFromList();
        assert.strictEqual(getCellValue(model, "D2"), "xphone");
    });

    QUnit.test("Boolean fields are correctly formatted", async (assert) => {
        assert.expect(2);
        const { model } = await createSpreadsheetFromList();
        assert.strictEqual(getCellValue(model, "B2"), "TRUE");
        assert.strictEqual(getCellValue(model, "B5"), "FALSE");
    });

    QUnit.test("Can display a field which is not in the columns", async function (assert) {
        assert.expect(2);
        const { model } = await createSpreadsheetFromList();
        setCellContent(model, "A1", `=LIST("1","1","active")`);
        assert.strictEqual(getCellValue(model, "A1"), undefined);
        await nextTick(); // Await for batching collection of missing fields
        await waitForDataSourcesLoaded(model);
        assert.strictEqual(getCellValue(model, "A1"), true);
    });

    QUnit.test("Open list properties properties", async function (assert) {
        assert.expect(10);

        const { model, env } = await createSpreadsheetFromList();

        const dataRoot = topbarMenuRegistry.getAll().find((item) => item.id === "data");
        const children = topbarMenuRegistry.getChildren(dataRoot, env);
        const openProperties = children.find((item) => item.id === "item_list_1");
        openProperties.action(env);
        await nextTick();
        const target = getFixture();
        let title = $(target).find(".o-sidePanelTitle")[0].innerText;
        assert.equal(title, "List properties");

        const sections = $(target).find(".o_side_panel_section");
        assert.equal(sections.length, 4, "it should have 4 sections");
        const [pivotName, pivotModel, domain] = sections;

        assert.equal(pivotName.children[0].innerText, "List Name");
        assert.equal(pivotName.children[1].innerText, "(#1) Partners");

        assert.equal(pivotModel.children[0].innerText, "Model");
        assert.equal(pivotModel.children[1].innerText, "Partner (partner)");

        assert.equal(domain.children[0].innerText, "Domain");
        assert.equal(domain.children[1].innerText, "Match all records");

        // opening from a non pivot cell
        model.dispatch("SELECT_ODOO_LIST", {});
        env.openSidePanel("LIST_PROPERTIES_PANEL", {
            listId: undefined,
        });
        await nextTick();
        title = $(target).find(".o-sidePanelTitle")[0].innerText;
        assert.equal(title, "List properties");

        assert.containsOnce(target, ".o_side_panel_select");
    });

    QUnit.test("Add list in an existing spreadsheet", async (assert) => {
        assert.expect(4);
        const listView = await createView({
            View: ListView,
            model: "partner",
            data: getBasicData(),
            arch: getBasicListArch(),
            session: { user_has_group: async () => true },
        });
        const { list, fields } = listView._getListForSpreadsheet();
        listView.destroy();
        const { model } = await createSpreadsheetFromList();
        const callback = insertList.bind({ isEmptySpreadsheet: false })({
            list: list,
            threshold: 10,
            fields: fields,
        });
        model.dispatch("CREATE_SHEET", { sheetId: "42", position: 1 });
        const activeSheetId = model.getters.getActiveSheetId();
        assert.deepEqual(model.getters.getSheetIds(), [activeSheetId, "42"]);
        await callback(model);
        assert.strictEqual(model.getters.getSheetIds().length, 3);
        assert.deepEqual(model.getters.getSheetIds()[0], activeSheetId);
        assert.deepEqual(model.getters.getSheetIds()[1], "42");
    });

    QUnit.test("Can remove a list with undo after editing a cell", async function (assert) {
        assert.expect(4);
        const { model } = await createSpreadsheetFromList();
        assert.ok(getCellContent(model, "B1").startsWith("=LIST.HEADER"));
        setCellContent(model, "G10", "should be undoable");
        model.dispatch("REQUEST_UNDO");
        assert.equal(getCellContent(model, "G10"), "");
        // 2 REQUEST_UNDO because of the AUTORESIZE feature
        model.dispatch("REQUEST_UNDO");
        model.dispatch("REQUEST_UNDO");
        assert.equal(getCellContent(model, "B1"), "");
        assert.equal(model.getters.getListIds().length, 0);
    });

    QUnit.test("List is correctly formatted", async function (assert) {
        assert.expect(4);
        const { model } = await createSpreadsheetFromList();
        assert.strictEqual(getCell(model, "A2").format, "#,##0.00");
        assert.strictEqual(getCell(model, "B2").format, undefined);
        await waitForDataSourcesLoaded(model);
        const listModel = await model.getters.getAsyncSpreadsheetListModel("1");
        const list = model.getters.getListDefinition("1");
        const columns = list.columns.map((name) => ({ name, type: listModel.getField(name).type }));
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
    });

    QUnit.test("can select a List from cell formula", async function (assert) {
        assert.expect(1);
        const { model } = await createSpreadsheetFromList();
        const sheetId = model.getters.getActiveSheetId();
        const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
        model.dispatch("SELECT_ODOO_LIST", { listId });
        const selectedListId = model.getters.getSelectedListId();
        assert.strictEqual(selectedListId, "1");
    });

    QUnit.test(
        "can select a List from cell formula with '-' before the formula",
        async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromList();
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
            assert.expect(1);
            const { model } = await createSpreadsheetFromList();
            setCellContent(model, "A1", `=3*LIST("1","1","foo")`);
            const sheetId = model.getters.getActiveSheetId();
            const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
            model.dispatch("SELECT_ODOO_LIST", { listId });
            const selectedListId = model.getters.getSelectedListId();
            assert.strictEqual(selectedListId, "1");
        }
    );

    QUnit.test("can select a List from cell formula within a formula", async function (assert) {
        assert.expect(1);
        const { model } = await createSpreadsheetFromList();
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
            assert.expect(1);
            const { model } = await createSpreadsheetFromList();
            setCellContent(model, "A1", `=LIST(G10,"1","foo")`);
            setCellContent(model, "G10", "1");
            const sheetId = model.getters.getActiveSheetId();
            const listId = model.getters.getListIdFromPosition(sheetId, 0, 0);
            model.dispatch("SELECT_ODOO_LIST", { listId });
            const selectedListId = model.getters.getSelectedListId();
            assert.strictEqual(selectedListId, "1");
        }
    );

    QUnit.test("Verify absence of pivot properties on non-pivot cell", async function (assert) {
        assert.expect(1);
        const { model, env } = await createSpreadsheetFromList();
        selectCell(model, "Z26");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "listing_properties");
        assert.notOk(root.isVisible(env));
    });

    QUnit.test("Re-insert a list correctly ask for lines number", async function (assert) {
        assert.expect(2);
        const { model, env } = await createSpreadsheetFromList();
        selectCell(model, "Z26");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_list");
        const reinsertList = cellMenuRegistry.getChildren(root, env)[0];
        await reinsertList.action(env);
        await nextTick();
        const input = document.body.querySelector(".modal-body input");
        assert.ok(input);
        assert.strictEqual(input.type, "number");
    });

    QUnit.test("Referencing non-existing fields does not crash", async function (assert) {
        assert.expect(4);
        const forbiddenFieldName = "product_id";
        let spreadsheetLoaded = false;
        const { model } = await createSpreadsheetFromList({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,list": `
                            <tree string="Partners">
                                <field name="bar"/>
                                <field name="product_id"/>
                            </tree>`,
                    "partner,false,search": "<search/>",
                },
            },
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

    QUnit.test("user related context is not saved in the spreadsheet", async function (assert) {
        const context = {
            allowed_company_ids: [15],
            default_stage_id: 5,
            search_default_stage_id: 5,
            tz: "bx",
            lang: "FR",
            uid: 4,
        };
        const controller = await createView({
            View: ListView,
            arch: `
                    <tree string="Partners">
                        <field name="bar"/>
                        <field name="product_id"/>
                    </tree>
                `,
            data: getBasicData(),
            model: "partner",
            context,
        });
        const { list } = controller._getListForSpreadsheet();
        assert.deepEqual(
            list.context,
            {
                default_stage_id: 5,
                search_default_stage_id: 5,
            },
            "user related context is not stored in context"
        );
        controller.destroy();
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
            mockRPC: function (route, { model, method, kwargs }) {
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

    QUnit.test("Can see record of a list", async function (assert) {
        const { webClient, model } = await createSpreadsheetFromList();
        const listId = model.getters.getListIds()[0];
        const listModel = model.getters.getSpreadsheetListModel(listId);
        const env = {
            ...webClient.env,
            model,
            services: {
                ...model.config.evalContext.env.services,
                action: {
                    doAction: (params) => {
                        assert.step(params.res_model);
                        assert.step(params.res_id.toString());
                    },
                },
            },
        };
        selectCell(model, "A2");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "list_see_record");
        await root.action(env);
        assert.verifySteps(["partner", listModel.getIdFromPosition(0).toString()]);

        selectCell(model, "A3");
        await root.action(env);
        assert.verifySteps(["partner", listModel.getIdFromPosition(1).toString()]);

        // From a cell inside a merge
        model.dispatch("ADD_MERGE", {
            sheetId: model.getters.getActiveSheetId(),
            target: [toZone("A3:B3")],
            force: true, // there are data in B3
        });
        selectCell(model, "B3");
        await root.action(env);
        assert.verifySteps(["partner", listModel.getIdFromPosition(1).toString()]);
    });

    QUnit.test(
        "See record of list is only displayed on list formula with only one list formula",
        async function (assert) {
            const { webClient, model } = await createSpreadsheetFromList();
            const env = {
                ...webClient.env,
                model,
                services: model.config.evalContext.env.services,
            };
            setCellContent(model, "A1", "test");
            setCellContent(model, "A2", `=LIST("1","1","foo")`);
            setCellContent(model, "A3", `=LIST("1","1","foo")+LIST("1","1","foo")`);
            const root = cellMenuRegistry.getAll().find((item) => item.id === "list_see_record");

            selectCell(model, "A1");
            assert.strictEqual(root.isVisible(env), false);
            selectCell(model, "A2");
            assert.strictEqual(root.isVisible(env), true);
            selectCell(model, "A3");
            assert.strictEqual(root.isVisible(env), false);
        }
    );

    QUnit.test("See records is visible even if the formula is lowercase", async function (assert) {
        const { env, model } = await createSpreadsheetFromList();
        selectCell(model, "B2");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "list_see_record");
        assert.ok(root.isVisible(env));
        setCellContent(model, "B2", getCellFormula(model, "B2").replace("LIST", "list"));
        assert.ok(root.isVisible(env));
    });

    QUnit.test("See records is not visible if the formula is in error", async function (assert) {
        const { env, model } = await createSpreadsheetFromList();
        selectCell(model, "B2");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "list_see_record");
        assert.ok(root.isVisible(env));
        setCellContent(model, "B2", getCellFormula(model, "B2").replace( `LIST("1`, `LIST("5)`)); //Invalid id
        assert.ok(getCell(model, "B2").evaluated.error);
        assert.notOk(root.isVisible(env));
    });

    QUnit.test("Update the list title from the side panel", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromList();
        // opening from a pivot cell
        const sheetId = model.getters.getActiveSheetId();
        const listA3 = model.getters.getListIdFromPosition(sheetId, 0, 2);
        model.dispatch("SELECT_ODOO_LIST", { listId: listA3 });
        env.openSidePanel("LIST_PROPERTIES_PANEL", {
            listId: listA3,
        });
        await nextTick();
        await click(document.body.querySelector(".o_sp_en_rename"));
        document.body.querySelector(".o_sp_en_name").value = "new name";
        await dom.triggerEvent(document.body.querySelector(".o_sp_en_name"), "input");
        await click(document.body.querySelector(".o_sp_en_save"));
        assert.equal(model.getters.getListName(listA3), "new name");
    });



    QUnit.test("rename list with empty name is refused", async (assert) => {
        const { model } = await createSpreadsheetFromList();
        const result = model.dispatch("RENAME_ODOO_LIST", {
            listId: "1",
            name: "",
        });
        assert.deepEqual(result.reasons, [CommandResult.EmptyName]);
    });

    QUnit.test("rename list with incorrect id is refused", async (assert) => {
        const { model } = await createSpreadsheetFromList();
        const result = model.dispatch("RENAME_ODOO_LIST", {
            listId: "invalid",
            name: "name",
        });
        assert.deepEqual(result.reasons, [CommandResult.ListIdNotFound]);
    });

    QUnit.test("Undo/Redo for RENAME_ODOO_LIST", async function (assert) {
        assert.expect(4);
        const { model } = await createSpreadsheetFromList();
        assert.equal(model.getters.getListName("1"), "Partners");
        model.dispatch("RENAME_ODOO_LIST", { listId: "1", name: "test" });
        assert.equal(model.getters.getListName("1"), "test");
        model.dispatch("REQUEST_UNDO");
        assert.equal(model.getters.getListName("1"), "Partners");
        model.dispatch("REQUEST_REDO");
        assert.equal(model.getters.getListName("1"), "test");
    });

    QUnit.test("Can delete list", async function (assert) {
        const { model } = await createSpreadsheetFromList();
        model.dispatch("REMOVE_ODOO_LIST", { listId: "1" });
        assert.strictEqual(model.getters.getListIds().length, 0);
        const B4 = getCell(model, "B4");
        assert.equal(B4.evaluated.error, `There is no list with id "1"`);
        assert.equal(B4.evaluated.value, `#ERROR`);
    });

    QUnit.test("Can undo/redo a delete list", async function (assert) {
        const { model } = await createSpreadsheetFromList();
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

    QUnit.test("Inserting a list preserves the ascending sorting from the list", async function (assert) {
        const serverData = getBasicServerData();
        serverData.models.partner.fields.foo.sortable = true;
        const { model } = await createSpreadsheetFromList({
            serverData,
            orderBy: [{name:'foo', asc: true}],
            linesNumber: 4
        });
        assert.ok(getCell(model, 'A2').evaluated.value <= getCell(model, 'A3').evaluated.value);
        assert.ok(getCell(model, 'A3').evaluated.value <=  getCell(model, 'A4').evaluated.value);
        assert.ok(getCell(model, 'A4').evaluated.value <= getCell(model, 'A5').evaluated.value);
    });

    QUnit.test("Inserting a list preserves the descending sorting from the list", async function (assert) {
        const serverData = getBasicServerData();
        serverData.models.partner.fields.foo.sortable = true; 
        const { model } = await createSpreadsheetFromList({
            serverData,
            orderBy: [{name:'foo', asc: false}],
            linesNumber: 4
        });
        assert.ok(getCell(model, 'A2').evaluated.value >= getCell(model, 'A3').evaluated.value);
        assert.ok(getCell(model, 'A3').evaluated.value >=  getCell(model, 'A4').evaluated.value);
        assert.ok(getCell(model, 'A4').evaluated.value >= getCell(model, 'A5').evaluated.value);
    });
});
