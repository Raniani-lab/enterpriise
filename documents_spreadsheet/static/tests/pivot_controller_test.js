/** @odoo-module alias=documents_spreadsheet.PivotControllerTests */

import PivotView from "web.PivotView";
import testUtils from "web.test_utils";
import {
    createSpreadsheetFromPivot,
    getCell,
    getCellContent,
    getCellFormula,
    getCells,
    getMerges,
} from "./spreadsheet_test_utils";

import { getBasicArch, getTestData } from "./spreadsheet_test_data";

const createView = testUtils.createView;
const { module, test } = QUnit;

module("documents_spreadsheet > pivot_controller");

test("simple pivot export", async (assert) => {
    assert.expect(8);
    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
            <pivot string="Partners">
                <field name="foo" type="measure"/>
            </pivot>`,
    });
    assert.strictEqual(Object.values(getCells(model)).length, 6);
    assert.strictEqual(getCellFormula(model, "A1"), "");
    assert.strictEqual(getCellFormula(model, "A2"), "");
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1")');
    assert.strictEqual(getCellFormula(model, "B1"), '=PIVOT.HEADER("1")');
    assert.strictEqual(getCellFormula(model, "B2"), '=PIVOT.HEADER("1","measure","foo")');
    assert.strictEqual(getCellFormula(model, "B3"), '=PIVOT("1","foo")');
    assert.strictEqual(getCell(model, "B3").format, "#,##0.00");
    actionManager.destroy();
});

test("simple pivot export with two measures", async (assert) => {
    assert.expect(10);
    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
            <pivot string="Partners">
                <field name="foo" type="measure"/>
                <field name="probability" type="measure"/>
            </pivot>`,
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
    actionManager.destroy();
});

test("pivot with two measures: total cells above measures totals are merged in one", async (assert) => {
    assert.expect(2);
    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
            <pivot string="Partners">
                <field name="foo" type="col"/>
                <field name="date" interval="week" type="row"/>
                <field name="foo" type="measure"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const merges = getMerges(model);
    assert.strictEqual(merges.length, 5);
    assert.strictEqual(merges[4], "J1:K1");
    actionManager.destroy();
});

test("pivot with one level of group bys", async (assert) => {
    assert.expect(7);
    const { actionManager, model } = await createSpreadsheetFromPivot();
    assert.strictEqual(Object.values(getCells(model)).length, 30);
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","bar","false")');
    assert.strictEqual(getCellFormula(model, "A4"), '=PIVOT.HEADER("1","bar","true")');
    assert.strictEqual(getCellFormula(model, "A5"), '=PIVOT.HEADER("1")');
    assert.strictEqual(getCellFormula(model, "B2"), '=PIVOT.HEADER("1","foo","1","measure","probability")');
    assert.strictEqual(getCellFormula(model, "C3"), '=PIVOT("1","probability","bar","false","foo","2")');
    assert.strictEqual(getCellFormula(model, "F5"), '=PIVOT("1","probability")');
    actionManager.destroy();
});

test("pivot with two levels of group bys in rows", async (assert) => {
    assert.expect(10);
    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
        <pivot string="Partners">
            <field name="bar" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    }, async (controller) => {
        await testUtils.dom.click(controller.$("tbody .o_pivot_header_cell_closed:first"));
        await testUtils.dom.click(
            controller.$('.o_pivot_field_menu .dropdown-item[data-field="product_id"]:first')
        );
    });
    assert.strictEqual(Object.values(getCells(model)).length, 18);
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","bar","false")');
    assert.deepEqual(getCell(model, "A3").style, { fillColor: "#f2f2f2", bold: true });
    assert.strictEqual(getCellFormula(model, "A4"), '=PIVOT.HEADER("1","bar","false","product_id","37")');
    assert.deepEqual(getCell(model, "A4").style, { fillColor: "#f2f2f2" });
    assert.strictEqual(getCellFormula(model, "A5"), '=PIVOT.HEADER("1","bar","false","product_id","41")');
    assert.strictEqual(getCellFormula(model, "A6"), '=PIVOT.HEADER("1","bar","true")');
    assert.strictEqual(getCellFormula(model, "A7"), '=PIVOT.HEADER("1","bar","true","product_id","37")');
    assert.strictEqual(getCellFormula(model, "A8"), '=PIVOT.HEADER("1","bar","true","product_id","41")');
    assert.strictEqual(getCellFormula(model, "A9"), '=PIVOT.HEADER("1")');
    actionManager.destroy();
});

test("verify that there is a record for an undefined header", async (assert) => {
    assert.expect(1);

    const data = getTestData();

    data.partner.records = [{
        id: 1,
        foo: 12,
        bar: true,
        date: "2016-04-14",
        product_id: false,
        probability: 10,
    }];

    const { actionManager, model } = await createSpreadsheetFromPivot({
        data,
        arch: `
        <pivot string="Partners">
            <field name="product_id" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    });
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","product_id","false")');
    actionManager.destroy();
});

test("undefined date is inserted in pivot", async (assert) => {
    assert.expect(1);

    const data = getTestData();
    data.partner.records = [{
        id: 1,
        foo: 12,
        bar: true,
        date: false,
        product_id: 37,
        probability: 10,
    }];

    const { actionManager, model } = await createSpreadsheetFromPivot({
        data,
        arch: `
        <pivot string="Partners">
            <field name="date" interval="day" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    });
    assert.strictEqual(getCellFormula(model, "A3"), '=PIVOT.HEADER("1","date:day","false")');
    actionManager.destroy();
});

test("pivot with two levels of group bys in cols", async (assert) => {
    assert.expect(14);

    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
        <pivot string="Partners">
            <field name="bar" type="col"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    }, async(controller) => {
        await testUtils.dom.click(controller.$("thead .o_pivot_header_cell_closed:first"));
        await testUtils.dom.click(
            controller.$('.o_pivot_field_menu .dropdown-item[data-field="product_id"]:first')
        );
    });

    assert.strictEqual(Object.values(getCells(model)).length, 24);
    assert.strictEqual(getCellContent(model, "A1"), "");
    assert.deepEqual(getCell(model, "A4").style, { fillColor: "#f2f2f2", bold: true });
    assert.strictEqual(getCellFormula(model, "B1"), '=PIVOT.HEADER("1","bar","false")');
    assert.strictEqual(getCellFormula(model, "B2"), '=PIVOT.HEADER("1","bar","false","product_id","37")');
    assert.strictEqual(getCellFormula(model, "B3"), '=PIVOT.HEADER("1","bar","false","product_id","37","measure","probability")');
    assert.deepEqual(getCell(model, "C2").style, { fillColor: "#f2f2f2", bold: true });
    assert.strictEqual(getCellFormula(model, "C2"), '=PIVOT.HEADER("1","bar","false","product_id","41")');
    assert.strictEqual(getCellFormula(model, "C3"), '=PIVOT.HEADER("1","bar","false","product_id","41","measure","probability")');
    assert.strictEqual(getCellFormula(model, "D1"), '=PIVOT.HEADER("1","bar","true")');
    assert.strictEqual(getCellFormula(model, "D2"), '=PIVOT.HEADER("1","bar","true","product_id","37")');
    assert.strictEqual(getCellFormula(model, "D3"), '=PIVOT.HEADER("1","bar","true","product_id","37","measure","probability")');
    assert.strictEqual(getCellFormula(model, "E2"), '=PIVOT.HEADER("1","bar","true","product_id","41")');
    assert.strictEqual(getCellFormula(model, "E3"), '=PIVOT.HEADER("1","bar","true","product_id","41","measure","probability")');
    actionManager.destroy();
});

test("pivot with count as measure", async (assert) => {
    assert.expect(3);

    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
        <pivot string="Partners">
            <field name="probability" type="measure"/>
        </pivot>`,
    }, async(controller) => {
        await testUtils.nextTick();
        await testUtils.pivot.toggleMeasuresDropdown(controller);
        await testUtils.pivot.clickMeasure(controller, "__count");
    });
    assert.strictEqual(Object.keys(getCells(model)).length, 9);
    assert.strictEqual(getCellFormula(model, "C2"), '=PIVOT.HEADER("1","measure","__count")');
    assert.strictEqual(getCellFormula(model, "C3"), '=PIVOT("1","__count")');
    actionManager.destroy();
});

test("pivot with two levels of group bys in cols with not enough cols", async (assert) => {
    assert.expect(1);

    const data = getTestData();
    // add many values in a subgroup
    for (let i = 0; i < 35; i++) {
        data.product.records.push({
            id: i + 9999,
            display_name: i.toString(),
        })
        data.partner.records.push({
            id: i + 9999,
            bar: i % 2 === 0,
            product_id: i + 9999,
            probability: i,
        })
    }

    const { actionManager, model } = await createSpreadsheetFromPivot({
        data,
        arch: `
        <pivot string="Partners">
            <field name="bar" type="col"/>
            <field name="foo" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    }, async(controller) => {
        await testUtils.dom.click(controller.$("thead .o_pivot_header_cell_closed:first"));
        await testUtils.dom.click(
            controller.$('.o_pivot_field_menu .dropdown-item[data-field="product_id"]:first')
        );
    });
    // 37 products * 2 groups + 1 row header + 1 total col + 1 extra empty col at the end
    assert.strictEqual(model.getters.getActiveSheet().cols.length, 77);
    actionManager.destroy();
});

test("groupby week is sorted", async (assert) => {
    assert.expect(3);

    const { actionManager, model } = await createSpreadsheetFromPivot({
        arch: `
        <pivot string="Partners">
            <field name="foo" type="col"/>
            <field name="date" interval="week" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    });
    assert.strictEqual(getCellFormula(model, "A3"), `=PIVOT.HEADER("1","date:week","16/2016")`);
    assert.strictEqual(getCellFormula(model, "A4"), `=PIVOT.HEADER("1","date:week","44/2016")`);
    assert.strictEqual(getCellFormula(model, "A5"), `=PIVOT.HEADER("1","date:week","51/2016")`);
    actionManager.destroy();
});

test("Can save a pivot in a new spreadsheet", async (assert) => {
    assert.expect(2);

    const { actionManager } = await createSpreadsheetFromPivot({
        arch: `
        <pivot string="Partners">
            <field name="probability" type="measure"/>
        </pivot>`,
        mockRPC: function (route, args) {
            if (args.method === "search_read" && args.model === "ir.model") {
                return Promise.resolve([{ name: "partner" }]);
            }
            if (route.includes("get_spreadsheets_to_display")) {
                return Promise.resolve([{ id: 1, name: "My Spreadsheet" }]);
            }
            if (args.method === "create" && args.model === "documents.document") {
                assert.step("create");
                return Promise.resolve([1]);
            }
            if (route.includes("join_spreadsheet_session")) {
                return Promise.resolve({ raw: "{}", revisions: [] });
            }
            if (route.includes("dispatch_spreadsheet_message")) {
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
        session: { user_has_group: async () => true },
    }, async(controller) => {
        await testUtils.nextTick();
        await testUtils.dom.click(controller.$el.find(".o_pivot_add_spreadsheet"));
        await testUtils.nextTick();
        await testUtils.modal.clickButton("Confirm");
        await testUtils.nextTick();
    });
    assert.verifySteps(["create"]);
    actionManager.destroy();
});

test("Can save a pivot in existing spreadsheet", async (assert) => {
    assert.expect(3);

    const { actionManager } = await createSpreadsheetFromPivot({
        arch: `
        <pivot string="Partners">
            <field name="probability" type="measure"/>
        </pivot>`,
        mockRPC: function (route, args) {
            if (args.method === "search_read" && args.model === "ir.model") {
                return Promise.resolve([{ name: "partner" }]);
            }
            if (args.method === "search_read" && args.model === "documents.document") {
                return Promise.resolve([{ raw: "{}" }]);
            }
            if (route.includes("get_spreadsheets_to_display")) {
                return Promise.resolve([{ id: 1, name: "My Spreadsheet" }]);
            }
            if (args.method === "write" && args.model === "documents.document") {
                assert.step("write");
                return Promise.resolve();
            }
            if (route.includes("join_spreadsheet_session")) {
                assert.step("join_spreadsheet_session");
                return Promise.resolve({ raw: "{}", revisions: [] });
            }
            if (route.includes("dispatch_spreadsheet_message")) {
                return Promise.resolve();
            }
            return this._super.apply(this, arguments);
        },
        session: { user_has_group: async () => true },
    }, async (controller) => {
        await testUtils.nextTick();
        await testUtils.dom.click(controller.$el.find(".o_pivot_add_spreadsheet"));
        await testUtils.dom.click($(document.body.querySelector(".modal-content select")));
        document.body.querySelector(".modal-content option[value='1']").setAttribute("selected", "selected");
        await testUtils.nextTick();
        await testUtils.modal.clickButton("Confirm");
    });
    actionManager.destroy();
    assert.verifySteps([
        "join_spreadsheet_session",
        "write",  // leave
    ]);
});

test("Add pivot sheet at the end of existing spreadsheet", async (assert) => {
    assert.expect(4);
    const pivot = await createView({
        View: PivotView,
        model: "partner",
        data: getTestData(),
        arch: getBasicArch(),
        session: { user_has_group: async () => true },
    });
    const callback = await pivot._getCallbackBuildPivot(false);
    pivot.destroy();
    const { actionManager, model } = await createSpreadsheetFromPivot();
    model.dispatch("CREATE_SHEET", { sheetId: "42", position: 1 });
    const activeSheetId = model.getters.getActiveSheetId();
    assert.deepEqual(model.getters.getVisibleSheets(), [activeSheetId, "42"]);
    callback(model);
    assert.strictEqual(model.getters.getSheets().length, 3);
    assert.deepEqual(model.getters.getVisibleSheets()[0], activeSheetId);
    assert.deepEqual(model.getters.getVisibleSheets()[1], "42");
    actionManager.destroy();
});

test("pivot ids are correctly assigned", async (assert) => {
    assert.expect(3);

    const { actionManager, model } = await createSpreadsheetFromPivot();
    const [ p1 ] = model.getters.getPivots();
    assert.strictEqual(p1.id, 1, "It should have id 1");
    const [ p2, p3 ] = [ { ...p1 }, { ...p1 } ];
    const sheetId = model.getters.getActiveSheetId();
    const cache = await model.getters.getAsyncCache(p1.id);
    model.dispatch("BUILD_PIVOT", {
        sheetId,
        anchor: [12, 0],
        pivot: p2,
        cache,
    });
    assert.deepEqual(
        model.getters.getPivots().map((p) => p.id), [1, 2],
        "Last pivot should have id 2",
    );
    model.dispatch("BUILD_PIVOT", {
        sheetId,
        anchor: [12, 0],
        pivot: p3,
        cache,
    });
    assert.deepEqual(
        model.getters.getPivots().map((p) => p.id), [1, 2, 3],
        "Last pivot should have id 3",
    );
    actionManager.destroy();
});

test("pivot with a domain", async (assert) => {
    assert.expect(3);

    const { actionManager, model } = await createSpreadsheetFromPivot({
        domain: [["bar", "=", true]],
    });
    const [ p1 ] = model.getters.getPivots();
    assert.deepEqual(
        p1.domain,
        [["bar", "=", true]],
        "It should have the correct domain"
    );
    assert.strictEqual(
        getCellFormula(model, "A3"),
        `=PIVOT.HEADER("1","bar","true")`
    );
    assert.strictEqual(getCellFormula(model, "A4"), `=PIVOT.HEADER("1")`);
    actionManager.destroy();
});

test("Insert in spreadsheet is disabled when no measure is specified", async (assert) => {
    assert.expect(1);

    const pivot = await createView({
        View: PivotView,
        model: "partner",
        data: getTestData(),
        arch: `
        <pivot string="Partners">
            <field name="foo" type="measure"/>
        </pivot>`,
        session: { user_has_group: async () => true },
    });
    await testUtils.pivot.toggleMeasuresDropdown(pivot);
    await testUtils.pivot.clickMeasure(pivot, 'foo');
    assert.ok(document.body.querySelector("button.o_pivot_add_spreadsheet").disabled);
    pivot.destroy();
});

test("Insert in spreadsheet is disabled when data is empty", async (assert) => {
    assert.expect(1);

    const data = getTestData();
    data.partner.records = [];
    data.product.records = [];
    const pivot = await createView({
        View: PivotView,
        model: "partner",
        data,
        arch: `
        <pivot string="Partners">
            <field name="foo" type="measure"/>
        </pivot>`,
        session: { user_has_group: async () => true },
    });
    assert.ok(document.body.querySelector("button.o_pivot_add_spreadsheet").disabled);
    pivot.destroy();
});

test("pivot with a quote in name", async function (assert) {
    assert.expect(1);

    const data = getTestData();
    data.product.records.push({
        id: 42,
        display_name: `name with "`,
    });
    const { actionManager, model } = await createSpreadsheetFromPivot({
        model: "product",
        data,
        arch: `
        <pivot string="Products">
            <field name="display_name" type="col"/>
            <field name="id" type="row"/>
        </pivot>`,
    });
    assert.equal(getCellContent(model, "B1"), `=PIVOT.HEADER("1","display_name","name with \\"")`);
    actionManager.destroy();
});

test("group by regular field defined with not supported aggregate", async function (assert) {
    assert.expect(2);

    const {actionManager, model} = await createSpreadsheetFromPivot({
        model: "partner",
        data: getTestData(),
        arch: `
        <pivot string="Partners">
            <field name="foo" type="row"/>
            <field name="field_with_array_agg" type="measure"/>
        </pivot>`,
    });
    const B7 = getCell(model, "B7");
    assert.equal(B7.error, `Not implemented: array_agg`);
    assert.equal(B7.value, `#ERROR`);

    actionManager.destroy();
});


test("group by related field with archived record", async function (assert) {
    assert.expect(3);

    const data = getTestData();
    data.product.records[0].active = false;
    const { actionManager, model } = await createSpreadsheetFromPivot({
        data,
        arch: `
        <pivot string="Partners">
            <field name="product_id" type="col"/>
            <field name="name" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    });
    assert.equal(getCellContent(model, "B1"), `=PIVOT.HEADER("1","product_id","37")`);
    assert.equal(getCellContent(model, "C1"), `=PIVOT.HEADER("1","product_id","41")`);
    assert.equal(getCellContent(model, "D1"), `=PIVOT.HEADER("1")`);
    actionManager.destroy();
});

test("group by regular field with archived record", async function (assert) {
    assert.expect(4);

    const data = getTestData();
    data.partner.records[0].active = false;
    const { actionManager, model } = await createSpreadsheetFromPivot({
        data,
        arch: `
        <pivot string="Partners">
            <field name="product_id" type="col"/>
            <field name="foo" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`,
    });
    assert.equal(getCellContent(model, "A3"), `=PIVOT.HEADER("1","foo","1")`);
    assert.equal(getCellContent(model, "A4"), `=PIVOT.HEADER("1","foo","2")`);
    assert.equal(getCellContent(model, "A5"), `=PIVOT.HEADER("1","foo","17")`);
    assert.equal(getCellContent(model, "A6"), `=PIVOT.HEADER("1")`);
    actionManager.destroy();
});