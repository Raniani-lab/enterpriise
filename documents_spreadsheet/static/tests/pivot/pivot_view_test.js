/** @odoo-module alias=documents_spreadsheet.PivotViewTests */

import { getBasicData, getBasicServerData } from "../utils/spreadsheet_test_data";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { click, nextTick, legacyExtraNextTick, getFixture, patchWithCleanup } from "@web/../tests/helpers/utils";
import { makeView } from "@web/../tests/views/helpers";
import { dialogService } from "@web/core/dialog/dialog_service";
import { registry } from "@web/core/registry";
import { session } from "@web/session";
import {
    toggleMenu,
    toggleMenuItem,
    setupControlPanelServiceRegistry,
} from "@web/../tests/search/helpers";
import * as BusService from "bus.BusService";
import * as legacyRegistry from "web.Registry";
import * as RamStorage from "web.RamStorage";
import * as AbstractStorageService from "web.AbstractStorageService";
import { insertPivot } from "@documents_spreadsheet/bundle/pivot/pivot_init_callback";
import {
    getCell,
    getCellContent,
    getCellFormula,
    getCells,
    getCellValue,
    getMerges,
} from "../utils/getters_helpers";
import { selectCell, setCellContent } from "../utils/commands_helpers";
import { prepareWebClientForSpreadsheet } from "../utils/webclient_helpers";
import { createSpreadsheetFromPivot } from "../utils/pivot_helpers";

import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import { createModelWithDataSource } from "../spreadsheet_test_utils";

const { cellMenuRegistry } = spreadsheet.registries;

const { module, test } = QUnit;

module("documents_spreadsheet > pivot_view");

test("simple pivot export", async (assert) => {
    assert.expect(8);
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="foo" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.strictEqual(Object.values(getCells(model)).length, 6);
    assert.strictEqual(getCellFormula(model, "A1"), "");
    assert.strictEqual(getCellFormula(model, "A2"), "");
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1")');
    assert.strictEqual(getCellFormula(model, "B1"), '=PIVOT.HEADER("1")');
    assert.strictEqual(getCellFormula(model, "B2"), '=PIVOT.HEADER("1","measure","foo")');
    assert.strictEqual(getCellFormula(model, "B3"), '=PIVOT("1","foo")');
    assert.strictEqual(getCell(model, "B3").format, "#,##0.00");
});

test("simple pivot export with two measures", async (assert) => {
    assert.expect(10);
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="foo" type="measure"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.strictEqual(Object.values(getCells(model)).length, 9);
    assert.strictEqual(getCellFormula(model, "B1"), '=PIVOT.HEADER("1")');
    assert.strictEqual(getCellFormula(model, "B2"), '=PIVOT.HEADER("1","measure","foo")');
    assert.strictEqual(getCell(model, "B2").style.bold, undefined);
    assert.strictEqual(getCellFormula(model, "C2"), '=PIVOT.HEADER("1","measure","probability")');
    assert.strictEqual(getCellFormula(model, "B3"), '=PIVOT("1","foo")');
    assert.strictEqual(getCell(model, "B3").format, "#,##0.00");
    assert.strictEqual(getCellFormula(model, "C3"), '=PIVOT("1","probability")');
    assert.strictEqual(getCell(model, "C3").format, "#,##0.00");
    assert.deepEqual(getMerges(model), ["B1:C1"]);
});

test("pivot with two measures: total cells above measures totals are merged in one", async (assert) => {
    assert.expect(2);
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="date" interval="week" type="row"/>
                        <field name="foo" type="measure"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    const merges = getMerges(model);
    assert.strictEqual(merges.length, 5);
    assert.strictEqual(merges[4], "J1:K1");
});

test("groupby date field without interval defaults to month", async (assert) => {
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <!-- no interval specified -->
                        <field name="date" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    const pivot = model.getters.getPivotDefinition("1");
    assert.deepEqual(pivot, {
        colGroupBys: ["foo"],
        context: {},
        domain: [],
        id: "1",
        measures: ["probability"],
        model: "partner",
        rowGroupBys: ["date"],
    });
    assert.equal(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","date","04/2016")');
    assert.equal(getCellFormula(model, "A4"), '=PIVOT.HEADER("1","date","10/2016")');
    assert.equal(getCellFormula(model, "A5"), '=PIVOT.HEADER("1","date","12/2016")');
    assert.equal(getCellFormula(model, "B3"), '=PIVOT("1","probability","date","04/2016","foo","1")');
    assert.equal(getCellFormula(model, "B4"), '=PIVOT("1","probability","date","10/2016","foo","1")');
    assert.equal(getCellFormula(model, "B5"), '=PIVOT("1","probability","date","12/2016","foo","1")');
    assert.equal(getCellValue(model, "A3"), "April 2016");
    assert.equal(getCellValue(model, "A4"), "October 2016");
    assert.equal(getCellValue(model, "A5"), "December 2016");
    assert.equal(getCellValue(model, "B3"), "");
    assert.equal(getCellValue(model, "B4"), "11");
    assert.equal(getCellValue(model, "B5"), "");
});

test("pivot with one level of group bys", async (assert) => {
    assert.expect(7);
    const { model } = await createSpreadsheetFromPivot();
    assert.strictEqual(Object.values(getCells(model)).length, 30);
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","bar","false")');
    assert.strictEqual(getCellFormula(model, "A4"), '=PIVOT.HEADER("1","bar","true")');
    assert.strictEqual(getCellFormula(model, "A5"), '=PIVOT.HEADER("1")');
    assert.strictEqual(
        getCellFormula(model, "B2"),
        '=PIVOT.HEADER("1","foo","1","measure","probability")'
    );
    assert.strictEqual(
        getCellFormula(model, "C3"),
        '=PIVOT("1","probability","bar","false","foo","2")'
    );
    assert.strictEqual(getCellFormula(model, "F5"), '=PIVOT("1","probability")');
});

test("pivot with two levels of group bys in rows", async (assert) => {
    assert.expect(9);
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
        actions: async (target) => {
            await click(target.querySelector("tbody .o_pivot_header_cell_closed"));
            await click(target.querySelectorAll(".dropdown-item")[2]);
        },
    });
    assert.strictEqual(Object.values(getCells(model)).length, 16);
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","bar","false")');
    assert.deepEqual(getCell(model, "A3").style, { fillColor: "#f2f2f2", bold: true });
    assert.strictEqual(
        getCellFormula(model, "A4"),
        '=PIVOT.HEADER("1","bar","false","product_id","41")'
    );
    assert.deepEqual(getCell(model, "A4").style, { fillColor: "#f2f2f2" });
    assert.strictEqual(getCellFormula(model, "A5"), '=PIVOT.HEADER("1","bar","true")');
    assert.strictEqual(
        getCellFormula(model, "A6"),
        '=PIVOT.HEADER("1","bar","true","product_id","37")'
    );
    assert.strictEqual(
        getCellFormula(model, "A7"),
        '=PIVOT.HEADER("1","bar","true","product_id","41")'
    );
    assert.strictEqual(getCellFormula(model, "A8"), '=PIVOT.HEADER("1")');
});

test("verify that there is a record for an undefined header", async (assert) => {
    assert.expect(1);

    const data = getBasicData();

    data.partner.records = [
        {
            id: 1,
            foo: 12,
            bar: true,
            date: "2016-04-14",
            product_id: false,
            probability: 10,
        },
    ];

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: data,
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","product_id","false")');
});

test("undefined date is inserted in pivot", async (assert) => {
    assert.expect(1);

    const data = getBasicData();
    data.partner.records = [
        {
            id: 1,
            foo: 12,
            bar: true,
            date: false,
            product_id: 37,
            probability: 10,
        },
    ];

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: data,
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="date" interval="day" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","date:day","false")');
});

test("pivot with two levels of group bys in cols", async (assert) => {
    assert.expect(12);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="bar" type="col"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
        actions: async (target) => {
            await click(target.querySelector("thead .o_pivot_header_cell_closed"));
            await click(target.querySelectorAll(".dropdown-item")[2]);
        },
    });
    assert.strictEqual(Object.values(getCells(model)).length, 20);
    assert.strictEqual(getCellContent(model, "A1"), "");
    assert.deepEqual(getCell(model, "A4").style, { fillColor: "#f2f2f2", bold: true });
    assert.strictEqual(getCellFormula(model, "B1"), '=PIVOT.HEADER("1","bar","false")');
    assert.strictEqual(
        getCellFormula(model, "B2"),
        '=PIVOT.HEADER("1","bar","false","product_id","41")'
    );
    assert.strictEqual(
        getCellFormula(model, "B3"),
        '=PIVOT.HEADER("1","bar","false","product_id","41","measure","probability")'
    );
    assert.deepEqual(getCell(model, "C2").style, { fillColor: "#f2f2f2", bold: true });
    assert.strictEqual(getCellFormula(model, "C1"), '=PIVOT.HEADER("1","bar","true")');
    assert.strictEqual(
        getCellFormula(model, "C2"),
        '=PIVOT.HEADER("1","bar","true","product_id","37")'
    );
    assert.strictEqual(
        getCellFormula(model, "C3"),
        '=PIVOT.HEADER("1","bar","true","product_id","37","measure","probability")'
    );
    assert.strictEqual(
        getCellFormula(model, "D2"),
        '=PIVOT.HEADER("1","bar","true","product_id","41")'
    );
    assert.strictEqual(
        getCellFormula(model, "D3"),
        '=PIVOT.HEADER("1","bar","true","product_id","41","measure","probability")'
    );
});

test("pivot with count as measure", async (assert) => {
    assert.expect(3);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
        actions: async (target) => {
            await toggleMenu(target, "Measures");
            await toggleMenuItem(target, "Count");
        },
    });
    assert.strictEqual(Object.keys(getCells(model)).length, 9);
    assert.strictEqual(getCellFormula(model, "C2"), '=PIVOT.HEADER("1","measure","__count")');
    assert.strictEqual(getCellFormula(model, "C3"), '=PIVOT("1","__count")');
});

test("pivot with two levels of group bys in cols with not enough cols", async (assert) => {
    assert.expect(1);

    const data = getBasicData();
    // add many values in a subgroup
    for (let i = 0; i < 70; i++) {
        data.product.records.push({
            id: i + 9999,
            display_name: i.toString(),
        });
        data.partner.records.push({
            id: i + 9999,
            bar: i % 2 === 0,
            product_id: i + 9999,
            probability: i,
        });
    }

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: data,
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="bar" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
        actions: async (target) => {
            await click(target.querySelector("thead .o_pivot_header_cell_closed"));
            await click(target.querySelectorAll(".dropdown-item")[2]);
        },
    });
    // 72 products * 1 groups + 1 row header + 1 total col
    assert.strictEqual(model.getters.getActiveSheet().cols.length, 75);
});

test("user related context is not saved in the spreadsheet", async function (assert) {
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
            allowed_companies: { 15: { id: 15, name: "Hermit" } },
            current_company: 15,
        },
        user_context: context,
    };
    patchWithCleanup(session, testSession);
    const { model, env } = await createSpreadsheetFromPivot();
    assert.deepEqual(env.services.user.context, context, "context is used for spreadsheet action");
    assert.deepEqual(
        model.exportData().pivots[1].context,
        {
            default_stage_id: 5,
            search_default_stage_id: 5,
        },
        "user related context is not stored in context"
    );
});

test("user context is combined with pivot context to fetch data", async function (assert) {
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
        pivots: {
            1: {
                id: 1,
                colGroupBys: ["foo"],
                domain: [],
                measures: [{ field: "probability", operator: "avg" }],
                model: "partner",
                rowGroupBys: ["bar"],
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
                case "read_group":
                    assert.step("read_group");
                    assert.deepEqual(kwargs.context, expectedFetchContext, "read_group");
                    break;
            }
        },
    });
    assert.verifySteps(["read_group", "read_group", "read_group", "read_group"]);
});

test("groupby week is sorted", async (assert) => {
    assert.expect(4);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="date" interval="week" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.strictEqual(getCellFormula(model, "A3"), `=PIVOT.HEADER("1","date:week","15/2016")`);
    assert.strictEqual(getCellFormula(model, "A4"), `=PIVOT.HEADER("1","date:week","43/2016")`);
    assert.strictEqual(getCellFormula(model, "A5"), `=PIVOT.HEADER("1","date:week","49/2016")`);
    assert.strictEqual(getCellFormula(model, "A6"), `=PIVOT.HEADER("1","date:week","50/2016")`);
});

test("Can save a pivot in a new spreadsheet", async (assert) => {
    assert.expect(2);

    const legacyServicesRegistry = new legacyRegistry();
    const LocalStorageService = AbstractStorageService.extend({
        storage: new RamStorage(),
    });
    legacyServicesRegistry.add(
        "bus_service",
        BusService.extend({
            _poll() {},
        })
    );
    legacyServicesRegistry.add("local_storage", LocalStorageService);

    const serverData = {
        models: getBasicData(),
        views: {
            "partner,false,pivot": /* xml */ `
                 <pivot string="Partners">
                     <field name="probability" type="measure"/>
                 </pivot>`,
            "partner,false,search": /* xml */ `<search/>`,
        },
    };
    await prepareWebClientForSpreadsheet();
    const webClient = await createWebClient({
        serverData,
        legacyParams: {
            withLegacyMockServer: true,
            serviceRegistry: legacyServicesRegistry,
        },
        mockRPC: function (route, args) {
            if (args.method === "has_group") {
                return Promise.resolve(true);
            }
            if (route.includes("get_spreadsheets_to_display")) {
                return [{ id: 1, name: "My Spreadsheet" }];
            }
            if (args.method === "create" && args.model === "documents.document") {
                assert.step("create");
                return 1;
            }
        },
    });

    await doAction(webClient, {
        res_model: "partner",
        type: "ir.actions.act_window",
        views: [[false, "pivot"]],
    });
    const target = getFixture();
    await click(target.querySelector(".o_pivot_add_spreadsheet"));
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    assert.verifySteps(["create"]);
});

test("Can save a pivot in existing spreadsheet", async (assert) => {
    assert.expect(3);

    const legacyServicesRegistry = new legacyRegistry();
    const LocalStorageService = AbstractStorageService.extend({
        storage: new RamStorage(),
    });
    legacyServicesRegistry.add("local_storage", LocalStorageService);
    legacyServicesRegistry.add(
        "bus_service",
        BusService.extend({
            _poll() {},
        })
    );

    const serverData = {
        models: getBasicData(),
        views: {
            "partner,false,pivot": /* xml */ `
                 <pivot string="Partners">
                     <field name="probability" type="measure"/>
                 </pivot>`,
            "partner,false,search": /* xml */ `<search/>`,
        },
    };
    await prepareWebClientForSpreadsheet();
    const webClient = await createWebClient({
        serverData,
        legacyParams: {
            withLegacyMockServer: true,
            serviceRegistry: legacyServicesRegistry,
        },
        mockRPC: function (route, args) {
            if (args.method === "has_group") {
                return Promise.resolve(true);
            }
            if (route === "/web/action/load") {
                assert.step("write");
                return { id: args.action_id, type: "ir.actions.act_window_close" };
            }
            if (route.includes("join_spreadsheet_session")) {
                assert.step("join_spreadsheet_session");
            }
            if (args.model === "documents.document") {
                switch (args.method) {
                    case "get_spreadsheets_to_display":
                        return [{ id: 1, name: "My Spreadsheet" }];
                }
            }
        },
    });

    await doAction(webClient, {
        res_model: "partner",
        type: "ir.actions.act_window",
        views: [[false, "pivot"]],
    });
    const target = getFixture();
    await click(target.querySelector(".o_pivot_add_spreadsheet"));
    await click(document.querySelector(".modal-content select"));
    document.body
        .querySelector(".modal-content option[value='1']")
        .setAttribute("selected", "selected");
    await nextTick();
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    await doAction(webClient, 1); // leave the spreadsheet action
    assert.verifySteps(["join_spreadsheet_session", "write"]);
});

test("Add pivot sheet at the end of existing spreadsheet", async (assert) => {
    assert.expect(4);

    let callback;
    const { model, spreadsheetAction } = await createSpreadsheetFromPivot();
    const pivotData = spreadsheetAction.params.preProcessingAsyncActionData;
    callback = insertPivot.bind({ ...spreadsheetAction, isEmptySpreadsheet: false })(
        pivotData
    );
    model.dispatch("CREATE_SHEET", { sheetId: "42", position: 1 });
    const activeSheetId = model.getters.getActiveSheetId();
    assert.deepEqual(model.getters.getSheetIds(), [activeSheetId, "42"]);
    await callback(model);
    assert.strictEqual(model.getters.getSheetIds().length, 3);
    assert.deepEqual(model.getters.getSheetIds()[0], activeSheetId);
    assert.deepEqual(model.getters.getSheetIds()[1], "42");
});

test("pivot with a domain", async (assert) => {
    assert.expect(3);

    const { model } = await createSpreadsheetFromPivot({
        domain: [["bar", "=", true]],
    });
    const domain = model.getters.getPivotDefinition("1").domain;
    assert.deepEqual(domain, [["bar", "=", true]], "It should have the correct domain");
    assert.strictEqual(getCellFormula(model, "A3"), `=PIVOT.HEADER("1","bar","true")`);
    assert.strictEqual(getCellFormula(model, "A4"), `=PIVOT.HEADER("1")`);
});

test("Insert in spreadsheet is disabled when no measure is specified", async (assert) => {
    assert.expect(1);

    setupControlPanelServiceRegistry();
    const serviceRegistry = registry.category("services");
    serviceRegistry.add("dialog", dialogService);
    const serverData = {
        models: getBasicData(),
    };
    await makeView({
        type: "pivot",
        resModel: "partner",
        serverData,
        arch: `
        <pivot string="Partners">
            <field name="foo" type="measure"/>
        </pivot>`,
        mockRPC: function (route, args) {
            if (args.method === "has_group") {
                return Promise.resolve(true);
            }
        },
    });

    const target = getFixture();
    await toggleMenu(target, "Measures");
    await toggleMenuItem(target, "Foo");
    assert.ok(target.querySelector("button.o_pivot_add_spreadsheet").disabled);
});

test("Insert in spreadsheet is disabled when data is empty", async (assert) => {
    assert.expect(1);

    const serviceRegistry = registry.category("services");
    setupControlPanelServiceRegistry();
    serviceRegistry.add("dialog", dialogService);

    const data = getBasicData();
    data.partner.records = [];
    data.product.records = [];
    const serverData = {
        models: data,
    };

    await makeView({
        type: "pivot",
        resModel: "partner",
        serverData,
        arch: `
        <pivot string="Partners">
            <field name="foo" type="measure"/>
        </pivot>`,
        mockRPC: function (route, args) {
            if (args.method === "has_group") {
                return Promise.resolve(true);
            }
        },
    });
    assert.ok(document.body.querySelector("button.o_pivot_add_spreadsheet").disabled);
});

test("pivot with a quote in name", async function (assert) {
    assert.expect(1);

    const data = getBasicData();
    data.product.records.push({
        id: 42,
        display_name: `name with "`,
    });
    const { model } = await createSpreadsheetFromPivot({
        model: "product",
        serverData: {
            models: data,
            views: {
                "product,false,pivot": `
                    <pivot string="Products">
                            <field name="display_name" type="col"/>
                            <field name="id" type="row"/>
                        </pivot>`,
                "product,false,search": `<search/>`,
            },
        },
    });
    assert.equal(getCellContent(model, "B1"), `=PIVOT.HEADER("1","display_name","name with \\"")`);
});

test("group by related field with archived record", async function (assert) {
    assert.expect(3);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="name" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.equal(getCellContent(model, "B1"), `=PIVOT.HEADER("1","product_id","37")`);
    assert.equal(getCellContent(model, "C1"), `=PIVOT.HEADER("1","product_id","41")`);
    assert.equal(getCellContent(model, "D1"), `=PIVOT.HEADER("1")`);
});

test("group by regular field with archived record", async function (assert) {
    assert.expect(4);

    const data = getBasicData();
    data.partner.records[0].active = false;
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: data,
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    assert.equal(getCellContent(model, "A3"), `=PIVOT.HEADER("1","foo","1")`);
    assert.equal(getCellContent(model, "A4"), `=PIVOT.HEADER("1","foo","2")`);
    assert.equal(getCellContent(model, "A5"), `=PIVOT.HEADER("1","foo","17")`);
    assert.equal(getCellContent(model, "A6"), `=PIVOT.HEADER("1")`);
});

test("can select a Pivot from cell formula", async function (assert) {
    assert.expect(1);
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    const sheetId = model.getters.getActiveSheetId();
    const pivotId = model.getters.getPivotIdFromPosition(sheetId, 2, 2);
    model.dispatch("SELECT_PIVOT", { pivotId });
    const selectedPivotId = model.getters.getSelectedPivotId();
    assert.strictEqual(selectedPivotId, "1");
});

test("can select a Pivot from cell formula with '-' before the formula", async function (assert) {
    assert.expect(1);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    model.dispatch("SET_VALUE", {
        xc: "C3",
        text: `=-PIVOT("1","probability","bar","false","foo","2")`,
    });
    const sheetId = model.getters.getActiveSheetId();
    const pivotId = model.getters.getPivotIdFromPosition(sheetId, 2, 2);
    model.dispatch("SELECT_PIVOT", { pivotId });
    const selectedPivotId = model.getters.getSelectedPivotId();
    assert.strictEqual(selectedPivotId, "1");
});

test("can select a Pivot from cell formula with other numerical values", async function (assert) {
    assert.expect(1);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    model.dispatch("SET_VALUE", {
        xc: "C3",
        text: `=3*PIVOT("1","probability","bar","false","foo","2")+2`,
    });
    const sheetId = model.getters.getActiveSheetId();
    const pivotId = model.getters.getPivotIdFromPosition(sheetId, 2, 2);
    model.dispatch("SELECT_PIVOT", { pivotId });
    const selectedPivotId = model.getters.getSelectedPivotId();
    assert.strictEqual(selectedPivotId, "1");
});

test("can select a Pivot from cell formula where pivot is in a function call", async function (assert) {
    assert.expect(1);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    model.dispatch("SET_VALUE", {
        xc: "C3",
        text: `=SUM(PIVOT("1","probability","bar","false","foo","2"),PIVOT("1","probability","bar","false","foo","2"))`,
    });
    const sheetId = model.getters.getActiveSheetId();
    const pivotId = model.getters.getPivotIdFromPosition(sheetId, 2, 2);
    model.dispatch("SELECT_PIVOT", { pivotId });
    const selectedPivotId = model.getters.getSelectedPivotId();
    assert.strictEqual(selectedPivotId, "1");
});

test("can select a Pivot from cell formula where the id is a reference", async function (assert) {
    assert.expect(1);
    const { model } = await createSpreadsheetFromPivot();
    setCellContent(model, "C3", `=PIVOT(G10,"probability","bar","false","foo","2")+2`);
    setCellContent(model, "G10", "1");
    const sheetId = model.getters.getActiveSheetId();
    const pivotId = model.getters.getPivotIdFromPosition(sheetId, 2, 2);
    model.dispatch("SELECT_PIVOT", { pivotId });
    const selectedPivotId = model.getters.getSelectedPivotId();
    assert.strictEqual(selectedPivotId, "1");
});

test("Columns of newly inserted pivot are auto-resized", async function (assert) {
    assert.expect(1);

    const data = getBasicData();
    data.partner.fields.probability.string = "Probability with a super long name";
    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: data,
            views: getBasicServerData().views,
        },
    });
    const sheetId = model.getters.getActiveSheetId();
    const defaultColSize = 96;
    assert.ok(model.getters.getCol(sheetId, 1).size > defaultColSize, "Column should be resized");
});

test("can select a Pivot from cell formula (Mix of test scenarios above)", async function (assert) {
    assert.expect(1);

    const { model } = await createSpreadsheetFromPivot({
        serverData: {
            models: getBasicData(),
            views: {
                "partner,false,pivot": /* xml */ `
                    <pivot string="Partners">
                        <field name="product_id" type="col"/>
                        <field name="foo" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,false,search": /* xml */ `<search/>`,
            },
        },
    });
    model.dispatch("SET_VALUE", {
        xc: "C3",
        text: `=3*SUM(PIVOT("1","probability","bar","false","foo","2"),PIVOT("1","probability","bar","false","foo","2"))+2*PIVOT("1","probability","bar","false","foo","2")`,
    });
    const sheetId = model.getters.getActiveSheetId();
    const pivotId = model.getters.getPivotIdFromPosition(sheetId, 2, 2);
    model.dispatch("SELECT_PIVOT", { pivotId });
    const selectedPivotId = model.getters.getSelectedPivotId();
    assert.strictEqual(selectedPivotId, "1");
});

test("Can remove a pivot with undo after editing a cell", async function (assert) {
    assert.expect(4);
    const { model } = await createSpreadsheetFromPivot();
    assert.ok(getCellContent(model, "B1").startsWith("=PIVOT.HEADER"));
    setCellContent(model, "G10", "should be undoable");
    model.dispatch("REQUEST_UNDO");
    assert.equal(getCellContent(model, "G10"), "");
    // 2 REQUEST_UNDO because of the AUTORESIZE feature
    model.dispatch("REQUEST_UNDO");
    model.dispatch("REQUEST_UNDO");
    assert.equal(getCellContent(model, "B1"), "");
    assert.equal(model.getters.getPivotIds().length, 0);
});

test("Format header correctly works with non-existing field", async function (assert) {
    assert.expect(2);
    const { model } = await createSpreadsheetFromPivot();
    setCellContent(model, "G10", `=PIVOT.HEADER("1", "measure", "non-existing")`);
    setCellContent(model, "G11", `=PIVOT.HEADER("1", "non-existing", "bla")`);
    await nextTick();
    assert.equal(getCellValue(model, "G10"), "non-existing");
    assert.equal(getCellValue(model, "G11"), "(Undefined)");
});

QUnit.test("Can reopen a sheet after see records", async function (assert) {
    assert.expect(1);
    const { webClient, spreadsheetAction } = await createSpreadsheetFromPivot();
    const { model } = await createSpreadsheetFromPivot({
        documentId: spreadsheetAction.resId,
        webClient,
    });
    // Go the the list view and go back, a third pivot should not be opened
    selectCell(model, "B3");
    const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
    const env = {
        ...webClient.env,
        model,
        services: model.config.evalContext.env.services,
    };
    await root.action(env);
    await nextTick();
    await click(document.body.querySelector(".o_back_button"));
    await nextTick();
    await legacyExtraNextTick();
    assert.strictEqual(model.getters.getPivotIds().length, 2);
});
