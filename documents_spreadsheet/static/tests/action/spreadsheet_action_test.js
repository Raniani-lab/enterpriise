/** @odoo-module */

import * as spreadsheet from "@odoo/o-spreadsheet";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { downloadFile } from "@web/core/network/download";
import { getBasicData, getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { prepareWebClientForSpreadsheet } from "@spreadsheet_edition/../tests/utils/webclient_helpers";
import { getFixture, nextTick, click, patchWithCleanup } from "@web/../tests/helpers/utils";
import { createSpreadsheet } from "../spreadsheet_test_utils";
import { selectCell } from "@spreadsheet/../tests/utils/commands";
import { doMenuAction } from "@spreadsheet/../tests/utils/ui";
import { getCellContent, getCellValue } from "@spreadsheet/../tests/utils/getters";
import MockSpreadsheetCollaborativeChannel from "@spreadsheet_edition/../tests/utils/mock_spreadsheet_collaborative_channel";

const { topbarMenuRegistry } = spreadsheet.registries;
const { Model } = spreadsheet;
/** @typedef {import("@spreadsheet/o_spreadsheet/o_spreadsheet").Model} Model */
let target;

export const TEST_LOCALES = [
    {
        name: "United States",
        code: "en_US",
        thousandsSeparator: ",",
        decimalSeparator: ".",
        dateFormat: "m/d/yyyy",
        timeFormat: "hh:mm:ss a",
        formulaArgSeparator: ",",
    },
    {
        name: "France",
        code: "fr_FR",
        thousandsSeparator: " ",
        decimalSeparator: ",",
        dateFormat: "dd/mm/yyyy",
        timeFormat: "hh:mm:ss",
        formulaArgSeparator: ";",
    },
    {
        name: "Odooland",
        code: "od_OO",
        thousandsSeparator: "*",
        decimalSeparator: ".",
        dateFormat: "yyyy/mm/dd",
        timeFormat: "hh:mm:ss",
        formulaArgSeparator: ",",
    },
];

QUnit.module(
    "documents_spreadsheet > Spreadsheet Client Action",
    {
        beforeEach: function () {
            target = getFixture();
        },
    },
    function () {
        QUnit.test("open spreadsheet with deprecated `active_id` params", async function (assert) {
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

        QUnit.test("breadcrumb is rendered in control panel", async function (assert) {
            assert.expect(3);

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
            });
            await doAction(webClient, 1);
            await doAction(webClient, {
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    spreadsheet_id: 1,
                },
            });
            assert.strictEqual(
                target.querySelector("ol.breadcrumb").textContent,
                "Documents",
                "It should display the breadcrumb"
            );
            assert.strictEqual(
                target.querySelector(".o_breadcrumb input").value,
                "My spreadsheet",
                "It should display the spreadsheet title"
            );
            assert.containsOnce(
                target,
                ".o_breadcrumb .o_spreadsheet_favorite",
                "It should display the favorite toggle button"
            );
        });

        QUnit.test("Can open a spreadsheet in readonly", async function (assert) {
            const { model } = await createSpreadsheet({
                mockRPC: async function (route, args) {
                    if (args.method === "join_spreadsheet_session") {
                        return {
                            data: {},
                            name: "name",
                            revisions: [],
                            isReadonly: true,
                        };
                    }
                },
            });
            assert.ok(model.getters.isReadonly());
        });

        QUnit.test("dialog window not normally displayed", async function (assert) {
            assert.expect(1);
            await createSpreadsheet();
            const dialog = document.querySelector(".o_dialog");
            assert.equal(dialog, undefined, "Dialog should not normally be displayed ");
        });

        QUnit.test("edit text window", async function (assert) {
            assert.expect(4);
            const { env } = await createSpreadsheet();
            env.editText("testTitle", () => {}, {
                error: "testErrorText",
                placeholder: "testPlaceholder",
            });
            await nextTick();
            const dialog = document.querySelector(".o_dialog");
            assert.ok(dialog !== undefined, "Dialog can be opened");
            assert.equal(
                document.querySelector(".modal-title").textContent,
                "testTitle",
                "Can set dialog title"
            );
            assert.equal(
                document.querySelector(".o_dialog_error_text").textContent,
                "testErrorText",
                "Can set dialog error text"
            );
            assert.equal(
                document.querySelectorAll(".modal-footer button").length,
                2,
                "Edit text have 2 buttons"
            );
        });

        QUnit.test("notify user window", async function (assert) {
            const { env } = await createSpreadsheet();
            env.notifyUser({ text: "this is a notification", type: "warning", sticky: true });
            await nextTick();
            const dialog = document.querySelector(".o_dialog");
            assert.ok(dialog !== undefined, "Dialog can be opened");
            const notif = document.querySelector("div.o_notification");
            assert.ok(notif !== undefined, "the notification exists");
            assert.equal(
                notif.querySelector("div.o_notification_content").textContent,
                "this is a notification",
                "Can set dialog content"
            );
            assert.ok(
                notif.classList.contains("border-warning"),
                "NotifyUser generates a warning notification"
            );
        });

        QUnit.test("raise error window", async function (assert) {
            assert.expect(4);
            const { env } = await createSpreadsheet();
            env.raiseError("this is a message in an opened window that requests user action");
            await nextTick();
            const dialog = document.querySelector(".o_dialog");
            assert.ok(dialog !== undefined, "Dialog can be opened");
            assert.equal(
                document.querySelector(".modal-body div").textContent,
                "this is a message in an opened window that requests user action",
                "Can set dialog content"
            );
            assert.equal(
                document.querySelector(".o_dialog_error_text"),
                null,
                "NotifyUser have no error text"
            );
            assert.equal(
                document.querySelectorAll(".modal-footer button").length,
                1,
                "NotifyUser have 1 button"
            );
        });

        QUnit.test("Grid has still the focus after a dialog", async function (assert) {
            assert.expect(2);

            const { model, env } = await createSpreadsheet();
            selectCell(model, "F4");
            env.raiseError("Notification");
            await nextTick();
            await click(document, ".modal-footer .btn-primary");
            await nextTick();
            assert.strictEqual(document.activeElement.tagName, "INPUT");
            assert.strictEqual(
                document.activeElement.parentElement.className,
                "o-grid o-two-columns"
            );
        });

        QUnit.test("convert data from template", async function (assert) {
            const data = {
                sheets: [
                    {
                        id: "sheet1",
                        cells: {
                            A1: {
                                content:
                                    '=ODOO.PIVOT(1,"probability","foo", ODOO.PIVOT.POSITION(1, "foo", 1))',
                            },
                        },
                    },
                ],
                pivots: {
                    1: {
                        id: 1,
                        colGroupBys: ["foo"],
                        domain: [],
                        measures: [{ field: "probability" }],
                        model: "partner",
                        rowGroupBys: ["bar"],
                        context: {},
                    },
                },
            };
            const serverData = getBasicServerData();
            serverData.models["documents.document"].records.push({
                id: 3000,
                name: "My template spreadsheet",
                spreadsheet_data: JSON.stringify(data),
            });
            patchWithCleanup(MockSpreadsheetCollaborativeChannel.prototype, {
                sendMessage(message) {
                    if (message.type === "SNAPSHOT") {
                        assert.step("snapshot");
                        assert.deepEqual(
                            message.data.sheets[0].cells.A1.content,
                            '=ODOO.PIVOT(1,"probability","foo","1")'
                        );
                    }
                },
            });
            const { model } = await createSpreadsheet({
                spreadsheetId: 3000,
                serverData,
                convert_from_template: true,
            });
            assert.strictEqual(
                getCellContent(model, "A1"),
                '=ODOO.PIVOT(1,"probability","foo","1")'
            );
            await nextTick();
            assert.verifySteps(["snapshot"]);
        });

        QUnit.test("menu > download as json", async function (assert) {
            let downloadedData = null;
            patchWithCleanup(downloadFile, {
                _download: (data, fileName) => {
                    assert.step("download");
                    assert.ok(data.includes("Hello World"));
                    assert.ok(data.includes("A3"));
                    assert.strictEqual(fileName, "My spreadsheet.osheet.json");
                    downloadedData = data;
                },
            });

            const serverData = getBasicServerData();
            const spreadsheet = serverData.models["documents.document"].records[1];
            spreadsheet.name = "My spreadsheet";
            spreadsheet.spreadsheet_data = JSON.stringify({
                sheets: [{ cells: { A3: { content: "Hello World" } } }],
            });

            const { env, model } = await createSpreadsheet({
                spreadsheetId: spreadsheet.id,
                serverData,
            });

            assert.strictEqual(getCellValue(model, "A3"), "Hello World");

            await doMenuAction(topbarMenuRegistry, ["file", "download_as_json"], env);
            assert.verifySteps(["download"]);

            const modelFromLoadedJSON = new Model(JSON.parse(downloadedData));
            assert.strictEqual(getCellValue(modelFromLoadedJSON, "A3"), "Hello World");
        });

        QUnit.test("Spreadsheet is created with locale in data", async function (assert) {
            const serverData = getBasicServerData();
            serverData.models["documents.document"].records.push({
                id: 3000,
                name: "My template spreadsheet",
                spreadsheet_data: JSON.stringify({ settings: { locale: TEST_LOCALES[1] } }),
            });

            const { model } = await createSpreadsheet({ serverData, spreadsheetId: 3000 });
            assert.deepEqual(model.getters.getLocale().code, "fr_FR");
        });

        QUnit.test("Odoo locales are displayed in setting side panel", async function (assert) {
            const { env } = await createSpreadsheet({
                mockRPC: function (route, { method, model }) {
                    if (method === "get_locales_for_spreadsheet") {
                        return TEST_LOCALES;
                    }
                },
            });

            env.openSidePanel("Settings", {});
            await nextTick();

            const loadedLocales = [];
            const options = document.querySelectorAll(".o-settings-panel select option");
            for (const option of options) {
                loadedLocales.push(option.value);
            }

            assert.deepEqual(loadedLocales, ["en_US", "fr_FR", "od_OO"]);
        });
    }
);
