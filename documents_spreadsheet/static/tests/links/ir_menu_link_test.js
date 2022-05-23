/** @odoo-module */
/* global $ */

import { registry } from "@web/core/registry";
import { menuService } from "@web/webclient/menus/menu_service";
import { session } from "@web/session";
import { actionService } from "@web/webclient/actions/action_service";
import { click, legacyExtraNextTick, getFixture, nextTick, patchWithCleanup } from "@web/../tests/helpers/utils";

import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { createSpreadsheet } from "../spreadsheet_test_utils";
import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import { getBasicData } from "../utils/spreadsheet_test_data";
import { getCell } from "../utils/getters_helpers";
import { setCellContent, setSelection } from "../utils/commands_helpers";
import { spreadsheetLinkMenuCellService } from "../../src/bundle/ir_ui_menu";

const { registries, Model } = spreadsheet;
const { cellMenuRegistry } = registries;

let target;

function labelInput() {
    return target.querySelectorAll(".o-link-editor input")[0];
}

function urlInput() {
    return target.querySelectorAll(".o-link-editor input")[1];
}

/**
 * Create a spreadsheet and open the menu selector to
 * insert a menu link in A1.
 */
async function openMenuSelector(serverData) {
    const { webClient, env, model } = await createSpreadsheet({ serverData });
    const insertLinkMenu = cellMenuRegistry.getAll().find((item) => item.id === "insert_link");
    await insertLinkMenu.action(env);
    await nextTick();
    await click(target, ".o-special-link");
    await click(target, ".o-menu-item[data-name='odooMenu']");
    return { webClient, env, model };
}

QUnit.module(
    "documents_spreadsheet > ir.ui.menu links",
    {
        beforeEach: function () {
            target = getFixture();
            this.serverData = {};
            this.serverData.menus = {
                root: { id: "root", children: [1, 2], name: "root", appID: "root" },
                1: { id: 1, children: [], name: "menu with xmlid", appID: 1, xmlid: "test_menu", actionID: "action1", },
                2: { id: 2, children: [], name: "menu without xmlid", appID: 2 },
            };
            this.serverData.actions = {
                action1: {
                    id: 99,
                    xml_id: "action1",
                    name: "action1",
                    res_model: "ir.ui.menu",
                    type: "ir.actions.act_window",
                    views: [[false, "list"]],
                }
            };
            this.serverData.views = {};
            this.serverData.views["ir.ui.menu,false,list"] = `<tree></tree>`;
            this.serverData.views["ir.ui.menu,false,search"] = `<search></search>`;
            this.serverData.models = {
                ...getBasicData(),
                "ir.ui.menu": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        action: { string: "Action", type: "char" },
                        groups_id: { string: "Groups", type: "many2many", relation: "res.group" },
                    },
                    records: [
                        { id: 1, name: "menu with xmlid", action: "action1", groups_id: [10] },
                        { id: 2, name: "menu without xmlid", action: "action2", groups_id: [10] },
                    ],
                },
                "res.users": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        groups_id: { string: "Groups", type: "many2many", relation: "res.group" },
                    },
                    records: [
                        { id: 1, name: "Raoul", groups_id: [10] },
                        { id: 2, name: "Joseph", groups_id: [] },
                    ],
                },
                "res.group": {
                    fields: { name: { string: "Name", type: "char" } },
                    records: [{ id: 10, name: "test group" }],
                },
            };
            patchWithCleanup(session, { uid: 1 });
        },
    },
    () => {
        QUnit.test("ir.menu linked based on xml id", async function (assert) {
            registry.category("services")
                .add("menu", menuService)
                .add("action", actionService)
                .add('spreadsheetLinkMenuCell', spreadsheetLinkMenuCellService);
            const env = await makeTestEnv({ serverData: this.serverData });
            const model = new Model({}, { evalContext: { env } });
            setCellContent(model, "A1", "[label](odoo://ir_menu_xml_id/test_menu)");
            const cell = getCell(model, "A1");
            assert.equal(cell.evaluated.value, "label", "The value should be the menu name");
            assert.equal(
                cell.content,
                "[label](odoo://ir_menu_xml_id/test_menu)",
                "The content should be the complete markdown link"
            );
            assert.equal(cell.link.label, "label", "The link label should be the menu name");
            assert.equal(
                cell.link.url,
                "odoo://ir_menu_xml_id/test_menu",
                "The link url should reference the correct menu"
            );
        });

        QUnit.test("ir.menu linked based on record id", async function (assert) {
            assert.expect(4);
            registry.category("services")
                .add("menu", menuService)
                .add("action", actionService)
                .add('spreadsheetLinkMenuCell', spreadsheetLinkMenuCellService);
            const env = await makeTestEnv({ serverData: this.serverData });
            const model = new Model({}, { evalContext: { env } });
            setCellContent(model, "A1", "[label](odoo://ir_menu_id/2)");
            const cell = getCell(model, "A1");
            assert.equal(cell.evaluated.value, "label", "The value should be the menu name");
            assert.equal(
                cell.content,
                "[label](odoo://ir_menu_id/2)",
                "The content should be the complete markdown link"
            );
            assert.equal(cell.link.label, "label", "The link label should be the menu name");
            assert.equal(
                cell.link.url,
                "odoo://ir_menu_id/2",
                "The link url should reference the correct menu"
            );
        });

        QUnit.test("ir.menu linked based on xml id which does not exists", async function (assert) {
            assert.expect(2);
            registry.category("services")
                .add("menu", menuService)
                .add("action", actionService)
                .add('spreadsheetLinkMenuCell', spreadsheetLinkMenuCellService);
            const env = await makeTestEnv({ serverData: this.serverData });
            const model = new Model(
                {},
                {
                    evalContext: { env },
                }
            );
            setCellContent(model, "A1", "[label](odoo://ir_menu_xml_id/does_not_exists)");
            const cell = getCell(model, "A1");
            assert.equal(cell.content, "[label](odoo://ir_menu_xml_id/does_not_exists)");
            assert.equal(cell.evaluated.value, "#BAD_EXPR");
        });

        QUnit.test(
            "ir.menu linked based on record id which does not exists",
            async function (assert) {
                assert.expect(2);
                registry.category("services")
                .add("menu", menuService)
                .add("action", actionService)
                .add('spreadsheetLinkMenuCell', spreadsheetLinkMenuCellService);
                const env = await makeTestEnv({ serverData: this.serverData });
                const model = new Model(
                    {},
                    {
                        evalContext: { env },
                    }
                );
                setCellContent(model, "A1", "[label](odoo://ir_menu_id/9999)");
                const cell = getCell(model, "A1");
                assert.equal(cell.content, "[label](odoo://ir_menu_id/9999)");
                assert.equal(cell.evaluated.value, "#BAD_EXPR");
            }
        );

        QUnit.test("Odoo link cells can be imported/exported", async function (assert) {
            assert.expect(8);
            registry.category("services")
                .add("menu", menuService)
                .add("action", actionService)
                .add('spreadsheetLinkMenuCell', spreadsheetLinkMenuCellService);
            const { model, env } = await createSpreadsheet({
                serverData: this.serverData,
              });
            setCellContent(model, "A1", "[label](odoo://ir_menu_id/2)");
            let cell = getCell(model, "A1");
            assert.equal(cell.evaluated.value, "label", "The value should be the menu name");
            assert.equal(
                cell.content,
                "[label](odoo://ir_menu_id/2)",
                "The content should be the complete markdown link"
            );
            assert.equal(cell.link.label, "label", "The link label should be the menu name");
            assert.equal(
                cell.link.url,
                "odoo://ir_menu_id/2",
                "The link url should reference the correct menu"
            );
            const model2 = new Model(model.exportData(), { evalContext: { env } });
            cell = getCell(model2, "A1");
            assert.equal(cell.evaluated.value, "label", "The value should be the menu name");
            assert.equal(
                cell.content,
                "[label](odoo://ir_menu_id/2)",
                "The content should be the complete markdown link"
            );
            assert.equal(cell.link.label, "label", "The link label should be the menu name");
            assert.equal(
                cell.link.url,
                "odoo://ir_menu_id/2",
                "The link url should reference the correct menu"
            );
        });

        QUnit.test("insert a new ir menu link", async function (assert) {
            assert.expect(6);
            const { model } = await openMenuSelector(this.serverData);
            await click(target, ".o_field_many2one input");
            assert.ok(target.querySelector("button.o-confirm").disabled);
            await click(document.querySelectorAll(".ui-menu-item")[0]);
            await click(document, "button.o-confirm");
            assert.equal(
                labelInput().value,
                "menu with xmlid",
                "The label should be the menu name"
            );
            assert.equal(
                urlInput().value,
                "menu with xmlid",
                "The url displayed should be the menu name"
            );
            assert.ok(urlInput().disabled, "The url input should be disabled");
            await click(target, "button.o-save");
            const cell = getCell(model, "A1");
            assert.equal(
                cell.content,
                "[menu with xmlid](odoo://ir_menu_xml_id/test_menu)",
                "The content should be the complete markdown link"
            );
            assert.equal(
                target.querySelector(".o-link-tool a").text,
                "menu with xmlid",
                "The link tooltip should display the menu name"
            );
        });

        QUnit.test(
            "insert a new ir menu link when the menu does not have an xml id",
            async function (assert) {
                assert.expect(6);
                const { model } = await openMenuSelector(this.serverData);
                await click(target, ".o_field_many2one input");
                assert.ok(target.querySelector("button.o-confirm").disabled);
                const item = document.querySelectorAll(".ui-menu-item")[1];
                // don't ask why it's needed and why it only works with a jquery event >:(
                $(item).trigger("mouseenter");
                await click(item);
                await click(target, "button.o-confirm");
                assert.equal(
                    labelInput().value,
                    "menu without xmlid",
                    "The label should be the menu name"
                );
                assert.equal(
                    urlInput().value,
                    "menu without xmlid",
                    "The url displayed should be the menu name"
                );
                assert.ok(urlInput().disabled, "The url input should be disabled");
                await click(target, "button.o-save");
                const cell = getCell(model, "A1");
                assert.equal(
                    cell.content,
                    "[menu without xmlid](odoo://ir_menu_id/2)",
                    "The content should be the complete markdown link"
                );
                assert.equal(
                    target.querySelector(".o-link-tool a").text,
                    "menu without xmlid",
                    "The link tooltip should display the menu name"
                );
            }
        );

        QUnit.test("cancel ir.menu selection", async function (assert) {
            assert.expect(4);
            await openMenuSelector(this.serverData);
            await click(target, ".o_field_many2one input");
            await click(document.querySelectorAll(".ui-menu-item")[0]);
            assert.containsOnce(target, ".o-ir-menu-selector");
            await click(target, ".modal-footer button.o-cancel");
            assert.containsNone(target, ".o-ir-menu-selector");
            assert.equal(labelInput().value, "", "The label should be empty");
            assert.equal(urlInput().value, "", "The url displayed should be the menu name");
        });

        QUnit.test("ir.menu link keep breadcrumb", async function (assert) {
          const { model } = await createSpreadsheet({
            serverData: this.serverData,
          });
          setCellContent(
            model,
            "A1",
            "[menu with xmlid](odoo://ir_menu_xml_id/test_menu)"
          );
          setSelection(model, "A1");
          await nextTick();
          const link = document.querySelector("a.o-link");
          await click(link);
          await legacyExtraNextTick();
          const items = document.querySelectorAll(".breadcrumb-item");
          const [breadcrumb1, breadcrumb2] = Array.from(items).map(
            (item) => item.innerText
          );
          assert.equal(breadcrumb1, "Untitled spreadsheet");
          assert.equal(breadcrumb2, "action1");
        });

        QUnit.test("menu many2one field input is focused", async function (assert) {
            assert.expect(1);
            await openMenuSelector(this.serverData);
            assert.equal(
                document.activeElement,
                target.querySelector(".o_field_many2one input"),
                "the input should be focused"
            );
        });
    }
);
