/** @odoo-module */

import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import {
    click,
    getFixture,
    nextTick,
    patchWithCleanup,
} from "@web/../tests/helpers/utils";
import { session } from "@web/session";
import { createSpreadsheet } from "../spreadsheet_test_utils";
import { getBasicData } from "../utils/spreadsheet_test_data";
import { createBasicChart, createGaugeChart, createScorecardChart} from "../utils/commands_helpers";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { registry } from "@web/core/registry";
import { menuService } from "@web/webclient/menus/menu_service";
import { actionService } from "@web/webclient/actions/action_service";

const { Model } = spreadsheet;

let target;
const chartId = "uuid1";

/**
 * The chart menu is hidden by default, and visible on :hover, but this property
 * can't be triggered programmatically, so we artificially make it visible to be
 * able to interact with it.
 */
async function showChartMenu() {
    const chartMenu = target.querySelector(".o-chart-menu");
    chartMenu.style.display = "flex";
    await nextTick();
}

/** Open the chart side panel of the first chart found in the page*/
async function openChartSidePanel() {
    await showChartMenu();
    const chartMenuItem = target.querySelector(".o-chart-menu-item:not(.o-chart-external-link)");
    await click(chartMenuItem);
    await click(target, ".o-menu-item[title='Edit']");
}

/** Click on external link of the first chart found in the page*/
async function clickChartExternalLink() {
    await showChartMenu();
    const chartMenuItem = target.querySelector(".o-chart-menu-item.o-chart-external-link");
    await click(chartMenuItem);
}

QUnit.module(
    "documents_spreadsheet > ir.ui.menu chart",
    {
        beforeEach: function () {
            target = getFixture();
            this.serverData = {};
            this.serverData.menus = {
                root: {
                    id: "root",
                    children: [1, 2],
                    name: "root",
                    appID: "root",
                },
                1: {
                    id: 1,
                    children: [],
                    name: "test menu 1",
                    xmlid: "documents_spreadsheet.test.menu",
                    appID: 1,
                    actionID: "menuAction",
                },
                2: {
                    id: 2,
                    children: [],
                    name: "test menu 2",
                    xmlid: "documents_spreadsheet.test.menu2",
                    appID: 1,
                    actionID: "menuAction2",
                },
            };
            this.serverData.actions = {
                menuAction: {
                    id: 99,
                    xml_id: "ir.ui.menu",
                    name: "menuAction",
                    res_model: "ir.ui.menu",
                    type: "ir.actions.act_window",
                    views: [[false, "list"]],
                },
                menuAction2: {
                    id: 100,
                    xml_id: "ir.ui.menu",
                    name: "menuAction2",
                    res_model: "ir.ui.menu",
                    type: "ir.actions.act_window",
                    views: [[false, "list"]],
                },
            };
            this.serverData.views = {};
            this.serverData.views["ir.ui.menu,false,list"] = `<tree></tree>`;
            this.serverData.views[
                "ir.ui.menu,false,search"
            ] = `<search></search>`;
            this.serverData.models = {
                ...getBasicData(),
                "ir.ui.menu": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        action: { string: "Action", type: "char" },
                        groups_id: {
                            string: "Groups",
                            type: "many2many",
                            relation: "res.group",
                        },
                    },
                    records: [
                        {
                            id: 1,
                            name: "test menu 1",
                            action: "action1",
                            groups_id: [10],
                        },
                        {
                            id: 2,
                            name: "test menu 2",
                            action: "action2",
                            groups_id: [10],
                        },
                    ],
                },
                "res.users": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        groups_id: {
                            string: "Groups",
                            type: "many2many",
                            relation: "res.group",
                        },
                    },
                    records: [{ id: 1, name: "Raoul", groups_id: [10] }],
                },
                "ir.actions": {
                    fields: {
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ id: 1 }],
                },
                "res.group": {
                    fields: { name: { string: "Name", type: "char" } },
                    records: [{ id: 10, name: "test group" }],
                },
            };
            patchWithCleanup(session, { uid: 1 });
            registry.category("services").add("menu", menuService).add("action", actionService);
        },
    },

    () => {
        QUnit.test(
            "can link an odoo menu to a basic chart chart in the side panel",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                createBasicChart(model, chartId);
                await nextTick();
                await openChartSidePanel(model);
                let odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(
                    odooMenu,
                    undefined,
                    "No menu linked with chart at start"
                );

                const irMenuField = target.querySelector(
                    ".o_field_many2one input"
                );
                assert.ok(
                    irMenuField,
                    "A menu to link charts to odoo menus was added to the side panel"
                );
                await click(irMenuField);
                await nextTick();
                await click(document.querySelectorAll(".ui-menu-item")[0]);
                odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(odooMenu.xmlid, "documents_spreadsheet.test.menu", "Odoo menu is linked to chart");
            }
        );

        QUnit.test(
            "can link an odoo menu to a scorecard chart chart in the side panel",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                createScorecardChart(model, chartId);
                await nextTick();
                await openChartSidePanel(model);
                let odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(
                    odooMenu,
                    undefined,
                    "No menu linked with chart at start"
                );

                const irMenuField = target.querySelector(
                    ".o_field_many2one input"
                );
                assert.ok(
                    irMenuField,
                    "A menu to link charts to odoo menus was added to the side panel"
                );
                await click(irMenuField);
                await nextTick();
                await click(document.querySelectorAll(".ui-menu-item")[0]);
                odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(odooMenu.xmlid, "documents_spreadsheet.test.menu", "Odoo menu is linked to chart");
            }
        );

        QUnit.test(
            "can link an odoo menu to a gauge chart chart in the side panel",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                createGaugeChart(model, chartId);
                await nextTick();
                await openChartSidePanel(model);
                let odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(
                    odooMenu,
                    undefined,
                    "No menu linked with chart at start"
                );

                const irMenuField = target.querySelector(
                    ".o_field_many2one input"
                );
                assert.ok(
                    irMenuField,
                    "A menu to link charts to odoo menus was added to the side panel"
                );
                await click(irMenuField);
                await nextTick();
                await click(document.querySelectorAll(".ui-menu-item")[0]);
                odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(odooMenu.xmlid, "documents_spreadsheet.test.menu", "Odoo menu is linked to chart");
            }
        );

        QUnit.test(
            "can remove link between an odoo menu and a chart in the side panel",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                createBasicChart(model, chartId);
                await nextTick();
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: "documents_spreadsheet.test.menu",
                });
                await openChartSidePanel(model);
                await nextTick();
                const irMenuField = target.querySelector(
                    ".o_field_many2one input"
                );
                // only way found to make it work
                $(irMenuField).val("").trigger("keyup").trigger("focusout");
                await nextTick();
                const odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(
                    odooMenu,
                    undefined,
                    "no menu is linked to chart"
                );
            }
        );

        QUnit.test(
            "Linked menu change in the side panel when we select another chart",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                const chartId2 = "id2";
                createBasicChart(model, chartId);
                createBasicChart(model, chartId2);
                await nextTick();
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: 1,
                });
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId: chartId2,
                    odooMenuId: 2,
                });
                await openChartSidePanel(model);
                await nextTick();

                let irMenuInput = target.querySelector(
                    ".o_field_many2one input"
                );
                assert.equal(irMenuInput.value, "test menu 1");

                const figure2 = target.querySelectorAll(".o-figure")[1];
                // click() doesn't work, I guess because we are using the mousedown event on figures and not the click
                const clickEvent = new Event("mousedown", { bubbles: true });
                figure2.dispatchEvent(clickEvent);
                await nextTick();
                irMenuInput = target.querySelector(".o_field_many2one input");
                assert.equal(irMenuInput.value, "test menu 2");
            }
        );

        QUnit.test(
            "icon external link isn't on the chart when its not linked to an odoo menu",
            async function (assert) {
                const env = await makeTestEnv({ serverData: this.serverData });
                const model = new Model({}, { evalContext: { env } });
                createBasicChart(model, chartId);
                await nextTick();
                const odooMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(
                    odooMenu,
                    undefined,
                    "No menu linked with the chart"
                );

                const externalRefIcon = target.querySelector(
                    ".o-chart-external-link"
                );
                assert.equal(externalRefIcon, null);
            }
        );

        QUnit.test(
            "icon external link is on the chart when its linked to an odoo menu",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                createBasicChart(model, chartId);
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: 1,
                });
                const chartMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(chartMenu.id, 1, "Odoo menu is linked to chart");
                await nextTick();

                const externalRefIcon = target.querySelector(
                    ".o-chart-external-link"
                );
                assert.ok(externalRefIcon);
            }
        );

        QUnit.test(
            "icon external link is not on the chart when its linked to a wrong odoo menu",
            async function (assert) {
                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });
                createBasicChart(model, chartId);
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: "menu which does not exist",
                });
                const chartMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(chartMenu, undefined, "cannot get a wrong menu");
                await nextTick();
                assert.containsNone(target, ".o-chart-external-link");
            }
        );

        QUnit.test(
            "click on icon external link on chart redirect to the odoo menu",
            async function (assert) {
                const serviceRegistry = registry.category("services");
                serviceRegistry.add("actionMain", actionService);
                const fakeActionService = {
                    dependencies: ["actionMain"],
                    start(env, { actionMain }) {
                        return {
                            ...actionMain,
                            doAction: (actionRequest, options = {}) => {
                                if (actionRequest === "menuAction2") {
                                    assert.step("doAction");
                                }
                                return actionMain.doAction(
                                    actionRequest,
                                    options
                                );
                            },
                        };
                    },
                };
                serviceRegistry.add("action", fakeActionService, {
                    force: true,
                });

                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });

                createBasicChart(model, chartId);
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: 2,
                });
                const chartMenu = model.getters.getChartOdooMenu(chartId);
                assert.equal(chartMenu.id, 2, "Odoo menu is linked to chart");
                await nextTick();

                await clickChartExternalLink();

                assert.verifySteps(["doAction"]);
            }
        );

        QUnit.test(
            "can use menus xmlIds instead of menu ids",
            async function (assert) {
                const serviceRegistry = registry.category("services");
                serviceRegistry.add("actionMain", actionService);
                const fakeActionService = {
                    dependencies: ["actionMain"],
                    start(env, { actionMain }) {
                        return {
                            ...actionMain,
                            doAction: (actionRequest, options = {}) => {
                                if (actionRequest === "menuAction2") {
                                    assert.step("doAction");
                                }
                                return actionMain.doAction(
                                    actionRequest,
                                    options
                                );
                            },
                        };
                    },
                };
                serviceRegistry.add("action", fakeActionService, {
                    force: true,
                });

                const { model } = await createSpreadsheet({
                    serverData: this.serverData,
                });

                createBasicChart(model, chartId);
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: "documents_spreadsheet.test.menu2",
                });
                await nextTick();

                await clickChartExternalLink();
                assert.verifySteps(["doAction"]);
            }
        );

        QUnit.test(
            "Links between charts and ir.menus are correctly imported/exported",
            async function (assert) {
                const env = await makeTestEnv({ serverData: this.serverData });
                const model = new Model({}, { evalContext: { env } });
                createBasicChart(model, chartId);
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: 1,
                });
                const exportedData = model.exportData();
                assert.equal(
                    exportedData.chartOdooMenusReferences[chartId],
                    1,
                    "Link to odoo menu is exported"
                );
                const importedModel = new Model(exportedData, { evalContext: { env } });
                const chartMenu =
                    importedModel.getters.getChartOdooMenu(chartId);
                assert.equal(chartMenu.id, 1, "Link to odoo menu is imported");
            }
        );

        QUnit.test(
            "Can undo-redo a LINK_ODOO_MENU_TO_CHART",
            async function (assert) {
                const env = await makeTestEnv({ serverData: this.serverData });
                const model = new Model({}, { evalContext: { env } });
                model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                    chartId,
                    odooMenuId: 1,
                });
                assert.equal(model.getters.getChartOdooMenu(chartId).id, 1);
                model.dispatch("REQUEST_UNDO");
                assert.equal(
                    model.getters.getChartOdooMenu(chartId),
                    undefined
                );
                model.dispatch("REQUEST_REDO");
                assert.equal(model.getters.getChartOdooMenu(chartId).id, 1);
            }
        );
    }
);
