/** @odoo-module alias=documents_spreadsheet.SpreadsheetTests */
/* global $ */

import * as legacyRegistry from "web.Registry";
import * as RamStorage from "web.RamStorage";
import { makeFakeNotificationService } from "@web/../tests/helpers/mock_services";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { registry } from "@web/core/registry";
import { actionService } from "@web/webclient/actions/action_service";
import * as BusService from "bus.BusService";
import spreadsheet from "@documents_spreadsheet_bundle/o_spreadsheet/o_spreadsheet_extended";
import { click, getFixture, mockDownload } from "@web/../tests/helpers/utils";
import * as AbstractStorageService from "web.AbstractStorageService";
import { fields, nextTick, dom } from "web.test_utils";
import { createSpreadsheet, waitForEvaluation } from "./spreadsheet_test_utils";
import MockSpreadsheetCollaborativeChannel from "./utils/mock_spreadsheet_collaborative_channel";
import { getBasicData, getBasicServerData } from "./utils/spreadsheet_test_data";
import { getCell, getCellFormula, getCellValue } from "./utils/getters_helpers";
import {
    addGlobalFilter,
    selectCell,
    setCellContent,
    setGlobalFilterValue,
} from "./utils/commands_helpers";
import { joinSession, leaveSession } from "./utils/collaborative_helpers";
import { prepareWebClientForSpreadsheet } from "./utils/webclient_helpers";
import { createSpreadsheetFromPivot } from "./utils/pivot_helpers";

const { Model } = spreadsheet;
const { toCartesian } = spreadsheet.helpers;
const { cellMenuRegistry, topbarMenuRegistry } = spreadsheet.registries;

const { module, test } = QUnit;

function getConnectedUsersEl(target) {
    const numberUsers = $(target).find(".o_spreadsheet_number_users");
    return numberUsers[0].querySelector("i");
}

function getSynchedStatus(target) {
    return $(target).find(".o_spreadsheet_sync_status")[0].innerText;
}

function displayedConnectedUsers(target) {
    return parseInt(getConnectedUsersEl(target).innerText);
}

let target;

module("documents_spreadsheet > Spreadsheet Client Action", {
    beforeEach: function () {
        target = getFixture();
    },
}, function () {
    module("Spreadsheet control panel");

    test("Number of connected users is correctly rendered", async function (assert) {
        assert.expect(7);
        const { transportService } = await createSpreadsheet();
        assert.equal(displayedConnectedUsers(target), 1, "It should display one connected user");
        assert.hasClass(
            getConnectedUsersEl(target),
            "fa-user",
            "It should display the fa-user icon"
        );
        joinSession(transportService, { id: 1234, userId: 9999 });
        await nextTick();
        assert.equal(
            displayedConnectedUsers(target),
            2,
            "It should display two connected users"
        );
        assert.hasClass(
            getConnectedUsersEl(target),
            "fa-users",
            "It should display the fa-users icon"
        );

        // The same user is connected with two different tabs.
        joinSession(transportService, { id: 4321, userId: 9999 });
        await nextTick();
        assert.equal(
            displayedConnectedUsers(target),
            2,
            "It should display two connected users"
        );

        leaveSession(transportService, 4321);
        await nextTick();
        assert.equal(
            displayedConnectedUsers(target),
            2,
            "It should display two connected users"
        );

        leaveSession(transportService, 1234);
        await nextTick();
        assert.equal(displayedConnectedUsers(target), 1, "It should display one connected user");
    });

    test("spreadsheet with generic untitled name is styled", async function (assert) {
        assert.expect(4);
        await createSpreadsheet();
        const input = $(target).find(".breadcrumb-item input")[0];
        assert.hasClass(input, "o-spreadsheet-untitled", "It should be styled as untitled");
        await fields.editInput(input, "My");
        assert.doesNotHaveClass(
            input,
            "o-spreadsheet-untitled",
            "It should not be styled as untitled"
        );
        await fields.editInput(input, "Untitled spreadsheet");
        assert.hasClass(input, "o-spreadsheet-untitled", "It should be styled as untitled");
        await fields.editInput(input, "");
        assert.hasClass(input, "o-spreadsheet-untitled", "It should be styled as untitled");
    });

    test("open spreadsheet with deprecated `active_id` params", async function (assert) {
        assert.expect(4);
        await prepareWebClientForSpreadsheet();
        const webClient = await createWebClient({
            serverData: { models: getBasicData() },
            mockRPC: async function (route, args) {
                if (args.method === "join_spreadsheet_session") {
                    assert.step("spreadsheet-loaded");
                    assert.equal(args.args[0], 1, "It should load the correct spreadsheet");
                }
            },
        });
        await doAction(webClient, {
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                active_id: 1,
            },
        });
        assert.containsOnce(target, ".o-spreadsheet", "It should have opened the spreadsheet");
        assert.verifySteps(["spreadsheet-loaded"]);
    });

    test("download spreadsheet with the action param `download`", async function (assert) {
        assert.expect(4);
        await prepareWebClientForSpreadsheet();
        mockDownload(async (options) => {
            assert.step(options.url);
            assert.ok(options.data.zip_name);
            assert.ok(options.data.files);
        });
        const webClient = await createWebClient({
            serverData: getBasicServerData(),
        });
        await doAction(webClient, {
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: 1,
                download: true,
            },
        });
        await nextTick();
        assert.verifySteps(["/documents/xlsx"]);
    });

    test("Can download xlsx file", async function (assert) {
        assert.expect(4);
        mockDownload((options) => {
            assert.step(options.url);
            assert.ok(options.data.zip_name);
            assert.ok(options.data.files);
        });
        const { env } = await createSpreadsheet();
        const file = topbarMenuRegistry.getAll().find((item) => item.id === "file");
        const download = file.children.find((item) => item.id === "download");
        await download.action(env);
        assert.verifySteps(["/documents/xlsx"]);
    });

    test("Sync status is correctly rendered", async function (assert) {
        assert.expect(3);
        const { model, transportService } = await createSpreadsheetFromPivot();
        await nextTick();
        assert.strictEqual(getSynchedStatus(target), " Saved");
        await transportService.concurrent(async () => {
            setCellContent(model, "A1", "hello");
            await nextTick();
            assert.strictEqual(getSynchedStatus(target), " Saving");
        });
        await nextTick();
        assert.strictEqual(getSynchedStatus(target), " Saved");
    });

    test("breadcrumb is rendered in control panel", async function (assert) {
        assert.expect(4);

        const actions = {
            1: {
                id: 1,
                name: "Documents",
                res_model: "documents.document",
                type: "ir.actions.act_window",
                views: [[false, "list"]],
            },
        };
        const views = {
            "documents.document,false,list": '<tree><field name="name"/></tree>',
            "documents.document,false,search": "<search></search>",
        };
        const serverData = { actions, models: getBasicData(), views };
        await prepareWebClientForSpreadsheet();
        const webClient = await createWebClient({
            serverData,
            legacyParams: { withLegacyMockServer: true },
        });
        await doAction(webClient, 1);
        await doAction(webClient, {
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: 1,
                transportService: new MockSpreadsheetCollaborativeChannel(),
            },
        });
        const breadcrumbItems = $(target).find(".breadcrumb-item");
        assert.equal(
            breadcrumbItems[0].querySelector("a").innerText,
            "Documents",
            "It should display the breadcrumb"
        );
        assert.equal(
            breadcrumbItems[1].querySelector("input").value,
            "My spreadsheet",
            "It should display the spreadsheet title"
        );
        assert.ok(
            breadcrumbItems[1].querySelector(".o_spreadsheet_favorite"),
            "It should display the favorite toggle button"
        );
        assert.equal(breadcrumbItems.length, 2, 'The breadcrumb should only contain two list items');
    });

    test("untitled spreadsheet", async function (assert) {
        assert.expect(3);
        await createSpreadsheet({ spreadsheetId: 2 });
        const input = $(target).find(".breadcrumb-item input")[0];
        assert.hasClass(input, "o-spreadsheet-untitled", "It should be styled as untitled");
        assert.equal(input.value, "", "It should be empty");
        assert.equal(input.placeholder, "Untitled spreadsheet", "It should display a placeholder");
        await nextTick();
    });

    test("input width changes when content changes", async function (assert) {
        assert.expect(2);
        await createSpreadsheet();
        const input = $(target).find(".breadcrumb-item input")[0];
        await fields.editInput(input, "My");
        let width = input.offsetWidth;
        await fields.editInput(input, "My title");
        assert.ok(width < input.offsetWidth, "It should have grown to fit content");
        width = input.offsetWidth;
        await fields.editInput(input, "");
        assert.ok(width < input.offsetWidth, "It should have the size of the placeholder text");
    });

    test("changing the input saves the name", async function (assert) {
        assert.expect(1);
        const serverData = getBasicServerData();
        await createSpreadsheet({ spreadsheetId: 2, serverData });
        const input = $(target).find(".breadcrumb-item input")[0];
        await fields.editAndTrigger(input, "My spreadsheet", ["change"]);
        assert.equal(
            serverData.models["documents.document"].records[1].name,
            "My spreadsheet",
            "It should have updated the name"
        );
    });

    test("trailing white spaces are trimmed", async function (assert) {
        assert.expect(2);
        await createSpreadsheet();
        const input = $(target).find(".breadcrumb-item input")[0];
        await fields.editInput(input, "My spreadsheet  ");
        const width = input.offsetWidth;
        await dom.triggerEvent(input, "change");
        assert.equal(input.value, "My spreadsheet", "It should not have trailing white spaces");
        assert.ok(width > input.offsetWidth, "It should have resized");
    });

    test("focus sets the placeholder as value and select it", async function (assert) {
        assert.expect(4);
        await createSpreadsheet({ spreadsheetId: 2 });
        const input = $(target).find(".breadcrumb-item input")[0];
        assert.equal(input.value, "", "It should be empty");
        await dom.triggerEvent(input, "focus");
        assert.equal(
            input.value,
            "Untitled spreadsheet",
            "Placeholder should have become the input value"
        );
        assert.equal(input.selectionStart, 0, "It should have selected the value");
        assert.equal(input.selectionEnd, input.value.length, "It should have selected the value");
    });

    test("receiving bad revision reload", async function (assert) {
        assert.expect(2);
        const serviceRegistry = registry.category("services");
        serviceRegistry.add("actionMain", actionService);
        const fakeActionService = {
            dependencies: ["actionMain"],
            start(env, { actionMain }) {
                return Object.assign({}, actionMain, {
                    doAction: (actionRequest, options = {}) => {
                        if (actionRequest === "reload_context") {
                            assert.step("reload");
                            return Promise.resolve();
                        }
                        return actionMain.doAction(actionRequest, options);
                    },
                });
            },
        };
        serviceRegistry.add("action", fakeActionService, { force: true });
        const { transportService } = await createSpreadsheet();
        transportService.broadcast({
            type: "REMOTE_REVISION",
            serverRevisionId: "an invalid revision id",
            nextRevisionId: "the next revision id",
            revision: {},
        });
        assert.verifySteps(["reload"]);
    });

    test("only white spaces show the placeholder", async function (assert) {
        assert.expect(2);
        await createSpreadsheet();
        const input = $(target).find(".breadcrumb-item input")[0];
        await fields.editInput(input, "  ");
        const width = input.offsetWidth;
        await dom.triggerEvent(input, "change");
        assert.equal(input.value, "", "It should be empty");
        assert.ok(width < input.offsetWidth, "It should have the placeholder size");
    });

    test("toggle favorite", async function (assert) {
        assert.expect(5);
        await createSpreadsheet({
            spreadsheetId: 1,
            mockRPC: async function (route, args) {
                if (args.method === "toggle_favorited" && args.model === "documents.document") {
                    assert.step("favorite_toggled");
                    assert.deepEqual(args.args[0], [1], "It should write the correct document");
                    return true;
                }
                if (route.includes("dispatch_spreadsheet_message")) {
                    return Promise.resolve();
                }
            },
        });
        assert.containsNone(target, ".favorite_button_enabled");
        const favorite = $(target).find(".o_spreadsheet_favorite")[0];
        await dom.click(favorite);
        assert.containsOnce(target, ".favorite_button_enabled");
        assert.verifySteps(["favorite_toggled"]);
    });

    test("already favorited", async function (assert) {
        assert.expect(1);
        await createSpreadsheet({ spreadsheetId: 2 });
        assert.containsOnce(
            target,
            ".favorite_button_enabled",
            "It should already be favorited"
        );
    });

    test("Spreadsheet action is named in breadcrumb", async function (assert) {
        assert.expect(3);
        const { webClient } = await createSpreadsheetFromPivot();
        await doAction(webClient, {
            name: "Partner",
            res_model: "partner",
            type: "ir.actions.act_window",
            views: [[false, "pivot"]],
        });
        await nextTick();
        const items = $(target).find(".breadcrumb-item");
        const [breadcrumb1, breadcrumb2, breadcrumb3] = Array.from(items).map(
            (item) => item.innerText
        );
        assert.equal(breadcrumb1, "pivot view");
        assert.equal(breadcrumb2, "Untitled spreadsheet");
        assert.equal(breadcrumb3, "Partner");
    });

    test("Spreadsheet action is named in breadcrumb with the updated name", async function (assert) {
        assert.expect(3);
        const { webClient } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="foo" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        const input = $(target).find(".breadcrumb-item input")[0];
        await fields.editAndTrigger(input, "My awesome spreadsheet", ["change"]);
        await doAction(webClient, {
            name: "Partner",
            res_model: "partner",
            type: "ir.actions.act_window",
            views: [[false, "pivot"]],
        });
        await nextTick();
        const items = $(target).find(".breadcrumb-item");
        const [breadcrumb1, breadcrumb2, breadcrumb3] = Array.from(items).map(
            (item) => item.innerText
        );
        assert.equal(breadcrumb1, "pivot view");
        assert.equal(breadcrumb2, "My awesome spreadsheet");
        assert.equal(breadcrumb3, "Partner");
    });

    module("Spreadsheet");

    test("relational PIVOT.HEADER with missing id", async function (assert) {
        assert.expect(2);

        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="product_id" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("UPDATE_CELL", {
            col: 4,
            row: 9,
            content: `=PIVOT.HEADER("1", "product_id", "1111111")`,
            sheetId,
        });

        await waitForEvaluation(model);
        assert.ok(getCell(model, "E10").evaluated.error);
        assert.equal(
            getCell(model, "E10").evaluated.error,
            "Unable to fetch the label of 1111111 of model product"
        );
    });

    test("relational PIVOT.HEADER with undefined id", async function (assert) {
        assert.expect(2);

        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        setCellContent(model, "F10", `=PIVOT.HEADER("1", "product_id", A25)`);
        assert.equal(getCell(model, "A25"), null, "the cell should be empty");
        await waitForEvaluation(model);
        assert.equal(getCellValue(model, "F10"), "(Undefined)");
    });

    test("Reinsert a pivot", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromPivot();
        selectCell(model, "D8");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
        const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
        await reinsertPivot1.action(env);
        assert.equal(
            getCellFormula(model, "E10"),
            `=PIVOT("1","probability","bar","false","foo","1")`,
            "It should contain a pivot formula"
        );
    });

    test("Reinsert a pivot in a too small sheet", async function (assert) {
        assert.expect(3);

        const { model, env } = await createSpreadsheetFromPivot();
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
        assert.equal(model.getters.getActiveSheet().cols.length, 7);
        assert.equal(model.getters.getActiveSheet().rows.length, 6);
        assert.equal(
            getCellFormula(model, "B3"),
            `=PIVOT("1","probability","bar","false","foo","1")`,
            "It should contain a pivot formula"
        );
    });

    test("Reinsert a pivot with new data", async function (assert) {
        assert.expect(2);

        const data = getBasicData();

        const { model, env } = await createSpreadsheetFromPivot({
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
        });
        selectCell(model, "D8");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
        const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
        await reinsertPivot1.action(env);
        assert.equal(getCellFormula(model, "I8"), `=PIVOT.HEADER("1","foo","25")`);
        assert.equal(
            getCellFormula(model, "I10"),
            `=PIVOT("1","probability","bar","false","foo","25")`
        );
    });

    test("Reinsert a pivot with an updated record", async function (assert) {
        assert.expect(5);
        const data = getBasicData();

        const { model, env } = await createSpreadsheetFromPivot({
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

    test("Keep applying filter when pivot is re-inserted", async function (assert) {
        assert.expect(4);
        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot>
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
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

    test("undo pivot reinsert", async function (assert) {
        assert.expect(2);

        const { model, env } = await createSpreadsheetFromPivot();
        const sheetId = model.getters.getActiveSheetId();
        selectCell(model, "D8");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
        const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
        await reinsertPivot1.action(env);
        assert.equal(
            getCellFormula(model, "E10"),
            `=PIVOT("1","probability","bar","false","foo","1")`,
            "It should contain a pivot formula"
        );
        model.dispatch("REQUEST_UNDO");
        assert.notOk(
            model.getters.getCell(sheetId, 4, 9),
            "It should have removed the re-inserted pivot"
        );
    });

    test("reinsert pivot with anchor on merge but not top left", async function (assert) {
        assert.expect(3);

        const { model, env } = await createSpreadsheetFromPivot();
        const sheetId = model.getters.getActiveSheetId();
        assert.equal(
            getCellFormula(model, "B2"),
            `=PIVOT.HEADER("1","foo","1","measure","probability")`,
            "It should contain a pivot formula"
        );
        model.dispatch("ADD_MERGE", {
            sheetId,
            target: [{ top: 0, bottom: 1, left: 0, right: 0 }],
        });
        selectCell(model, "A2"); // A1 and A2 are merged; select A2
        assert.ok(model.getters.isInMerge(sheetId, ...toCartesian("A2")));
        const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
        const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
        await reinsertPivot1.action(env);
        assert.equal(
            getCellFormula(model, "B2"),
            `=PIVOT.HEADER("1","foo","1","measure","probability")`,
            "It should contain a pivot formula"
        );
    });

    test("Verify pivot measures are correctly computed :)", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        assert.equal(getCellValue(model, "B4"), 11);
        assert.equal(getCellValue(model, "C3"), 15);
        assert.equal(getCellValue(model, "D4"), 10);
        assert.equal(getCellValue(model, "E4"), 95);
    });

    test("Open pivot properties properties", async function (assert) {
        assert.expect(16);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot display_quantity="true">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        // opening from a pivot cell
        const sheetId = model.getters.getActiveSheetId();
        const pivotA3 = model.getters.getPivotIdFromPosition(sheetId, 0, 2);
        await model.getters.waitForPivotDataReady(pivotA3);
        model.dispatch("SELECT_PIVOT", { pivotId: pivotA3 });
        env.openSidePanel("PIVOT_PROPERTIES_PANEL", {
            pivot: pivotA3,
        });
        await nextTick();
        let title = $(target).find(".o-sidePanelTitle")[0].innerText;
        assert.equal(title, "Pivot properties");

        const sections = $(target).find(".o_side_panel_section");
        assert.equal(sections.length, 5, "it should have 5 sections");
        const [pivotName, pivotModel, domain, dimensions, measures] = sections;

        assert.equal(pivotName.children[0].innerText, "Pivot name");
        assert.equal(pivotName.children[1].innerText, "(#1) partner");

        assert.equal(pivotModel.children[0].innerText, "Model");
        assert.equal(pivotModel.children[1].innerText, "partner (partner)");

        assert.equal(domain.children[0].innerText, "Domain");
        assert.equal(domain.children[1].innerText, "Match all records");

        assert.equal(measures.children[0].innerText, "Measures");
        assert.equal(measures.children[1].innerText, "Count");
        assert.equal(measures.children[2].innerText, "Probability");

        assert.equal(dimensions.children[0].innerText, "Dimensions");
        assert.equal(dimensions.children[1].innerText, "Bar");
        assert.equal(dimensions.children[2].innerText, "Foo");

        // opening from a non pivot cell
        const pivotA1 = model.getters.getPivotIdFromPosition(sheetId, 0, 0);
        model.dispatch("SELECT_PIVOT", { pivotId: pivotA1 });
        env.openSidePanel("PIVOT_PROPERTIES_PANEL", {
            pivot: pivotA1,
        });
        await nextTick();
        title = $(target).find(".o-sidePanelTitle")[0].innerText;
        assert.equal(title, "Pivot properties");

        assert.containsOnce(target, ".o_side_panel_select");
    });

    test("Verify absence of pivot properties on non-pivot cell", async function (assert) {
        assert.expect(1);
        const { model, env } = await createSpreadsheetFromPivot();
        selectCell(model, "Z26");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "pivot_properties");
        assert.notOk(root.isVisible(env));
    });

    test("verify absence of pivots in top menu bar in a spreadsheet without a pivot", async function (assert) {
        assert.expect(1);
        await createSpreadsheet();
        assert.containsNone(target, "div[data-id='pivots']");
    });

    test("Verify presence of pivots in top menu bar in a spreadsheet with a pivot", async function (assert) {
        assert.expect(8);
        const { webClient, spreadsheetAction } = await createSpreadsheetFromPivot();
        const { env } = await createSpreadsheetFromPivot({
            webClient,
            documentId: spreadsheetAction.resId,
        });

        assert.ok(
            $(target).find("div[data-id='data']")[0],
            "The 'Pivots' menu should be in the dom"
        );

        const root = topbarMenuRegistry.getAll().find((item) => item.id === "data");
        const children = topbarMenuRegistry.getChildren(root, env);
        assert.equal(children.length, 6, "There should be 6 children in the menu");
        assert.equal(children[0].name, "(#1) partner");
        assert.equal(children[1].name, "(#2) partner");
        // bottom children
        assert.equal(children[2].name, "Refresh all data");
        assert.equal(children[3].name, "Re-insert pivot");
        assert.equal(children[4].name, "Insert pivot cell");
        assert.equal(children[5].name, "Re-insert list");
    });

    test("Pivot focus changes on top bar menu click", async function (assert) {
        assert.expect(3);
        const { webClient, spreadsheetAction } = await createSpreadsheetFromPivot();
        const { env, model } = await createSpreadsheetFromPivot({
            webClient,
            documentId: spreadsheetAction.resId,
        });

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

    test("Pivot focus changes on sidepanel click", async function (assert) {
        assert.expect(6);

        const { webClient, spreadsheetAction } = await createSpreadsheetFromPivot();
        const { env, model } = await createSpreadsheetFromPivot({
            webClient,
            documentId: spreadsheetAction.resId,
        });

        selectCell(model, "L1"); //target empty cell
        const root = cellMenuRegistry.getAll().find((item) => item.id === "pivot_properties");
        root.action(env);
        assert.notOk(model.getters.getSelectedPivotId(), "No pivot should be selected");
        await nextTick();
        assert.containsN(target, ".o_side_panel_select", 2);
        await dom.click($(target).find(".o_side_panel_select")[0]);
        assert.strictEqual(
            model.getters.getSelectedPivotId(),
            "1",
            "The selected pivot should be have the id 1"
        );
        await nextTick();
        await dom.click($(target).find(".o_pivot_cancel"));
        assert.notOk(model.getters.getSelectedPivotId(), "No pivot should be selected anymore");
        assert.containsN(target, ".o_side_panel_select", 2);
        await dom.click($(target).find(".o_side_panel_select")[1]);
        assert.strictEqual(
            model.getters.getSelectedPivotId(),
            "2",
            "The selected pivot should be have the id 2"
        );
    });

    test("Can refresh the pivot from the pivot properties panel", async function (assert) {
        assert.expect(1);

        const data = getBasicData();

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: data,
                views: getBasicServerData().views,
            },
        });
        data.partner.records.push({
            active: true,
            id: 5,
            foo: 12,
            bar: true,
            product: 37,
            probability: 10,
        });
        const sheetId = model.getters.getActiveSheetId();
        const pivotA3 = model.getters.getPivotIdFromPosition(sheetId, 0, 2);
        model.dispatch("SELECT_PIVOT", { pivotId: pivotA3 });
        env.openSidePanel("PIVOT_PROPERTIES_PANEL", {});
        await nextTick();
        await dom.click($(target).find(".o_refresh_measures")[0]);
        await nextTick();
        assert.equal(getCellValue(model, "D4"), 10 + 10);
    });

    test("Can make a copy", async function (assert) {
        assert.expect(4);
        const LocalStorageService = AbstractStorageService.extend({
            storage: new RamStorage(),
        });
        const legacyServicesRegistry = new legacyRegistry();
        legacyServicesRegistry.add(
            "bus_service",
            BusService.extend({
                _poll() {},
            })
        );
        legacyServicesRegistry.add("local_storage", LocalStorageService);
        const serverData = getBasicServerData();
        const spreadsheet = serverData.models["documents.document"].records[1];
        const { env, model } = await createSpreadsheet({
            spreadsheetId: spreadsheet.id,
            serverData,
            legacyServicesRegistry,
            mockRPC: async function (route, args) {
                if (args.method === "copy" && args.model === "documents.document") {
                    assert.step("copy");
                    assert.equal(
                        args.kwargs.default.raw,
                        JSON.stringify(model.exportData()),
                        "It should copy the data"
                    );
                    assert.equal(
                        args.kwargs.default.spreadsheet_snapshot,
                        false,
                        "It should reset the snapshot"
                    );
                    return 1;
                }
            },
        });
        const file = topbarMenuRegistry.getAll().find((item) => item.id === "file");
        const makeCopy = file.children.find((item) => item.id === "make_copy");
        makeCopy.action(env);
        assert.verifySteps(["copy"]);
    });

    test("Check pivot measures with m2o field", async function (assert) {
        assert.expect(3);
        const data = getBasicData();
        data.partner.records.push(
            { active: true, id: 5, foo: 12, bar: true, product_id: 37, probability: 50 },
            { active: true, id: 6, foo: 17, bar: true, product_id: 41, probability: 12 },
            { active: true, id: 7, foo: 17, bar: true, product_id: 37, probability: 13 },
            { active: true, id: 8, foo: 17, bar: true, product_id: 37, probability: 14 }
        );
        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: data,
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="product_id" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        assert.equal(
            getCellValue(model, "B4"),
            1,
            "[Cell B3] There is one distinct product for 'foo - 1' and 'bar - true'"
        );
        assert.equal(
            getCellValue(model, "D4"),
            1,
            "[Cell C3] There is one distinct product for 'foo - 12' and 'bar - true'"
        );
        assert.equal(
            getCellValue(model, "E4"),
            2,
            "[Cell D3] There are two distinct products for 'foo - 17' and 'bar - true'"
        );
    });

    test("Can rebuild the Odoo domain of records based on the according pivot cell", async function (assert) {
        assert.expect(1);
        const { env, model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="product_id" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,list": `<List/>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "C3");
        await nextTick();
        const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
        await root.action(env);
        const currentAction = env.services.action.currentController.action;
        assert.equal(
            JSON.stringify(currentAction.domain),
            `["&",["product_id","=",41],["bar","=",false]]`
        );
    });

    test("Can rebuild the Odoo domain of records based on a cell containing the total of pivots cells (in a column)", async function (assert) {
        assert.expect(1);
        const { env, model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="product_id" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,list": `<List/>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "B4");
        await nextTick();
        const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
        await root.action(env);
        const currentAction = env.services.action.currentController.action;
        assert.equal(
            JSON.stringify(currentAction.domain),
            `["&",["product_id","=",37],["bar","=",true]]`
        );
    });

    test("Can rebuild the Odoo domain of records based on a cell containing the total of pivots cells (in a row)", async function (assert) {
        assert.expect(4);
        const { env, model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="product_id" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,list": `<List/>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "D4");
        await nextTick();
        const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
        await root.action(env);
        const currentAction = env.services.action.currentController.action;
        assert.equal(
            JSON.stringify(currentAction.domain),
            `["|","&",["product_id","=",37],["bar","=",true],"&",["product_id","=",41],["bar","=",true]]`
        );
        assert.strictEqual(currentAction.res_model, "partner");
        assert.strictEqual(currentAction.view_mode, "list");
        assert.strictEqual(currentAction.type, "ir.actions.act_window");
    });

    test("Can rebuild the Odoo domain of records based on a total of all pivot cells", async function (assert) {
        assert.expect(1);
        const { env, model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="product_id" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,list": `<List/>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "D5");
        await nextTick();
        const root = cellMenuRegistry.getAll().find((item) => item.id === "see records");
        await root.action(env);
        const currentAction = env.services.action.currentController.action;
        assert.equal(
            JSON.stringify(currentAction.domain),
            '["|","&",["product_id","=",41],["bar","=",false],"|","&",["product_id","=",37],["bar","=",true],"&",["product_id","=",41],["bar","=",true]]'
        );
    });

    module("Global filters panel");

    test("Simple display", async function (assert) {
        assert.expect(6);

        await createSpreadsheetFromPivot();
        assert.notOk($(target).find(".o_spreadsheet_global_filters_side_panel")[0]);
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        assert.ok($(target).find(".o_spreadsheet_global_filters_side_panel")[0]);
        const items = $(target).find(
            ".o_spreadsheet_global_filters_side_panel .o-sidePanelButton"
        );
        assert.equal(items.length, 3);
        assert.ok(items[0].classList.contains("o_global_filter_new_time"));
        assert.ok(items[1].classList.contains("o_global_filter_new_relation"));
        assert.ok(items[2].classList.contains("o_global_filter_new_text"));
    });

    test("Display with an existing 'Date' global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        const label = "This year";
        await addGlobalFilter(model, {
            filter: { id: "42", type: "date", label, pivotFields: {}, defaultValue: {} },
        });
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        const items = $(target).find(
            ".o_spreadsheet_global_filters_side_panel .o_side_panel_section"
        );
        assert.equal(items.length, 2);
        const labelElement = items[0].querySelector(".o_side_panel_filter_label");
        assert.equal(labelElement.innerText, label);
        await dom.click(items[0].querySelector(".o_side_panel_filter_icon"));
        assert.ok($(target).find(".o_spreadsheet_filter_editor_side_panel"));
        assert.equal($(target).find(".o_global_filter_label")[0].value, label);
    });

    test("Create a new global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        const newText = $(target).find(".o_global_filter_new_text")[0];
        await dom.click(newText);
        assert.equal($(target).find(".o-sidePanel").length, 1);
        const input = $(target).find(".o_global_filter_label")[0];
        await fields.editInput(input, "My Label");
        const value = $(target).find(".o_global_filter_default_value")[0];
        await fields.editInput(value, "Default Value");
        // Can't make it work with the DOM API :(
        // await dom.triggerEvent($(target).find(".o_field_selector_value"), "focusin");
        $($(target).find(".o_field_selector_value")).focusin();
        await dom.click($(target).find(".o_field_selector_select_button")[0]);
        const save = $(target).find(
            ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
        )[0];
        await dom.click(save);
        assert.equal($(target).find(".o_spreadsheet_global_filters_side_panel").length, 1);
        const globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "My Label");
        assert.equal(globalFilter.defaultValue, "Default Value");
    });

    test("Create a new relational global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        const newRelation = $(target).find(".o_global_filter_new_relation")[0];
        await dom.click(newRelation);
        let selector = `.o_field_many2one[name="ir.model"] input`;
        await dom.click($(target).find(selector)[0]);
        let $dropdown = $(selector).autocomplete("widget");
        let $target = $dropdown.find(`li:contains(Product)`).first();
        await dom.click($target);

        let save = $(target).find(
            ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
        )[0];
        await dom.click(save);
        assert.equal($(target).find(".o_spreadsheet_global_filters_side_panel").length, 1);
        let globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "Product");
        assert.deepEqual(globalFilter.defaultValue, []);
        assert.deepEqual(globalFilter.pivotFields[1], { field: "product_id", type: "many2one" });
    });

    test(
        "Prevent selection of a Field Matching before the Related model",
        async function (assert) {
            assert.expect(2);
            await createSpreadsheetFromPivot({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": `
                                <pivot string="Partners">
                                    <field name="foo" type="col"/>
                                    <field name="product_id" type="row"/>
                                    <field name="probability" type="measure"/>
                                </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                mockRPC: async function (route, args) {
                    if (args.method === "search_read" && args.model === "ir.model") {
                        return [{ name: "Product", model: "product" }];
                    }
                },
            });
            await dom.click(".o_topbar_filter_icon");
            await dom.click(".o_global_filter_new_relation");
            let relatedModelSelector = `.o_field_many2one[name="ir.model"] input`;
            let fieldMatchingSelector = `.o_pivot_field_matching`;
            assert.containsNone(target, fieldMatchingSelector);
            await dom.click(target.querySelector(relatedModelSelector));
            let $dropdown = $(relatedModelSelector).autocomplete("widget");
            let $target = $dropdown.find(`li:contains(Product)`).first();
            await dom.click($target);
            assert.containsOnce(target, fieldMatchingSelector);
        }
    );

    test("Display with an existing 'Relation' global filter", async function (assert) {
        assert.expect(8);

        const { model } = await createSpreadsheetFromPivot();
        const label = "MyFoo";
        const pivot = model.getters.getPivotForRPC("1");
        model.dispatch("ADD_PIVOT", {
            anchor: [15, 15],
            pivot: { ...pivot, id: 2 },
        });
        const filter = {
            id: "42",
            type: "relation",
            modelName: "product",
            label,
            pivotFields: {
                1: { type: "many2one", field: "product_id" }, // first pivotId
                2: { type: "many2one", field: "product_id" }, // second pivotId
            },
            defaultValue: [],
        };
        await addGlobalFilter(model, { filter });
        const searchIcon = target.querySelector(".o_topbar_filter_icon");
        await dom.click(searchIcon);
        const items = target.querySelectorAll(
            ".o_spreadsheet_global_filters_side_panel .o_side_panel_section"
        );
        assert.equal(items.length, 2);
        const labelElement = items[0].querySelector(".o_side_panel_filter_label");
        assert.equal(labelElement.innerText, label);
        await dom.click(items[0].querySelector(".o_side_panel_filter_icon"));
        assert.ok(target.querySelectorAll(".o_spreadsheet_filter_editor_side_panel"));
        assert.equal(target.querySelector(".o_global_filter_label").value, label);
        assert.equal(
            target.querySelector(`.o_field_many2one[name="ir.model"] input`).value,
            "Product"
        );
        const fieldsMatchingElements = target.querySelectorAll(
            "span.o_field_selector_chain_part"
        );
        assert.equal(fieldsMatchingElements.length, 2);
        assert.equal(fieldsMatchingElements[0].innerText, "Product");
        assert.equal(fieldsMatchingElements[1].innerText, "Product");
    });

    test("Only related models can be selected", async function (assert) {
        assert.expect(2);
        const data = getBasicData();
        data["ir.model"].records.push(
            {
                id: 36,
                name: "Apple",
                model: "apple",
            },
            {
                id: 35,
                name: "Document",
                model: "documents.document",
            }
        );
        data["partner"].fields.document = {
            relation: "documents.document",
            string: "Document",
            type: "many2one",
        };
        await createSpreadsheetFromPivot({
            serverData: {
                models: data,
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        const newRelation = $(target).find(".o_global_filter_new_relation")[0];
        await dom.click(newRelation);
        const selector = `.o_field_many2one[name="ir.model"] input`;
        await dom.click($(target).find(selector)[0]);
        const $dropdown = $(selector).autocomplete("widget");
        const [model1, model2] = $dropdown.find(`li`);
        assert.equal(model1.innerText, "Product");
        assert.equal(model2.innerText, "Document");
    });

    test("Edit an existing global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        const label = "This year";
        const defaultValue = "value";
        await addGlobalFilter(model, {
            filter: { id: "42", type: "text", label, defaultValue, pivotFields: {} },
        });
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        const editFilter = $(target).find(".o_side_panel_filter_icon");
        await dom.click(editFilter);
        assert.equal($(target).find(".o-sidePanel").length, 1);
        const input = $(target).find(".o_global_filter_label")[0];
        assert.equal(input.value, label);
        const value = $(target).find(".o_global_filter_default_value")[0];
        assert.equal(value.value, defaultValue);
        await fields.editInput(input, "New Label");
        $($(target).find(".o_field_selector_value")).focusin();
        await dom.click($(target).find(".o_field_selector_select_button")[0]);
        const save = $(target).find(
            ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
        )[0];
        await dom.click(save);
        const globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "New Label");
    });

    test("Default value defines value", async function (assert) {
        assert.expect(1);

        const { model } = await createSpreadsheetFromPivot();
        const label = "This year";
        const defaultValue = "value";
        await addGlobalFilter(model, {
            filter: { id: "42", type: "text", label, defaultValue, pivotFields: {} },
        });
        const [filter] = model.getters.getGlobalFilters();
        assert.equal(model.getters.getGlobalFilterValue(filter.id), defaultValue);
    });

    test("Default value defines value at model loading", async function (assert) {
        assert.expect(1);
        const label = "This year";
        const defaultValue = "value";
        const model = new Model({
            globalFilters: [{ type: "text", label, defaultValue, fields: {}, id: "1" }],
        });
        const [filter] = model.getters.getGlobalFilters();
        assert.equal(model.getters.getGlobalFilterValue(filter.id), defaultValue);
    });

    test("Name is only fetched once", async function (assert) {
        assert.expect(6);
        const data = getBasicData();
        data.partner.records.push(
            {
                active: true,
                id: 5,
                foo: 12,
                bar: 110,
                product_id: 41,
                probability: 15,
            },
            {
                active: true,
                id: 6,
                foo: 1,
                bar: 110,
                product_id: 37,
                probability: 16,
            }
        );
        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: data,
                views: {
                    "partner,false,pivot": `
                            <pivot>
                                <field name="bar" type="col"/>
                                <field name="foo" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
            mockRPC: function (route, args) {
                if (args.method === "name_get" && args.model === "product") {
                    assert.step(`name_get_product_${args.args[0].join("-")}`);
                }
            },
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
        // It contains product twice
        assert.equal(getCellFormula(model, "A4"), `=PIVOT.HEADER("1","foo","1","product_id","37")`);
        assert.equal(getCellFormula(model, "A5"), `=PIVOT.HEADER("1","foo","1","product_id","41")`);
        assert.equal(getCellFormula(model, "A7"), `=PIVOT.HEADER("1","foo","2","product_id","41")`);
        assert.equal(
            getCellFormula(model, "A9"),
            `=PIVOT.HEADER("1","foo","12","product_id","37")`
        );
        await setGlobalFilterValue(model, {
            id: "42",
            value: [17],
        });
        await waitForEvaluation(model);
        await nextTick();

        // But it only fetches names once
        assert.verifySteps(["name_get_product_37-41"]);
    });

    test("Name is not fetched if related record is not assigned", async function (assert) {
        assert.expect(4);
        const data = getBasicData();
        data.partner.records[0].product_id = false;
        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: data,
                views: {
                    "partner,false,pivot": `
                            <pivot>
                                <field name="bar" type="col"/>
                                <field name="foo" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
            mockRPC: function (route, args) {
                if (args.method === "name_get" && args.model === "product") {
                    assert.step(`name_get_product_${args.args[0]}`);
                }
            },
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
        // It contains undefined headers
        assert.equal(getCellFormula(model, "A4"), `=PIVOT.HEADER("1","foo","1","product_id","41")`);
        assert.equal(
            getCellFormula(model, "A8"),
            `=PIVOT.HEADER("1","foo","12","product_id","false")`
        );
        await setGlobalFilterValue(model, {
            id: "42",
            value: [17],
        });
        await nextTick();

        // It only fetch names for defined records
        assert.verifySteps(["name_get_product_41"]);
    });

    test("Open pivot dialog and insert a value, with UNDO/REDO", async function (assert) {
        assert.expect(4);

        const { model, env } = await createSpreadsheetFromPivot();
        selectCell(model, "D8");
        const sheetId = model.getters.getActiveSheetId();
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        assert.containsOnce(document.body, ".o_pivot_table_dialog");
        await dom.click(document.body.querySelectorAll(".o_pivot_table_dialog tr th")[1]);
        assert.equal(getCellFormula(model, "D8"), getCellFormula(model, "B1"));
        model.dispatch("REQUEST_UNDO");
        assert.equal(model.getters.getCell(sheetId, 3, 7), undefined);
        model.dispatch("REQUEST_REDO");
        assert.equal(getCellFormula(model, "D8"), getCellFormula(model, "B1"));
    });

    test("Insert missing value modal can show only the values not used in the current sheet", async function (assert) {
        assert.expect(4);

        const { model, env } = await createSpreadsheetFromPivot();
        const missingValue = getCellFormula(model, "B3");
        selectCell(model, "B3");
        model.dispatch("DELETE_CONTENT", {
            sheetId: model.getters.getActiveSheetId(),
            target: model.getters.getSelectedZones(),
        });
        selectCell(model, "D8");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        await dom.click(document.body.querySelector("input#missing_values"));
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        assert.containsN(document.body, ".o_pivot_table_dialog th", 4);
        await dom.click(document.body.querySelector(".o_missing_value"));
        assert.equal(getCellFormula(model, "D8"), missingValue);
    });

    test("Insert missing pivot value with two level of grouping", async function (assert) {
        assert.expect(4);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "B5");
        model.dispatch("DELETE_CONTENT", {
            sheetId: model.getters.getActiveSheetId(),
            target: model.getters.getSelectedZones(),
        });
        selectCell(model, "D8");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        await dom.click(document.body.querySelector("input#missing_values"));
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        assert.containsN(document.body, ".o_pivot_table_dialog td", 1);
        assert.containsN(document.body, ".o_pivot_table_dialog th", 4);
    });

    test("Styling on row headers", async function (assert) {
        assert.expect(12);

        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="product_id" type="row"/>
                                <field name="bar" type="row"/>
                                <field name="foo" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        const styleMainheader = {
            fillColor: "#f2f2f2",
            bold: true,
        };
        const styleSubHeader = {
            fillColor: "#f2f2f2",
        };
        const styleSubSubHeader = undefined;
        assert.deepEqual(getCell(model, "A1").style, styleSubHeader);
        assert.deepEqual(getCell(model, "A2").style, styleSubHeader);
        assert.deepEqual(getCell(model, "A3").style, styleMainheader);
        assert.deepEqual(getCell(model, "A4").style, styleSubHeader);
        assert.deepEqual(getCell(model, "A5").style, styleSubSubHeader);
        assert.deepEqual(getCell(model, "A6").style, styleMainheader);
        assert.deepEqual(getCell(model, "A7").style, styleSubHeader);
        assert.deepEqual(getCell(model, "A8").style, styleSubSubHeader);
        assert.deepEqual(getCell(model, "A9").style, styleSubHeader);
        assert.deepEqual(getCell(model, "A10").style, styleSubSubHeader);
        assert.deepEqual(getCell(model, "A11").style, styleSubSubHeader);
        assert.deepEqual(getCell(model, "A12").style, styleMainheader);
    });

    test("Insert missing value modal can show only the values not used in the current sheet with multiple levels", async function (assert) {
        assert.expect(4);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="product_id" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        const missingValue = getCellFormula(model, "C4");
        selectCell(model, "C4");
        model.dispatch("DELETE_CONTENT", {
            sheetId: model.getters.getActiveSheetId(),
            target: model.getters.getSelectedZones(),
        });
        selectCell(model, "J10");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        await dom.click(document.body.querySelector("input#missing_values"));
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        assert.containsN(document.body, ".o_pivot_table_dialog th", 5);
        await dom.click(document.body.querySelector(".o_missing_value"));
        assert.equal(getCellFormula(model, "J10"), missingValue);
    });

    test("Insert missing pivot value give the focus to the canvas when model is closed", async function (assert) {
        assert.expect(2);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "D8");
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        assert.containsOnce(document.body, ".o_pivot_table_dialog");
        await dom.click(document.body.querySelectorAll(".o_pivot_table_dialog tr th")[1]);
        assert.equal(document.activeElement.tagName, "CANVAS");
    });

    test("One col header as missing value should be displayed", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "B1");
        model.dispatch("DELETE_CONTENT", {
            sheetId: model.getters.getActiveSheetId(),
            target: model.getters.getSelectedZones(),
        });
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        await dom.click(document.body.querySelector("input#missing_values"));
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
    });

    test("One row header as missing value should be displayed", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="bar" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "A3");
        model.dispatch("DELETE_CONTENT", {
            sheetId: model.getters.getActiveSheetId(),
            target: model.getters.getSelectedZones(),
        });
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        await dom.click(document.body.querySelector("input#missing_values"));
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
    });

    test("A missing col in the total measures with a pivot of two GB of cols", async function (assert) {
        assert.expect(2);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="col"/>
                                <field name="probability" type="measure"/>
                                <field name="foo" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        await nextTick();
        await nextTick();
        selectCell(model, "F4");
        model.dispatch("DELETE_CONTENT", {
            sheetId: model.getters.getActiveSheetId(),
            target: model.getters.getSelectedZones(),
        });
        const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_cell");
        const insertValue = cellMenuRegistry.getChildren(root, env)[0];
        await insertValue.action(env);
        await nextTick();
        await dom.click(document.body.querySelector("input#missing_values"));
        await nextTick();
        assert.containsOnce(document.body, ".o_missing_value");
        assert.containsN(document.body, ".o_pivot_table_dialog th", 5);
    });

    test("Grid has still the focus after a dialog", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="col"/>
                                <field name="probability" type="measure"/>
                                <field name="foo" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        selectCell(model, "F4");
        env.notifyUser("Notification");
        await nextTick();
        await dom.click(document.body.querySelector(".modal-footer .btn-primary"));
        await nextTick();
        assert.strictEqual(document.activeElement.tagName, "CANVAS");
    });

    test("Open pivot properties properties with non-loaded field", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromPivot();
        const pivot = model.getters.getPivotForRPC("1");
        pivot.measures.push({
            field: "non-existing",
            operator: "sum",
        });
        model.dispatch("SELECT_PIVOT", { pivotId: "1" });
        env.openSidePanel("PIVOT_PROPERTIES_PANEL", {
            pivot: model.getters.getSelectedPivotId(),
        });
        await nextTick();
        const sections = target.querySelectorAll(".o_side_panel_section");
        const measures = sections[4];
        assert.equal(measures.children[2].innerText, "non-existing");
    });

    test("Trying to duplicate a filter label will trigger a toaster", async function (assert) {
        assert.expect(4);
        const mock = (message) => {
            assert.step(`create (${message})`);
            return () => {};
        };
        const uniqueFilterName = "UNIQUE_FILTER";
        registry.category("services").add("notification", makeFakeNotificationService(mock), {
            force: true,
        });
        const { model } = await createSpreadsheetFromPivot({
            serverData: {
                models: getBasicData(),
                views: {
                    "partner,false,pivot": `
                            <pivot>
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            },
        });
        model.dispatch("ADD_GLOBAL_FILTER", {
            filter: {
                id: "42",
                type: "relation",
                label: uniqueFilterName,
                pivotFields: {
                    1: {
                        field: "product",
                        type: "many2one",
                    },
                },
            },
        });
        const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
        await dom.click(searchIcon);
        const newText = $(target).find(".o_global_filter_new_text")[0];
        await dom.click(newText);
        assert.equal($(target).find(".o-sidePanel").length, 1);
        const input = $(target).find(".o_global_filter_label")[0];
        await fields.editInput(input, uniqueFilterName);
        const value = $(target).find(".o_global_filter_default_value")[0];
        await fields.editInput(value, "Default Value");
        // Can't make it work with the DOM API :(
        // await dom.triggerEvent($(target).find(".o_field_selector_value"), "focusin");
        $($(target).find(".o_field_selector_value")).focusin();
        await dom.click($(target).find(".o_field_selector_select_button")[0]);
        const save = $(target).find(
            ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
        )[0];
        await dom.click(save);
        assert.verifySteps([
            "create (New spreadsheet created in Documents)",
            "create (Duplicated Label)",
        ]);
    });

    test("dialog window not normally displayed", async function (assert) {
        assert.expect(1);
        const { } = await createSpreadsheet();
        const dialog = document.querySelector(".o_dialog");
        assert.equal(dialog, undefined, "Dialog should not normally be displayed ");
    });

    test("edit text window", async function (assert) {
        assert.expect(4);
        const { env } = await createSpreadsheet();
        env.editText("testTitle", () => {}, {error : "testErrorText", placeholder : "testPlaceholder"})
        await nextTick()
        const dialog = document.querySelector(".o_dialog");
        assert.ok(dialog !== undefined, "Dialog can be opened");
        assert.equal(document.querySelector(".modal-title").textContent, "testTitle", "Can set dialog title")
        assert.equal(document.querySelector(".o_dialog_error_text").textContent, "testErrorText", "Can set dialog error text")
        assert.equal(document.querySelectorAll(".modal-footer button").length, 2, "Edit text have 2 buttons")
    });

    test("notify user window", async function (assert) {
        assert.expect(4);
        const { env } = await createSpreadsheet();
        env.notifyUser("this is a notification")
        await nextTick()
        const dialog = document.querySelector(".o_dialog");
        assert.ok(dialog !== undefined, "Dialog can be opened");
        assert.equal(document.querySelector(".modal-body div").textContent, "this is a notification", "Can set dialog content")
        assert.equal(document.querySelector(".o_dialog_error_text"), null, "NotifyUser have no error text")
        assert.equal(document.querySelectorAll(".modal-footer button").length, 1, "NotifyUser have 1 button")
    });

    test("Lazy load currencies", async function (assert) {
        assert.expect(3);
        const { env } = await createSpreadsheet({
            mockRPC: async function (route, args) {
                if (args.method === "search_read" && args.model === "res.currency") {
                    assert.step('currencies-loaded');
                    return [{ decimalPlaces: 2, name: "Euro", code: "EUR", symbol: "€", position: "after" }];
                }
            },
        });
        assert.verifySteps([]);
        const root = topbarMenuRegistry.getAll().find((item) => item.id === "format");
        const numbers = topbarMenuRegistry.getChildren(root, env).find((item) => item.id === "format_number");
        const customCurrencies = topbarMenuRegistry.getChildren(numbers, env).find((item) => item.id === "format_custom_currency");
        await customCurrencies.action(env);
        await nextTick();
        await click(document.querySelector(".o-sidePanelClose"));
        await customCurrencies.action(env);
        await nextTick();
        assert.verifySteps(["currencies-loaded"]);
    });
});
