odoo.define("documents_spreadsheet.pivot_controller_test", function (require) {
    "use strict";

    const PivotView = require("web.PivotView");
    const testUtils = require("web.test_utils");
    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const toCartesian = spreadsheet.helpers.toCartesian;

    const createView = testUtils.createView;

    function getAutofillValue(model, from, column, increment) {
        const content = model.getters.getCell(...toCartesian(from)).content;
        return model.getters.getNextValue(content, column, increment);
    }

    function getCellContent(model, xc) {
        return model.getters.getCell(...toCartesian(xc)).content;
    }

    function mockRPCFn (route, args) {
        if (args.method === "search_read" && args.model === "ir.model") {
            return Promise.resolve([{ name: "partner" }]);
        }
        return this._super.apply(this, arguments);
    }

    QUnit.module(
        "Spreadsheet",
        {
            beforeEach: function () {
                this.data = {
                    partner: {
                        fields: {
                            foo: {
                                string: "Foo",
                                type: "integer",
                                searchable: true,
                                group_operator: "sum",
                            },
                            bar: { string: "bar", type: "boolean", store: true, sortable: true },
                            date: { string: "Date", type: "date", store: true, sortable: true },
                            product_id: {
                                string: "Product",
                                type: "many2one",
                                relation: "product",
                                store: true,
                            },
                            probability: {
                                string: "Probability",
                                type: "integer",
                                searchable: true,
                                group_operator: "avg",
                            },
                        },
                        records: [
                            {
                                id: 1,
                                foo: 12,
                                bar: true,
                                date: "2016-04-14",
                                product_id: 37,
                                probability: 10,
                            },
                            {
                                id: 2,
                                foo: 1,
                                bar: true,
                                date: "2016-10-26",
                                product_id: 41,
                                probability: 11,
                            },
                            {
                                id: 3,
                                foo: 17,
                                bar: true,
                                date: "2016-12-15",
                                product_id: 41,
                                probability: 95,
                            },
                            {
                                id: 4,
                                foo: 2,
                                bar: false,
                                date: "2016-12-11",
                                product_id: 41,
                                customer: 1,
                                computed_field: 19,
                                probability: 15,
                            },
                        ],
                    },
                    product: {
                        fields: {
                            name: { string: "Product Name", type: "char" },
                        },
                        records: [
                            {
                                id: 37,
                                display_name: "xphone",
                            },
                            {
                                id: 41,
                                display_name: "xpad",
                            },
                        ],
                    },
                };
            },
        },
        function () {
            QUnit.module("Spreadsheet export");

            QUnit.test("simple pivot export", async function (assert) {
                assert.expect(8);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const data = await pivot._getSpreadsheetData();
                const spreadsheetData = JSON.parse(data);
                const cells = spreadsheetData["sheets"][0]["cells"];
                assert.strictEqual(Object.keys(cells).length, 5);
                assert.strictEqual(cells["A1"].content, "");
                assert.strictEqual(cells["A3"].content, '=PIVOT.HEADER("1")');
                assert.strictEqual(cells["B1"].content, '=PIVOT.HEADER("1")');
                assert.strictEqual(cells["B2"].content, '=PIVOT.HEADER("1","measure","foo")');
                assert.strictEqual(cells["B3"].content, '=PIVOT("1","foo")');
                assert.strictEqual(cells["B3"].format, "#,##0.00");
                assert.strictEqual(spreadsheetData["sheets"][0]["merges"][0], "A1:A2");
                pivot.destroy();
            });

            QUnit.test("simple pivot export with two measures", async function (assert) {
                assert.expect(11);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="measure"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const data = await pivot._getSpreadsheetData();
                const spreadsheetData = JSON.parse(data);
                const cells = spreadsheetData["sheets"][0]["cells"];
                assert.strictEqual(Object.keys(cells).length, 8);
                assert.strictEqual(cells["B1"].content, '=PIVOT.HEADER("1")');
                assert.strictEqual(cells["B2"].content, '=PIVOT.HEADER("1","measure","foo")');
                assert.strictEqual(
                    cells["C2"].content,
                    '=PIVOT.HEADER("1","measure","probability")'
                );
                assert.strictEqual(cells["B3"].content, '=PIVOT("1","foo")');
                assert.strictEqual(cells["B3"].format, "#,##0.00");
                assert.strictEqual(cells["C3"].content, '=PIVOT("1","probability")');
                assert.strictEqual(cells["C3"].format, "#,##0.00");
                const merges = spreadsheetData["sheets"][0]["merges"];
                assert.strictEqual(merges.length, 2);
                assert.strictEqual(merges[0], "A1:A2");
                assert.strictEqual(merges[1], "B1:C1");
                pivot.destroy();
            });

            QUnit.test("pivot with one level of group bys", async function (assert) {
                assert.expect(9);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const data = await pivot._getSpreadsheetData();
                const spreadsheetData = JSON.parse(data);
                const cells = spreadsheetData["sheets"][0]["cells"];
                assert.strictEqual(Object.keys(cells).length, 29);
                assert.strictEqual(cells["A3"].content, '=PIVOT.HEADER("1","bar","true")');
                assert.strictEqual(cells["A4"].content, '=PIVOT.HEADER("1","bar","false")');
                assert.strictEqual(cells["A5"].content, '=PIVOT.HEADER("1")');
                assert.strictEqual(
                    cells["B2"].content,
                    '=PIVOT.HEADER("1","foo","1","measure","probability")'
                );
                assert.strictEqual(
                    cells["C3"].content,
                    '=PIVOT("1","probability","bar","true","foo","2")'
                );
                assert.strictEqual(cells["F5"].content, '=PIVOT("1","probability")');
                const merges = spreadsheetData["sheets"][0]["merges"];
                assert.strictEqual(merges.length, 1);
                assert.strictEqual(merges[0], "A1:A2");
                pivot.destroy();
            });

            QUnit.test("pivot with two levels of group bys", async function (assert) {
                assert.expect(9);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                await testUtils.dom.click(pivot.$("tbody .o_pivot_header_cell_closed:first"));
                await testUtils.dom.click(
                    pivot.$('.o_pivot_field_menu .dropdown-item[data-field="product_id"]:first')
                );
                const data = await pivot._getSpreadsheetData();
                const spreadsheetData = JSON.parse(data);
                const cells = spreadsheetData["sheets"][0]["cells"];
                assert.strictEqual(Object.keys(cells).length, 15);
                assert.strictEqual(cells["A3"].content, '=PIVOT.HEADER("1","bar","true")');
                assert.strictEqual(cells["A3"].style, 3);
                assert.strictEqual(
                    cells["A4"].content,
                    '=PIVOT.HEADER("1","bar","true","product_id","37")'
                );
                assert.strictEqual(cells["A4"].style, 2);
                assert.strictEqual(
                    cells["A5"].content,
                    '=PIVOT.HEADER("1","bar","true","product_id","41")'
                );
                assert.strictEqual(cells["A6"].content, '=PIVOT.HEADER("1","bar","false")');
                assert.strictEqual(
                    cells["A7"].content,
                    '=PIVOT.HEADER("1","bar","false","product_id","41")'
                );
                assert.strictEqual(cells["A8"].content, '=PIVOT.HEADER("1")');
                pivot.destroy();
            });

            QUnit.test("pivot with count as measure", async function (assert) {
                assert.expect(3);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                await testUtils.nextTick();
                await testUtils.pivot.toggleMeasuresDropdown(pivot);
                await testUtils.pivot.clickMeasure(pivot, "__count");
                const data = await pivot._getSpreadsheetData();
                const spreadsheetData = JSON.parse(data);
                const cells = spreadsheetData["sheets"][0]["cells"];
                assert.strictEqual(Object.keys(cells).length, 8);
                assert.strictEqual(cells["C2"].content, '=PIVOT.HEADER("1","measure","__count")');
                assert.strictEqual(cells["C3"].content, '=PIVOT("1","__count")');
                pivot.destroy();
            });

            QUnit.test("Can save a pivot in a new spreadsheet", async function (assert) {
                assert.expect(2);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
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
                        return this._super.apply(this, arguments);
                    },
                    session: { async user_has_group() { return true }},
                });
                await testUtils.nextTick();
                await testUtils.dom.click(pivot.$el.find(".o_pivot_add_spreadsheet"));
                await testUtils.nextTick();
                await testUtils.modal.clickButton("Confirm");
                await testUtils.nextTick();
                assert.verifySteps(["create"]);
                pivot.destroy();
            });

            QUnit.test("Can save a pivot in existing spreadsheet", async function (assert) {
                assert.expect(4);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: function (route, args) {
                        if (args.method === "search_read" && args.model === "ir.model") {
                            return Promise.resolve([{ name: "partner" }]);
                        }
                        if (args.method === "search_read" && args.model === "documents.document") {
                            assert.step("search_read");
                            return Promise.resolve([{ raw: "{}" }]);
                        }
                        if (route.includes("get_spreadsheets_to_display")) {
                            return Promise.resolve([{ id: 1, name: "My Spreadsheet" }]);
                        }
                        if (args.method === "write" && args.model === "documents.document") {
                            assert.step("write");
                            assert.ok(args.args[0], 1);
                            return Promise.resolve();
                        }
                        return this._super.apply(this, arguments);
                    },
                    session: { async user_has_group() { return true }},
                });
                await testUtils.nextTick();
                await testUtils.dom.click(pivot.$el.find(".o_pivot_add_spreadsheet"));
                await testUtils.dom.click($(document.body.querySelector(".modal-content select")));
                document.body.querySelector(".modal-content option[value='1']").setAttribute("selected", "selected");
                await testUtils.nextTick();
                await testUtils.modal.clickButton("Confirm");
                assert.verifySteps(["search_read", "write"]);
                pivot.destroy();
            });

            QUnit.test("Autofill pivot values", async function (assert) {
                assert.expect(26);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                // From value to value
                assert.strictEqual(
                    getAutofillValue(model, "C3", false, 1),
                    getCellContent(model, "C4")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B4", false, -1),
                    getCellContent(model, "B3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "C3", true, 1),
                    getCellContent(model, "D3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "C3", true, -1),
                    getCellContent(model, "B3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "C3", false, 2),
                    getCellContent(model, "C5")
                );
                assert.strictEqual(getAutofillValue(model, "C3", false, 3), "");
                assert.strictEqual(getAutofillValue(model, "C3", true, 4), "");
                // From value to header
                assert.strictEqual(
                    getAutofillValue(model, "B4", true, -1),
                    getCellContent(model, "A4")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B4", false, -1),
                    getCellContent(model, "B3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B4", false, -2),
                    getCellContent(model, "B2")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B4", false, -3),
                    getCellContent(model, "B1")
                );
                // From header to header
                assert.strictEqual(
                    getAutofillValue(model, "B3", true, 1),
                    getCellContent(model, "C3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B3", true, 2),
                    getCellContent(model, "D3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B3", true, -1),
                    getCellContent(model, "A3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B1", false, 1),
                    getCellContent(model, "B2")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B3", false, -1),
                    getCellContent(model, "B2")
                );
                assert.strictEqual(
                    getAutofillValue(model, "A4", false, 1),
                    getCellContent(model, "A5")
                );
                assert.strictEqual(
                    getAutofillValue(model, "A4", false, -1),
                    getCellContent(model, "A3")
                );
                assert.strictEqual(getAutofillValue(model, "A4", false, 2), "");
                assert.strictEqual(getAutofillValue(model, "A4", false, -3), "");
                // From header to value
                assert.strictEqual(
                    getAutofillValue(model, "B2", false, 1),
                    getCellContent(model, "B3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B2", false, 2),
                    getCellContent(model, "B4")
                );
                assert.strictEqual(getAutofillValue(model, "B2", false, 4), "");
                assert.strictEqual(
                    getAutofillValue(model, "A3", true, 1),
                    getCellContent(model, "B3")
                );
                assert.strictEqual(
                    getAutofillValue(model, "A3", true, 5),
                    getCellContent(model, "F3")
                );
                assert.strictEqual(getAutofillValue(model, "A3", true, 6), "");
                pivot.destroy();
            });

            QUnit.test("Autofill pivot values with date in rows", async function (assert) {
                assert.expect(5);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="date" interval="month" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                assert.strictEqual(
                    getAutofillValue(model, "A3", false, 1),
                    getCellContent(model, "A4").replace("10/2016", "05/2016")
                );
                assert.strictEqual(
                    getAutofillValue(model, "A5", false, 1),
                    '=PIVOT.HEADER("1","date:month","01/2017")'
                );
                assert.strictEqual(
                    getAutofillValue(model, "B3", false, 1),
                    getCellContent(model, "B4").replace("10/2016", "05/2016")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B5", false, 1),
                    getCellContent(model, "B5").replace("12/2016", "01/2017")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B5", false, -1),
                    getCellContent(model, "B4").replace("10/2016", "11/2016")
                );
                pivot.destroy();
            });

            QUnit.test("Autofill pivot values with date in cols", async function (assert) {
                assert.expect(3);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="row"/>
                        <field name="date" interval="day" type="col"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                assert.strictEqual(
                    getAutofillValue(model, "B1", true, 1),
                    getCellContent(model, "B1").replace("20/01/2016", "21/01/2016")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B2", true, 1),
                    getCellContent(model, "B2").replace("20/01/2016", "21/01/2016")
                );
                assert.strictEqual(
                    getAutofillValue(model, "B3", true, 1),
                    getCellContent(model, "B3").replace("20/01/2016", "21/01/2016")
                );
                pivot.destroy();
            });

            QUnit.test("Autofill pivot values with date (day)", async function (assert) {
                assert.expect(1);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="date" interval="day" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                assert.strictEqual(
                    getAutofillValue(model, "A3", false, 1),
                    getCellContent(model, "A3").replace("20/01/2016", "21/01/2016")
                );
                pivot.destroy();
            });

            QUnit.test("Autofill pivot values with date (quarter)", async function (assert) {
                assert.expect(1);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="date" interval="quarter" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                assert.strictEqual(
                    getAutofillValue(model, "A3", false, 1),
                    getCellContent(model, "A3").replace("2/2016", "3/2016")
                );
                pivot.destroy();
            });

            QUnit.test("Autofill pivot values with date (year)", async function (assert) {
                assert.expect(1);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="date" interval="year" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                assert.strictEqual(
                    getAutofillValue(model, "A3", false, 1),
                    getCellContent(model, "A3").replace("2016", "2017")
                );
                pivot.destroy();
            });

            QUnit.test("pivot ids are correctly assigned", async function (assert) {
                assert.expect(3);

                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="col"/>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                });
                const model = await pivot._getSpreadsheetModel();
                const [ p1 ] = Object.values(model.getters.getPivots());
                assert.strictEqual(p1.id, 1, "It should have id 1");
                const [ p2, p3 ] = [ Object.assign({}, p1), Object.assign({}, p1) ];
                model.dispatch("ADD_PIVOT", {
                    anchor: [12, 0],
                    pivot: p2,
                });
                assert.deepEqual(
                    Object.values(model.getters.getPivots()).map((p) => p.id), [1, 2],
                    "Last pivot should have id 2",
                );
                model.dispatch("ADD_PIVOT", {
                    anchor: [12, 0],
                    pivot: p3,
                });
                assert.deepEqual(
                    Object.values(model.getters.getPivots()).map((p) => p.id), [1, 2, 3],
                    "Last pivot should have id 3",
                );
                pivot.destroy();
            });

            QUnit.test("Insert in spreadsheet is disabled when no measure is specified", async function (assert) {
                assert.expect(1);
                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: this.data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                    session: { async user_has_group() { return true }},
                });
                await testUtils.pivot.toggleMeasuresDropdown(pivot);
                await testUtils.pivot.clickMeasure(pivot, 'foo');
                assert.ok(document.body.querySelector("button.o_pivot_add_spreadsheet").disabled);
                pivot.destroy();
            });

            QUnit.test("Insert in spreadsheet is disabled when data is empty", async function (assert) {
                assert.expect(1);
                const data = Object.assign({}, this.data);
                data.partner.records = [];
                data.product.records = [];
                const pivot = await createView({
                    View: PivotView,
                    model: "partner",
                    data: data,
                    arch: `
                    <pivot string="Partners">
                        <field name="foo" type="measure"/>
                    </pivot>`,
                    mockRPC: mockRPCFn,
                    session: { async user_has_group() { return true }},
                });
                assert.ok(document.body.querySelector("button.o_pivot_add_spreadsheet").disabled);
                pivot.destroy();
            });
        }
    );
});
