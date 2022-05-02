/** @odoo-module */
/* global $ */

import { nextTick, dom, fields, createView } from "web.test_utils";
import { registry } from "@web/core/registry";
import { startServer, TEST_USER_IDS } from "@mail/../tests/helpers/test_utils";

import { jsonToBase64, base64ToJson } from "@documents_spreadsheet/bundle/o_spreadsheet/helpers";
import DocumentsKanbanView from "documents_spreadsheet.KanbanView";
import DocumentsListView from "documents_spreadsheet.ListView";
import CommandResult from "@documents_spreadsheet/bundle/o_spreadsheet/cancelled_reason";
import TemplateListView from "documents_spreadsheet.TemplateListView";
import { createDocumentsView } from "documents.test_utils";
import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import { SpreadsheetTemplateAction } from "@documents_spreadsheet/bundle/actions/spreadsheet_template/spreadsheet_template_action";

import { createSpreadsheetTemplate, createSpreadsheet, waitForEvaluation } from "../spreadsheet_test_utils";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { patchWithCleanup, getFixture } from "@web/../tests/helpers/utils";
import { actionService } from "@web/webclient/actions/action_service";
import { getCellContent, getCellFormula, getCellValue } from "../utils/getters_helpers";
import { setCellContent, setSelection } from "../utils/commands_helpers";
import { prepareWebClientForSpreadsheet } from "../utils/webclient_helpers";
import { createSpreadsheetFromPivot } from "../utils/pivot_helpers";
import { getBasicServerData } from "../utils/spreadsheet_test_data";
import { DataSources } from "@documents_spreadsheet/bundle/o_spreadsheet/data_sources/data_sources";

const { Model } = spreadsheet;
const { topbarMenuRegistry } = spreadsheet.registries;

const { module, test } = QUnit;

const { onMounted } = owl;

let serverData;

async function convertFormula(config) {
    const { model } = await createSpreadsheetFromPivot({
        serverData: config.serverData || getBasicServerData(),
        webClient: config.webClient,
    });

    await waitForEvaluation(model);
    const proms = [];
    for (const pivotId of model.getters.getPivotIds()) {
        proms.push(model.getters.getSpreadsheetPivotModel(pivotId).prepareForTemplateGeneration());
    }
    await Promise.all(proms);
    setCellContent(model, "A1", `=${config.formula}`);
    model.dispatch(config.convert);
    // Remove the equal sign
    return getCellContent(model, "A1").slice(1);
}

function selectB2(model) {
    setSelection(model, "B2");
}

module(
    "documents_spreadsheet > pivot_templates",
    {
        async beforeEach() {
            const pyEnv = await startServer();
            pyEnv['ir.model'].create([
                { name: "Product", model: "product" },
                { name: "partner", model: "partner" },
            ]);
            pyEnv['documents.document'].create([
                { name: "My spreadsheet", raw: "{}", is_favorited: false },
                { name: "", raw: "{}", is_favorited: true },
            ]);
            const documentsFolderId1 = pyEnv['documents.folder'].create({ name: "Workspace1", description: "Workspace" })
            const mailAliasId1 = pyEnv['mail.alias'].create({ alias_name: "hazard@rmcf.es" });
            pyEnv['documents.share'].create({
                name: "Share1",
                folder_id: documentsFolderId1,
                alias_id: mailAliasId1,
            });
            pyEnv['spreadsheet.template'].create([
                { name: "Template 1", data: btoa("{}") },
                { name: "Template 2", data: btoa("{}") },
            ]);
            this.data = Object.assign(pyEnv.mockServer.data, TEST_USER_IDS);
            Object.assign(this.data, {
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
                        probability: {
                            string: "Probability",
                            type: "integer",
                            searchable: true,
                            group_operator: "avg",
                        },
                        product_id: {
                            string: "Product",
                            type: "many2one",
                            relation: "product",
                            store: true,
                        },
                    },
                    records: [
                        {
                            id: 1,
                            foo: 12,
                            bar: 110,
                            probability: 10,
                            product_id: [37],
                        },
                        {
                            id: 2,
                            foo: 1,
                            bar: 110,
                            probability: 11,
                            product_id: [41],
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
            });
            serverData = { models: this.data };
        },
    },
    function () {
        module("Template");
        test("Dispatch template command is not allowed if cache is not loaded", async function (assert) {
            assert.expect(2);
            const { model: m1 } = await createSpreadsheetFromPivot();
            const model = new Model(m1.exportData(), { dataSources: new DataSources(m1.config.dataSources._orm)});
            assert.deepEqual(model.dispatch("CONVERT_PIVOT_TO_TEMPLATE").reasons, [
                CommandResult.PivotCacheNotLoaded,
            ]);
            assert.deepEqual(model.dispatch("CONVERT_PIVOT_FROM_TEMPLATE").reasons, [
                CommandResult.PivotCacheNotLoaded,
            ]);
        });

        test("Don't change formula if not many2one", async function (assert) {
            assert.expect(1);
            const formula = `PIVOT("1","probability","foo","12","bar","110")`;
            const result = await convertFormula({
                formula,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(result, formula);
        });

        test("Adapt formula from absolute to relative with many2one in col", async function (assert) {
            assert.expect(4);
            Object.assign(serverData, {
                views: {
                    "partner,false,pivot": `
                        <pivot string="Partners">
                            <field name="product_id" type="col"/>
                            <field name="bar" type="row"/>
                            <field name="probability" type="measure"/>
                        </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            });
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "has_group") {
                        return Promise.resolve(true);
                    }
                },
            });
            let result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id","37","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`
            );

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT.HEADER("1","product_id","37","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`
            );

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id","41","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT.HEADER("1","product_id","41","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );
        });

        test("Adapt formula from absolute to relative with integer ids", async function (assert) {
            assert.expect(2);
            Object.assign(serverData, {
                views: {
                    "partner,false,pivot": `
                         <pivot string="Partners">
                            <field name="bar" type="col"/>
                            <field name="product_id" type="row"/>
                            <field name="probability" type="measure"/>
                        </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            });
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "has_group") {
                        return Promise.resolve(true);
                    }
                },
            });
            let result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id",37,"bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`
            );
            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT.HEADER("1","product_id",41,"bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );
        });

        test("Adapt formula from absolute to relative with many2one in row", async function (assert) {
            assert.expect(4);
            Object.assign(serverData, {
                views: {
                    "partner,false,pivot": `
                         <pivot string="Partners">
                            <field name="bar" type="col"/>
                            <field name="product_id" type="row"/>
                            <field name="probability" type="measure"/>
                        </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            });
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "has_group") {
                        return Promise.resolve(true);
                    }
                },
            });

            let result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id","37","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`
            );

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id","41","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id","41","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT.HEADER("1","product_id","41","bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );
        });

        test("Adapt formula from relative to absolute with many2one in col", async function (assert) {
            assert.expect(4);
            Object.assign(serverData, {
                views: {
                    "partner,false,pivot": `
                         <pivot string="Partners">
                            <field name="product_id" type="col"/>
                            <field name="bar" type="row"/>
                            <field name="probability" type="measure"/>
                        </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            });
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "has_group") {
                        return Promise.resolve(true);
                    }
                },
            });
            let result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 1),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(result, `PIVOT("1","probability","product_id","37","bar","110")`);

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(result, `PIVOT.HEADER("1","product_id","37","bar","110")`);

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 2),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(result, `PIVOT("1","probability","product_id","41","bar","110")`);

            result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id", 2),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(result, `PIVOT.HEADER("1","product_id","41","bar","110")`);
        });

        test("Will ignore overflowing template position", async function (assert) {
            assert.expect(1);
            Object.assign(serverData, {
                views: {
                    "partner,false,pivot": `
                         <pivot string="Partners">
                            <field name="bar" type="col"/>
                            <field name="product_id" type="row"/>
                            <field name="probability" type="measure"/>
                        </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            });
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "has_group") {
                        return Promise.resolve(true);
                    }
                },
            });
            const result = await convertFormula({
                webClient,
                serverData,
                formula: `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(result, "");
        });

        test("copy template menu", async function (assert) {
            const serviceRegistry = registry.category("services");
            serviceRegistry.add("actionMain", actionService);
            const fakeActionService = {
                dependencies: ["actionMain"],
                start(env, { actionMain }) {
                    return {
                        ...actionMain,
                        doAction: (actionRequest, options = {}) => {
                            if (
                                actionRequest.tag === "action_open_template" &&
                                actionRequest.params.spreadsheet_id === 111
                            ) {
                                assert.step("redirect");
                            }
                            return actionMain.doAction(actionRequest, options);
                        },
                    };
                },
            };
            serviceRegistry.add("action", fakeActionService, { force: true });
            const models = this.data;
            const { env } = await createSpreadsheetTemplate({
                serverData: { models },
                mockRPC: function (route, args) {
                    if (args.model == "spreadsheet.template" && args.method === "copy") {
                        assert.step("template_copied");
                        const { data, thumbnail } = args.kwargs.default;
                        assert.ok(data);
                        assert.ok(thumbnail);
                        models["spreadsheet.template"].records.push({
                            id: 111,
                            name: "template",
                            data,
                            thumbnail,
                        });
                        return 111;
                    }
                },
            });
            const file = topbarMenuRegistry.getAll().find((item) => item.id === "file");
            const makeACopy = file.children.find((item) => item.id === "make_copy");
            makeACopy.action(env);
            await nextTick();
            assert.verifySteps(["template_copied", "redirect"]);
        });

        test("Adapt formula from relative to absolute with many2one in row", async function (assert) {
            assert.expect(4);
            Object.assign(serverData, {
                views: {
                    "partner,false,pivot": `
                         <pivot string="Partners">
                            <field name="bar" type="col"/>
                            <field name="product_id" type="row"/>
                            <field name="probability" type="measure"/>
                        </pivot>`,
                    "partner,false,search": `<search/>`,
                },
            });
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "has_group") {
                        return Promise.resolve(true);
                    }
                },
            });
            let result = await convertFormula({
                webClient,
                formula: `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
                serverData,
            });
            assert.equal(result, `PIVOT("1","probability","product_id","37","bar","110")`);

            result = await convertFormula({
                webClient,
                formula: `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
                serverData,
            });
            assert.equal(result, `PIVOT.HEADER("1","product_id","37","bar","110")`);

            result = await convertFormula({
                webClient,
                formula: `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
                serverData,
            });
            assert.equal(result, `PIVOT("1","probability","product_id","41","bar","110")`);

            result = await convertFormula({
                webClient,
                formula: `PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`,
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
                serverData,
            });
            assert.equal(result, `PIVOT.HEADER("1","product_id","41","bar","110")`);
        });

        test("Adapt pivot as function arg from relative to absolute", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `SUM(
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110"),
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")
                )`,
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(
                result,
                `SUM(PIVOT("1","probability","product_id","37","bar","110"),PIVOT("1","probability","product_id","41","bar","110"))`
            );
        });

        test("Adapt pivot as operator arg from relative to absolute", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")
                    +
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")
                `,
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id","37","bar","110")+PIVOT("1","probability","product_id","41","bar","110")`
            );
        });

        test("Adapt pivot as unary operator arg from relative to absolute", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `
                        -PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")
                    `,
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                convert: "CONVERT_PIVOT_FROM_TEMPLATE",
            });
            assert.equal(result, `-PIVOT("1","probability","product_id","37","bar","110")`);
        });

        test("Adapt pivot as operator arg from absolute to relative", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `
                    PIVOT("1","probability","product_id","37","bar","110")
                    +
                    PIVOT("1","probability","product_id","41","bar","110")
                `,
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")+PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110")`
            );
        });

        test("Adapt pivot as unary operator arg from absolute to relative", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `
                    -PIVOT("1","probability","product_id","37","bar","110")
                `,
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `-PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`
            );
        });

        test("Adapt pivot as function arg from absolute to relative", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `
                    SUM(
                        PIVOT("1","probability","product_id","37","bar","110"),
                        PIVOT("1","probability","product_id","41","bar","110")
                    )
                `,
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
            });
            assert.equal(
                result,
                `SUM(PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110"),PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",2),"bar","110"))`
            );
        });

        test("Computed ids are not changed", async function (assert) {
            assert.expect(1);
            const result = await convertFormula({
                formula: `PIVOT("1","probability","product_id",A2,"bar","110")`,
                convert: "CONVERT_PIVOT_TO_TEMPLATE",
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            assert.equal(result, `PIVOT("1","probability","product_id",A2,"bar","110")`);
        });

        test("Save as template menu", async function (assert) {
            assert.expect(7);
            const serviceRegistry = registry.category("services");
            serviceRegistry.add("actionMain", actionService);
            const fakeActionService = {
                dependencies: ["actionMain"],
                start(env, { actionMain }) {
                    return Object.assign({}, actionMain, {
                        doAction: (actionRequest, options = {}) => {
                            if (
                                actionRequest ===
                                "documents_spreadsheet.save_spreadsheet_template_action"
                            ) {
                                assert.step("create_template_wizard");

                                const context = options.additionalContext;
                                const data = base64ToJson(context.default_data);
                                const name = context.default_template_name;
                                const cells = data.sheets[0].cells;
                                assert.equal(
                                    name,
                                    "Untitled spreadsheet - Template",
                                    "It should be named after the spreadsheet"
                                );
                                assert.ok(context.default_thumbnail);
                                assert.equal(
                                    cells.A3.content,
                                    `=PIVOT.HEADER("1","product_id",PIVOT.POSITION("1","product_id",1))`
                                );
                                assert.equal(
                                    cells.B3.content,
                                    `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id",1),"bar","110")`
                                );
                                assert.equal(cells.A11.content, "😃");
                                return Promise.resolve(true);
                            }
                            return actionMain.doAction(actionRequest, options);
                        },
                    });
                },
            };
            serviceRegistry.add("action", fakeActionService);

            const { env, model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(model, "A11", "😃");
            const file = topbarMenuRegistry.getAll().find((item) => item.id === "file");
            const saveAsTemplate = file.children.find((item) => item.id === "save_as_template");
            saveAsTemplate.action(env);
            await nextTick();
            assert.verifySteps(["create_template_wizard"]);
        });

        test("copy template menu", async function (assert) {
            const serviceRegistry = registry.category("services");
            serviceRegistry.add("actionMain", actionService);
            const fakeActionService = {
                dependencies: ["actionMain"],
                start(env, { actionMain }) {
                    return {
                        ...actionMain,
                        doAction: (actionRequest, options = {}) => {
                            if (
                                actionRequest.tag === "action_open_template" &&
                                actionRequest.params.spreadsheet_id === 111
                            ) {
                                assert.step("redirect");
                            }
                            return actionMain.doAction(actionRequest, options);
                        },
                    };
                },
            };
            serviceRegistry.add("action", fakeActionService, { force: true });
            const models = this.data;
            const { env } = await createSpreadsheetTemplate({
                serverData: { models },
                mockRPC: function (route, args) {
                    if (args.model == "spreadsheet.template" && args.method === "copy") {
                        assert.step("template_copied");
                        const { data, thumbnail } = args.kwargs.default;
                        assert.ok(data);
                        assert.ok(thumbnail);
                        models["spreadsheet.template"].records.push({
                            id: 111,
                            name: "template",
                            data,
                            thumbnail,
                        });
                        return 111;
                    }
                },
            });
            const file = topbarMenuRegistry.getAll().find((item) => item.id === "file");
            const makeACopy = file.children.find((item) => item.id === "make_copy");
            makeACopy.action(env);
            await nextTick();
            assert.verifySteps(["template_copied", "redirect"]);
        });

        test("Autofill template position", async function (assert) {
            assert.expect(4);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(
                model,
                "B2",
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4444))`
            );

            // DOWN
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B3"),
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 10000),"bar",PIVOT.POSITION("1","bar", 4444))`
            );

            // UP
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 0 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B1"),
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9998),"bar",PIVOT.POSITION("1","bar", 4444))`
            );

            // RIGHT
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 2, row: 1 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "C2"),
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4445))`
            );

            // LEFT
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 0, row: 1 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "A2"),
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4443))`
            );
        });

        test("Autofill template position: =-PIVOT(...)", async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(
                model,
                "B2",
                `= - PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4444))`
            );

            // DOWN
            setSelection(model, "B2");
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B3"),
                `= - PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 10000),"bar",PIVOT.POSITION("1","bar", 4444))`
            );
        });

        test("Autofill template position: 2 PIVOT in one formula", async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(
                model,
                "B2",
                `=SUM(
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4444)),
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 666),"bar",PIVOT.POSITION("1","bar", 4444))
                )`.replace(/\n/g, "")
            );

            setSelection(model, "B2");
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            // Well this does not work, it only updates the last PIVOT figure. But at least it does not crash.
            assert.equal(
                getCellFormula(model, "B3"),
                `=SUM(
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4444)),
                    PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 667),"bar",PIVOT.POSITION("1","bar", 4444))
                )`.replace(/\n/g, "")
            );
        });

        test("Autofill template position: PIVOT.POSITION not in PIVOT", async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(model, "B2", `=PIVOT.POSITION("1","foo", 3333)`);

            // DOWN
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B3"),
                `=PIVOT.POSITION("1","foo", 3333)`,
                "Should have copied the origin value"
            );
        });

        test("Autofill template position: with invalid pivot id", async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(
                model,
                "B2",
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("10000","product_id", 9999))`
            );

            // DOWN
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B3"),
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("10000","product_id", 9999))`,
                "Should have copied the origin value"
            );
        });

        test("Autofill template position: increment last group", async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="foo" type="row"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            setCellContent(
                model,
                "B2",
                `=PIVOT("1","probability","foo",PIVOT.POSITION("1","foo", 3333),"product_id",PIVOT.POSITION("1","product_id", 9999),"bar",PIVOT.POSITION("1","bar", 4444))`
            );

            // DOWN
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B3"),
                `=PIVOT("1","probability","foo",PIVOT.POSITION("1","foo", 3333),"product_id",PIVOT.POSITION("1","product_id", 10000),"bar",PIVOT.POSITION("1","bar", 4444))`,
                "It should have incremented the last row group position"
            );
        });

        test("Autofill template position: does not increment last field if not many2one", async function (assert) {
            assert.expect(1);
            const { model } = await createSpreadsheetFromPivot({
                serverData: {
                    models: this.data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="foo" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            // last row field (foo) is not a position
            setCellContent(
                model,
                "B2",
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999), "foo","10","bar","15")`
            );

            // DOWN
            selectB2(model);
            model.dispatch("AUTOFILL_SELECT", { col: 1, row: 2 });
            model.dispatch("AUTOFILL");
            assert.equal(
                getCellFormula(model, "B3"),
                `=PIVOT("1","probability","product_id",PIVOT.POSITION("1","product_id", 9999), "foo","10","bar","15")`,
                "It should not have changed the formula"
            );
        });

        module("Template Modal");

        test("Create spreadsheet from kanban view opens a modal", async function (assert) {
            assert.expect(2);
            const kanban = await createDocumentsView({
                View: DocumentsKanbanView,
                model: "documents.document",
                data: this.data,
                arch: `
                    <kanban><templates><t t-name="kanban-box">
                        <div>
                            <field name="name"/>
                        </div>
                    </t></templates></kanban>
                `,
                archs: {
                    "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
                },
            });
            await dom.click(".o_documents_kanban_spreadsheet");
            await nextTick();
            assert.ok(
                $(".o-spreadsheet-templates-dialog").length,
                "should have opened the template modal"
            );
            assert.ok(
                $(".o-spreadsheet-templates-dialog .modal-body .o_searchview").length,
                "The Modal should have a search view"
            );
            kanban.destroy();
        });

        test("Create spreadsheet from list view opens a modal", async function (assert) {
            assert.expect(2);
            const list = await createDocumentsView({
                View: DocumentsListView,
                model: "documents.document",
                data: this.data,
                arch: `<tree></tree>`,
                archs: {
                    "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
                },
            });
            await dom.click(".o_documents_kanban_spreadsheet");

            assert.ok(
                $(".o-spreadsheet-templates-dialog").length,
                "should have opened the template modal"
            );

            assert.ok(
                $(".o-spreadsheet-templates-dialog .modal-body .o_searchview").length,
                "The Modal should have a search view"
            );
            list.destroy();
        });

        test("Can search template in modal with searchbar", async function (assert) {
            assert.expect(4);
            const kanban = await createDocumentsView({
                View: DocumentsKanbanView,
                model: "documents.document",
                data: this.data,
                arch: `
                    <kanban><templates><t t-name="kanban-box">
                        <field name="name"/>
                    </t></templates></kanban>
                `,
                archs: {
                    "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
                },
            });
            await dom.click(".o_documents_kanban_spreadsheet");
            const dialog = document.querySelector(".o-spreadsheet-templates-dialog");
            assert.equal(dialog.querySelectorAll(".o-template").length, 3);
            assert.equal(dialog.querySelector(".o-template").textContent, "Blank");

            const searchInput = dialog.querySelector(".o_searchview_input");
            await fields.editInput(searchInput, "Template 1");
            await dom.triggerEvent(searchInput, "keydown", { key: "Enter" });
            assert.equal(dialog.querySelectorAll(".o-template").length, 2);
            assert.equal(dialog.querySelector(".o-template").textContent, "Blank");
            kanban.destroy();
        });

        test("Name template with spreadsheet name", async function (assert) {
            assert.expect(3);
            const serviceRegistry = registry.category("services");
            serviceRegistry.add("actionMain", actionService);
            const fakeActionService = {
                dependencies: ["actionMain"],
                start(env, { actionMain }) {
                    return Object.assign({}, actionMain, {
                        doAction: (actionRequest, options = {}) => {
                            if (
                                actionRequest ===
                                "documents_spreadsheet.save_spreadsheet_template_action"
                            ) {
                                assert.step("create_template_wizard");
                                const name = options.additionalContext.default_template_name;
                                assert.equal(
                                    name,
                                    "My spreadsheet - Template",
                                    "It should be named after the spreadsheet"
                                );
                                return Promise.resolve(true);
                            }
                            return actionMain.doAction(actionRequest, options);
                        },
                    });
                },
            };
            serviceRegistry.add("action", fakeActionService, { force: true });

            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: function (route, args) {
                    if (args.method === "create" && args.model === "spreadsheet.template") {
                        assert.step("create_template");
                        assert.equal(
                            args.args[0].name,
                            "My spreadsheet",
                            "It should be named after the spreadsheet"
                        );
                    }
                },
            });
            const { env } = await createSpreadsheet({ spreadsheetId: 2, webClient });
            const target = getFixture();
            const input = $(target).find(".breadcrumb-item input");
            await fields.editInput(input, "My spreadsheet");
            await dom.triggerEvent(input, "change");
            const file = topbarMenuRegistry.getAll().find((item) => item.id === "file");
            const saveAsTemplate = file.children.find((item) => item.id === "save_as_template");
            saveAsTemplate.action(env);
            await nextTick();

            assert.verifySteps(["create_template_wizard"]);
        });

        test("Can fetch next templates", async function (assert) {
            assert.expect(8);
            this.data["spreadsheet.template"].records = this.data[
                "spreadsheet.template"
            ].records.concat([
                { id: 3, name: "Template 3", data: btoa("{}") },
                { id: 4, name: "Template 4", data: btoa("{}") },
                { id: 5, name: "Template 5", data: btoa("{}") },
                { id: 6, name: "Template 6", data: btoa("{}") },
                { id: 7, name: "Template 7", data: btoa("{}") },
                { id: 8, name: "Template 8", data: btoa("{}") },
                { id: 9, name: "Template 9", data: btoa("{}") },
                { id: 10, name: "Template 10", data: btoa("{}") },
                { id: 11, name: "Template 11", data: btoa("{}") },
                { id: 12, name: "Template 12", data: btoa("{}") },
            ]);
            let fetch = 0;
            const kanban = await createDocumentsView({
                View: DocumentsKanbanView,
                model: "documents.document",
                data: this.data,
                arch: `
                    <kanban><templates><t t-name="kanban-box">
                        <field name="name"/>
                    </t></templates></kanban>
                `,
                archs: {
                    "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
                },
                mockRPC: function (route, args) {
                    if (
                        route === "/web/dataset/search_read" &&
                        args.model === "spreadsheet.template"
                    ) {
                        fetch++;
                        assert.equal(args.limit, 9);
                        assert.step("fetch_templates");
                        if (fetch === 1) {
                            assert.equal(args.offset, undefined);
                        } else if (fetch === 2) {
                            assert.equal(args.offset, 9);
                        }
                    }
                    if (args.method === "search_read" && args.model === "ir.model") {
                        return Promise.resolve([{ name: "partner" }]);
                    }
                    return this._super.apply(this, arguments);
                },
            });

            await dom.click(".o_documents_kanban_spreadsheet");
            const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

            assert.equal(dialog.querySelectorAll(".o-template").length, 10);
            await dom.click(dialog.querySelector(".o_pager_next"));
            assert.verifySteps(["fetch_templates", "fetch_templates"]);
            kanban.destroy();
        });

        test("Disable create button if no template is selected", async function (assert) {
            assert.expect(2);
            this.data["spreadsheet.template"].records = this.data[
                "spreadsheet.template"
            ].records.concat([
                { id: 3, name: "Template 3", data: btoa("{}") },
                { id: 4, name: "Template 4", data: btoa("{}") },
                { id: 5, name: "Template 5", data: btoa("{}") },
                { id: 6, name: "Template 6", data: btoa("{}") },
                { id: 7, name: "Template 7", data: btoa("{}") },
                { id: 8, name: "Template 8", data: btoa("{}") },
                { id: 9, name: "Template 9", data: btoa("{}") },
                { id: 10, name: "Template 10", data: btoa("{}") },
                { id: 11, name: "Template 11", data: btoa("{}") },
                { id: 12, name: "Template 12", data: btoa("{}") },
            ]);
            const kanban = await createDocumentsView({
                View: DocumentsKanbanView,
                model: "documents.document",
                data: this.data,
                arch: `
                    <kanban><templates><t t-name="kanban-box">
                        <field name="name"/>
                    </t></templates></kanban>
                `,
                archs: {
                    "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
                },
            });
            // open template dialog
            await dom.click(".o_documents_kanban_spreadsheet");
            const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

            // select template
            await dom.triggerEvent(dialog.querySelectorAll(".o-template img")[1], "focus");

            // change page; no template should be selected
            await dom.click(dialog.querySelector(".o_pager_next"));
            assert.containsNone(dialog, ".o-template-selected");
            const createButton = dialog.querySelector(".o-spreadsheet-create");
            await dom.click(createButton);
            assert.ok(createButton.attributes.disabled);
            kanban.destroy();
        });

        test("Open spreadsheet template from list view", async function (assert) {
            assert.expect(3);
            const list = await createView({
                View: TemplateListView,
                model: "spreadsheet.template",
                data: this.data,
                arch: `
                    <tree>
                        <field name="name"/>
                        <button string="Edit" class="float-right" name="edit_template" icon="fa-pencil" />
                    </tree>
                `,
                intercepts: {
                    do_action: function ({ data }) {
                        assert.step("redirect_to_template");
                        assert.deepEqual(data.action, {
                            type: "ir.actions.client",
                            tag: "action_open_template",
                            params: {
                                spreadsheet_id: 1,
                                showFormulas: true,
                            },
                        });
                    },
                },
            });
            await dom.clickFirst(`button[name="edit_template"]`);
            assert.verifySteps(["redirect_to_template"]);
            list.destroy();
        });

        test("Copy template from list view", async function (assert) {
            assert.expect(4);
            const list = await createView({
                View: TemplateListView,
                model: "spreadsheet.template",
                data: this.data,
                arch: `
                    <tree>
                        <field name="name"/>
                        <button string="Make a copy" class="float-right" name="copy" type="object" icon="fa-clone" />
                    </tree>
                `,
                intercepts: {
                    execute_action: function ({ data }) {
                        assert.strictEqual(
                            data.action_data.name,
                            "copy",
                            "should call the copy method"
                        );
                        assert.equal(data.env.currentID, 1, "template with ID 1 should be copied");
                        assert.step("add_copy_of_template");
                    },
                },
            });
            await dom.clickFirst(`button[name="copy"]`);
            assert.verifySteps(["add_copy_of_template"]);
            list.destroy();
        });

        test("open template client action without collaborative indicators", async function (assert) {
            assert.expect(2);
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
            });
            await doAction(webClient, {
                type: "ir.actions.client",
                tag: "action_open_template",
                params: { spreadsheet_id: 1 },
            });
            const target = getFixture();
            assert.containsNone(target, ".o_spreadsheet_sync_status");
            assert.containsNone(target, ".o_spreadsheet_number_users");
        });

        test("collaboration communication is disabled", async function (assert) {
            assert.expect(1);
            await prepareWebClientForSpreadsheet();
            const webClient = await createWebClient({
                serverData,
                legacyParams: { withLegacyMockServer: true },
                mockRPC: async function (route) {
                    if (route.includes("join_spreadsheet_session")) {
                        assert.ok(false, "it should not join a collaborative session");
                    }
                    if (route.includes("dispatch_spreadsheet_message")) {
                        assert.ok(false, "it should not dispatch collaborative revisions");
                    }
                },
            });
            await doAction(webClient, {
                type: "ir.actions.client",
                tag: "action_open_template",
                params: { spreadsheet_id: 1 },
            });
            assert.ok(true);
        });

        test("open template with non Latin characters", async function (assert) {
            assert.expect(1);
            const model = new Model();
            setCellContent(model, "A1", "😃");
            this.data["spreadsheet.template"].records = [
                {
                    id: 99,
                    name: "template",
                    data: jsonToBase64(model.exportData()),
                },
            ];
            const { model: template } = await createSpreadsheetTemplate({
                serverData: { models: this.data },
                spreadsheetId: 99,
            });
            assert.equal(
                getCellValue(template, "A1"),
                "😃",
                "It should show the smiley as a smiley 😉"
            );
        });
        test("create and edit template and create new spreadsheet from it", async function (assert) {
            assert.expect(4);
            const templateModel = new Model();
            setCellContent(templateModel, "A1", "Firstname");
            setCellContent(templateModel, "B1", "Lastname");
            const id = 101;
            this.data["spreadsheet.template"].records = [
                {
                    id,
                    name: "template",
                    data: jsonToBase64(templateModel.exportData()),
                },
            ];
            let spreadSheetComponent;
            patchWithCleanup(SpreadsheetTemplateAction.prototype, {
                setup() {
                    this._super();
                    onMounted(() => {
                        spreadSheetComponent = this.spreadsheet;
                    });
                }
            });
            const { model, webClient } = await createSpreadsheetTemplate({
                serverData: { models: this.data },
                spreadsheetId: id,
                mockRPC: function (route, args) {
                    if (args.model == "spreadsheet.template") {
                        if (args.method === "write") {
                            const model = base64ToJson(args.args[1].data);
                            assert.strictEqual(
                                typeof model,
                                "object",
                                "Model type should be object"
                            );
                            const { A1, B1 } = model.sheets[0].cells;
                            assert.equal(
                                `${A1.content} ${B1.content}`,
                                `Firstname Name`,
                                "A1 and B1 should be changed after update"
                            );
                        }
                    }
                },
            });

            setCellContent(model, "B1", "Name");
            await spreadSheetComponent.props.onSpreadsheetSaved(
                spreadSheetComponent.getSaveData()
            );
            await doAction(webClient, {
                type: "ir.actions.client",
                tag: "action_open_template",
                params: { active_id: id },
            });
        });
    }
);
