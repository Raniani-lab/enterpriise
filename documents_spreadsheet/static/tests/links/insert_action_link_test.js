/** @odoo-module */
import { click, legacyExtraNextTick, nextTick } from "@web/../tests/helpers/utils";
import {
    applyGroup,
    selectGroup,
    toggleAddCustomGroup,
    toggleGroupByMenu,
    toggleMenu,
    toggleMenuItem,
} from "@web/../tests/search/helpers";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { getBasicData } from "../spreadsheet_test_data";
import { makeFakeUserService } from "@web/../tests/helpers/mock_services";
import { registry } from "@web/core/registry";

const serviceRegistry = registry.category("services");

const { loadJS } = owl.utils;

let serverData;

async function openView(viewType, options = {}) {
    const webClient = await createWebClient({
        serverData,
        mockRPC: options.mockRPC,
    });
    await doAction(webClient, 1, { viewType, additionalContext: options.additionalContext });
    return webClient;
}

async function insertInSpreadsheetAndClickLink(webClient) {
    await loadJS("/web/static/lib/Chart/Chart.js");
    await click(webClient.el, ".o_favorite_menu button");
    await click(webClient.el, ".o_insert_action_spreadsheet_menu");
    await click(document, ".modal-footer button.btn-primary");
    await nextTick();
    await legacyExtraNextTick();
    await click(webClient.el, ".o-link-tool a");
    await nextTick();
    await legacyExtraNextTick();
}

function getCurrentViewType(webClient) {
    return webClient.env.services.action.currentController.view.type;
}

function getCurrentAction(webClient) {
    return webClient.env.services.action.currentController.action;
}

QUnit.module(
    "documents_spreadsheet > action link",
    {
        beforeEach: function () {
            serverData = {};
            serverData.models = getBasicData();
            serverData.actions = {
                1: {
                    id: 1,
                    xml_id: "action_1",
                    name: "Partners Action 1",
                    res_model: "partner",
                    type: "ir.actions.act_window",
                    view_mode: "list",
                    views: [
                        [1, "list"],
                        [2, "kanban"],
                        [3, "graph"],
                        [4, "calendar"],
                        [5, "pivot"],
                        [6, "dashboard"],
                        [7, "map"],
                    ],
                },
            };
            serverData.views = {
                "partner,1,list": '<tree><field name="foo"/></tree>',
                "partner,2,kanban": `<kanban><templates><t t-name="kanban-box"><field name="foo"/></t></templates></kanban>`,
                "partner,view_graph_xml_id,graph": /*xml*/ `
                    <graph>
                        <field name="probability" type="measure"/>
                    </graph>`,
                "partner,4,calendar": `<calendar date_start="date"></calendar>`,
                "partner,5,pivot": /*xml*/ `
                    <pivot>
                        <field name="bar" type="row"/>
                        <field name="probability" type="measure"/>
                    </pivot>`,
                "partner,6,dashboard": /*xml*/ `
                    <dashboard>
                        <view type="graph" ref="view_graph_xml_id"/>
                    </dashboard>`,
                "partner,7,map": `<map></map>`,
                "partner,false,search": /*xml*/ `
                    <search>
                        <field name="foo"/>
                        <filter name="filter_1" domain="[['name', '=', 'Raoul']]"/>
                        <filter name="filter_2" domain="[['name', '=', False]]"/>
                        <filter name="group_by_name" context="{'group_by':'name'}"/>
                    </search>`,
            };
            serverData.models.partner.methods = {
                async check_access_rights() {
                    return true;
                },
            };
        },
    },
    () => {
        QUnit.test("simple list view", async function (assert) {
            assert.expect(1);
            const webClient = await openView("list");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "list");
        });

        QUnit.test("list view with custom domain and groupby", async function (assert) {
            assert.expect(6);
            serverData.actions["1"].domain = [["id", "!=", 0]];
            const webClient = await openView("list", {
                additionalContext: { search_default_filter_2: 1 },
            });

            // add a domain
            await click(webClient.el, ".o_filter_menu button");
            await click(webClient.el.querySelector(".o_menu_item > a"));

            // group by name
            await click(webClient.el, ".o_group_by_menu button");
            await click(webClient.el.querySelector(".o_menu_item > a"));

            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "list");
            const action = getCurrentAction(webClient);
            assert.deepEqual(
                action.domain,
                ["&", ["id", "!=", 0], "|", ["name", "=", false], ["name", "=", "Raoul"]],
                "The domain should be the same"
            );
            assert.strictEqual(action.res_model, "partner");
            assert.strictEqual(action.type, "ir.actions.act_window");
            assert.deepEqual(action.context.group_by, ["name"], "It should be grouped by name");
            assert.containsOnce(webClient.el, ".o_group_header", "The list view should be grouped");
        });

        QUnit.test("insert list in existing spreadsheet", async function (assert) {
            assert.expect(3);
            const webClient = await openView("list", {
                mockRPC: function (route, args) {
                    if (args.method === "join_spreadsheet_session") {
                        assert.step("spreadsheet-joined");
                        assert.equal(args.args[0], 1, "It should join the selected spreadsheet");
                    }
                },
            });
            await loadJS("/web/static/lib/Chart/Chart.js");
            await click(webClient.el, ".o_favorite_menu button");
            await click(webClient.el, ".o_insert_action_spreadsheet_menu");
            await click(webClient.el, ".modal-content select");
            document.body
                .querySelector(".modal-content option[value='1']")
                .setAttribute("selected", "selected");
            await click(document, ".modal-footer button.btn-primary");
            await nextTick();
            assert.verifySteps(["spreadsheet-joined"]);
        });

        QUnit.test("kanban view", async function (assert) {
            assert.expect(1);
            const webClient = await openView("kanban");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "kanban");
        });

        QUnit.test("simple graph view", async function (assert) {
            assert.expect(1);
            const webClient = await openView("graph");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "graph");
        });

        QUnit.test("graph view with custom chart type and order", async function (assert) {
            assert.expect(3);
            const webClient = await openView("graph");
            await click(webClient.el, ".fa-pie-chart");
            // count measure
            await toggleMenu(webClient, "Measures");
            await toggleMenuItem(webClient, "Count");
            await insertInSpreadsheetAndClickLink(webClient);
            const action = getCurrentAction(webClient);
            assert.deepEqual(action.context.graph_mode, "pie", "It should be a pie chart");
            assert.deepEqual(
                action.context.graph_measure,
                "__count",
                "It should have the custom measures"
            );
            assert.containsOnce(webClient.el, ".fa-pie-chart.active");
        });

        QUnit.test("calendar view", async function (assert) {
            assert.expect(1);
            const webClient = await openView("calendar");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "calendar");
        });

        QUnit.test("simple pivot view", async function (assert) {
            assert.expect(1);
            serviceRegistry.add("user", makeFakeUserService());
            const webClient = await openView("pivot");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "pivot");
        });

        QUnit.test("pivot view with custom group by and measure", async function (assert) {
            assert.expect(3);
            serviceRegistry.add("user", makeFakeUserService());
            const webClient = await openView("pivot");

            // group by name
            await toggleGroupByMenu(webClient);
            await toggleMenuItem(webClient.el, "name");

            // add count measure
            await toggleMenu(webClient, "Measures");
            await toggleMenuItem(webClient, "Count");

            await insertInSpreadsheetAndClickLink(webClient);
            const action = getCurrentAction(webClient);

            assert.deepEqual(
                action.context.pivot_row_groupby,
                ["name"],
                "It should be grouped by name"
            );
            assert.deepEqual(
                action.context.pivot_measures,
                ["probability", "__count"],
                "It should have the same two measures"
            );
            assert.containsN(
                webClient.el,
                ".o_pivot_measure_row",
                2,
                "It should display the two measures"
            );
        });

        QUnit.test("simple dashboard view", async function (assert) {
            assert.expect(1);
            const webClient = await openView("dashboard");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "dashboard");
        });

        QUnit.test(
            "dashboard view with custom chart type, group by and measure",
            async function (assert) {
                assert.expect(4);
                const webClient = await openView("dashboard");
                await click(webClient.el, ".fa-pie-chart");

                // custom group by
                await toggleGroupByMenu(webClient);
                await toggleAddCustomGroup(webClient);
                await selectGroup(webClient, "bar");
                await applyGroup(webClient);

                // count measure
                await toggleMenu(webClient, "Measures");
                await toggleMenuItem(webClient, "Count");

                await insertInSpreadsheetAndClickLink(webClient);
                const action = getCurrentAction(webClient);
                assert.containsOnce(webClient.el, ".fa-pie-chart.active");
                assert.deepEqual(
                    action.context.graph.graph_mode,
                    "pie",
                    "It should be a pie chart"
                );
                assert.deepEqual(
                    action.context.graph.graph_groupbys,
                    ["bar"],
                    "It should be grouped by bar"
                );
                assert.deepEqual(
                    action.context.graph.graph_measure,
                    "__count",
                    "It should have the same measure"
                );
            }
        );

        QUnit.test("map view", async function (assert) {
            assert.expect(1);
            const webClient = await openView("map");
            await insertInSpreadsheetAndClickLink(webClient);
            assert.strictEqual(getCurrentViewType(webClient), "map");
        });
    }
);
