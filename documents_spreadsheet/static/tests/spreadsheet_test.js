odoo.define("web.spreadsheet_tests", function (require) {
    "use strict";

    const testUtils = require("web.test_utils");
    const PivotView = require("web.PivotView");
    const PivotPlugin = require("documents_spreadsheet.PivotPlugin");

    const { createActionManager, fields, nextTick, dom, createView } = testUtils;
    const pluginRegistry = o_spreadsheet.registries.pluginRegistry;
    const cellMenuRegistry = o_spreadsheet.registries.cellMenuRegistry;
    const uuidv4 = o_spreadsheet.helpers.uuidv4;

    function mockRPCFn (route, args) {
        if (args.method === "search_read" && args.model === "ir.model") {
            return Promise.resolve([{ name: "partner" }]);
        }
        return this._super.apply(this, arguments);
    }

    async function createSpreadsheetFromPivot(pivotView) {
        const { data, debug } = pivotView;
        const pivot = await createView(Object.assign({View: PivotView}, pivotView));
        const documents = data["documents.document"].records;
        const id = Math.max(...documents.map((d) => d.id)) + 1
        documents.push({
            id,
            name: "pivot spreadsheet",
            raw: await pivot._getSpreadsheetData(),
        });
        pivot.destroy();
        const actionManager = await createActionManager({
            debug,
            data,
            mockRPC: mockRPCFn,
        });
        await actionManager.doAction({
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                active_id: id,
            },
        });
        await nextTick();
        const model = actionManager.getCurrentController().widget.spreadsheetComponent.componentRef.comp.spreadsheet.comp.model
        const env = {
            getters: model.getters,
            dispatch: model.dispatch,
            services: model.config.evalContext.env.services
        }
        return [actionManager, model, env];
    }

    QUnit.module("Spreadsheet Client Action", {
        beforeEach: function () {
            pluginRegistry.add("odooPivotPlugin", PivotPlugin);

            this.data = {
                "documents.document": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        raw: { string: "Data", type: "text" },
                        favorited_ids: { string: "Name", type: "many2many" },
                        is_favorited: { string: "Name", type: "boolean" },
                    },
                    records: [
                        { id: 1, name: "My spreadsheet", raw: "{}", is_favorited: false },
                        { id: 2, name: "", raw: "{}", is_favorited: true },
                    ],
                },
                partner: {
                    fields: {
                        foo: {
                            string: "Foo",
                            type: "integer",
                            searchable: true,
                            group_operator: "sum",
                        },
                        bar: {
                            string: "Bar",
                            type: "integer",
                            searchable: true,
                            group_operator: "sum",
                        },
                        product: {
                            relation: "product",
                            string: "Product",
                            type: "many2one",
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
                            bar: 110,
                            probability: 10,
                        },
                        {
                            id: 2,
                            foo: 1,
                            bar: 110,
                            probability: 11,
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
    }, function () {
        QUnit.module("Spreadsheet control panel");

        QUnit.test("breadcrumb is rendered in control panel", async function (assert) {
            assert.expect(3);
            const actionManager = await createActionManager({
                actions: [{
                    id: 1,
                    name: "Documents",
                    res_model: "documents.document",
                    type: "ir.actions.act_window",
                    views: [[false, "list"]],
                }],
                archs: {
                    "documents.document,false,list": '<tree><field name="name"/></tree>',
                    "documents.document,false,search": "<search></search>",
                },
                data: this.data,
            });
            await actionManager.doAction(1);
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 1,
              },
            })
            const breadcrumbItems = actionManager.el.querySelectorAll(".breadcrumb-item");
            assert.equal(breadcrumbItems[0].querySelector("a").innerText, "Documents",
                "It should display the breadcrumb");
            assert.equal(breadcrumbItems[1].querySelector("input").value, "My spreadsheet",
                "It should display the spreadsheet title");
            assert.ok(breadcrumbItems[1].querySelector(".o_spreadsheet_favorite"),
                "It should display the favorite toggle button");
            actionManager.destroy();
        });

        QUnit.test("untitled speadsheet", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            assert.equal(input.value, "", "It should be empty");
            assert.equal(input.placeholder, "Untitled spreadsheet", "It should display a placeholder");
            await nextTick();
            actionManager.destroy();
        });

        QUnit.test("input width changes when content changes", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "My");
            let width = input.offsetWidth;
            await fields.editInput(input, "My title");
            assert.ok(width < input.offsetWidth, "It should have grown to fit content");
            width = input.offsetWidth;
            await fields.editInput(input, "");
            assert.ok(width < input.offsetWidth, "It should have the size of the placeholder text");
            actionManager.destroy();
        });

        QUnit.test("changing the input saves the name", async function (assert) {
            assert.expect(4);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "write" && args.model === "documents.document") {
                        assert.step("spreadsheet_name_saved");
                        assert.deepEqual(args.args[0], [2], "It should write the correct document");
                        assert.deepEqual(args.args[1], { name: "My spreadsheet" }, "It should write the name");
                        return true;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editAndTrigger(input, "My spreadsheet",  ["change"]);
            assert.verifySteps(["spreadsheet_name_saved"]);
            actionManager.destroy();
        });

        QUnit.test("trailing white spaces are trimed", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "My spreadsheet  ");
            const width = input.offsetWidth;
            await dom.triggerEvent(input, "change");
            assert.equal(input.value, "My spreadsheet", "It should not have trailing white spaces");
            assert.ok(width > input.offsetWidth, "It should have resized");
            actionManager.destroy();
        });

        QUnit.test("focus sets the placeholder as value and select it", async function (assert) {
            assert.expect(4);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            assert.equal(input.value, "", "It should be empty");
            await dom.triggerEvent(input, "focus");
            assert.equal(input.value, "Untitled spreadsheet", "Placeholder should have become the input value");
            assert.equal(input.selectionStart, 0, "It should have selected the value");
            assert.equal(input.selectionEnd, input.value.length, "It should have selected the value");
            actionManager.destroy();
        });

        QUnit.test("only white spaces show the placeholder", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "  ");
            const width = input.offsetWidth;
            await dom.triggerEvent(input, "change");
            assert.equal(input.value, "", "It should be empty");
            assert.ok(width < input.offsetWidth, "It should have the placeholder size");
            actionManager.destroy();
        });

        QUnit.test("toggle favorite", async function (assert) {
            assert.expect(5);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "toggle_favorited" && args.model === "documents.document") {
                        assert.step("favorite_toggled");
                        assert.deepEqual(args.args[0], [1], "It should write the correct document");
                        return;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: 1,
                },
            });
            assert.containsNone(actionManager, ".favorite_button_enabled");
            const favorite = actionManager.el.querySelector(".o_spreadsheet_favorite");
            await dom.click(favorite);
            assert.containsOnce(actionManager, ".favorite_button_enabled");
            assert.verifySteps(["favorite_toggled"]);
            actionManager.destroy();
        });

        QUnit.test("already favorited", async function (assert) {
            assert.expect(1);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: 2,
                },
            });
            assert.containsOnce(actionManager, ".favorite_button_enabled", "It should already be favorited");
            actionManager.destroy();
        });

        QUnit.module("Spreadsheet");

        QUnit.test("Reinsert a pivot", async function (assert) {
            assert.expect(1);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(4, 9).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a pivot formula");
            actionManager.destroy();
        });

        QUnit.test("Reinsert a pivot in a too small sheet", async function (assert) {
            assert.expect(3);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            model.dispatch("CREATE_SHEET", { cols: 1, rows: 1, activate: true, id: uuidv4() });
            model.dispatch("SELECT_CELL", { col: 0, row: 0 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getNumberCols(model.getters.getActiveSheet()), 5);
            assert.equal(model.getters.getNumberRows(model.getters.getActiveSheet()), 5);
            assert.equal(model.getters.getCell(1, 2).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a pivot formula");
            actionManager.destroy();
        });

        QUnit.test("Reinsert a pivot with new data", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            this.data.partner.records = [...this.data.partner.records, {
                id: 3,
                foo: 1,
                bar: 7, // <- new row value in the pivot
                probability: 15,
                name: "name",
                display_name: "name",
            }];
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(4, 9).content, `=PIVOT("1","probability","bar","7","foo","1")`,
                "It should contain a pivot formula");
            assert.equal(model.getters.getCell(4, 10).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a new row");
            actionManager.destroy();
        });

        QUnit.test("undo pivot reinsert", async function (assert) {
            assert.expect(2);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(4, 9).content, `=PIVOT("1","probability","bar","110","foo","1")`,
                "It should contain a pivot formula");
            model.dispatch("UNDO");
            assert.notOk(model.getters.getCell(4, 9), "It should have removed the re-inserted pivot");
            actionManager.destroy();
        });

        QUnit.test("reinsert pivot with anchor on merge but not top left", async function (assert) {
            assert.expect(3);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            assert.equal(model.getters.getCell(1, 1).content, `=PIVOT.HEADER(\"1\",\"foo\",\"1\",\"measure\",\"probability\")`,
                "It should contain a pivot formula");
            model.dispatch("SELECT_CELL", { col: 0, row: 1 }); // A1 and A2 are merged; select A2
            assert.ok(model.getters.isInMerge("A2"));
            const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
            const reinsertPivot1 = cellMenuRegistry.getChildren(root, env)[0];
            await reinsertPivot1.action(env);
            assert.equal(model.getters.getCell(1, 1).content, `=PIVOT.HEADER(\"1\",\"foo\",\"1\",\"measure\",\"probability\")`,
                "It should contain a pivot formula");
            actionManager.destroy();
        });

        QUnit.test("Insert pivot element, with undo and redo", async function (assert) {
            assert.expect(3);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            model.dispatch("SELECT_CELL", { col: 3, row: 7 });
            const root = cellMenuRegistry.getAll().find((item) => item.id === "insert_pivot_section");
            const insertPivotSection1 = cellMenuRegistry.getChildren(root, env)[0];
            const insertPivotSection1Foo = cellMenuRegistry.getChildren(insertPivotSection1, env)[0];
            const insertPivotSection1Foo1 = cellMenuRegistry.getChildren(insertPivotSection1Foo, env)[0];
            insertPivotSection1Foo1.action(env);
            assert.equal(model.getters.getCell(3, 7).content, `=PIVOT.HEADER("1","foo","1")`)
            model.dispatch("UNDO");
            assert.notOk(model.getters.getCell(3, 7));
            model.dispatch("REDO");
            assert.equal(model.getters.getCell(3, 7).content, `=PIVOT.HEADER("1","foo","1")`)
            actionManager.destroy();
        });

        QUnit.test("Verify pivot measures are correctly computed :)", async function (assert) {
            assert.expect(4);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
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
            assert.equal(model.getters.getCell(1, 2).value, 11);
            assert.equal(model.getters.getCell(2, 2).value, 10);
            assert.equal(model.getters.getCell(1, 3).value, 11);
            assert.equal(model.getters.getCell(2, 3).value, 10);
            actionManager.destroy();
        });

        QUnit.test("Pivot cache is correctly copied", async function (assert) {
            assert.expect(18);

            const [actionManager, model, env] = await createSpreadsheetFromPivot({
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="product" type="col"/>
                    <field name="bar" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
                mockRPC: mockRPCFn,
            });
            const { cache } = model.getters.getPivot(1);
            const newCache = cache.withLabel("product", 37, "My amazing product");
            assert.equal(newCache.getRows(), cache.getRows());
            assert.equal(newCache.getRowCount(), cache.getRowCount());
            assert.equal(newCache.getColLevelIdentifier(0), cache.getColLevelIdentifier(0));
            assert.equal(newCache.getField("product"), cache.getField("product"));
            assert.equal(cache.getGroupLabel("product", 37), undefined);
            assert.equal(newCache.getGroupLabel("product", 37), "My amazing product");
            assert.ok(newCache.isGroupLabelLoaded("product", 37));
            assert.notOk(cache.isGroupLabelLoaded("product", 37));
            assert.deepEqual(
                newCache.isGroupedByDate(["product"]),
                cache.isGroupedByDate(["product"])
            );
            assert.equal(newCache.getMeasureName(0), cache.getMeasureName(0));
            assert.equal(newCache.getColGroupHierarchy(0, 1), cache.getColGroupHierarchy(0, 1));
            assert.equal(newCache.getRowValues(0), cache.getRowValues(0));
            assert.equal(newCache.getColGroupByLevels(), cache.getColGroupByLevels());
            assert.equal(newCache.getTopHeaderCount(), cache.getTopHeaderCount());
            assert.equal(newCache.getTopGroupIndex(), cache.getTopGroupIndex());
            assert.equal(newCache.getRowIndex("bar"), cache.getRowIndex("bar"));
            assert.deepEqual(newCache.getFieldValues("product"), cache.getFieldValues("product"));
            assert.deepEqual(newCache.getColumnValues(0), cache.getColumnValues(0));
            actionManager.destroy();
        });

    });
});
