/** @odoo-module */

import { SpreadsheetSelectorDialog } from "@documents_spreadsheet/assets/components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { click, getFixture, mount, triggerEvent } from "@web/../tests/helpers/utils";
import { getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { prepareWebClientForSpreadsheet } from "../utils/webclient_helpers";

const serverData = getBasicServerData();
serverData.models["documents.document"].records = [
    {
        id: 1,
        name: "My spreadsheet",
        raw: "{}",
        folder_id: 1,
        handler: "spreadsheet",
        is_favorited: false,
    },
    {
        id: 2,
        name: "Untitled spreadsheet",
        raw: "{}",
        folder_id: 1,
        handler: "spreadsheet",
        is_favorited: false,
    },
    {
        id: 3,
        name: "My image",
        raw: "{}",
        folder_id: 1,
        handler: "image",
        is_favorited: false,
    },
];

function getDefaultProps() {
    return {
        type: "PIVOT",
        name: "Pipeline",
        confirm: () => {},
        close: () => {},
    };
}

/**
 * Create a spreadsheet model from a List controller
 *
 * @param {object} config
 * @param {object} [config.serverData] Data to be injected in the mock server
 * @param {object} [config.props] Props to be given to the component
 * @param {function} [config.mockRPC] Mock rpc function
 *
 * @returns {Promise<{target: HTMLElement, env: import("@web/env").OdooEnv}>}
 */
async function mountSpreadsheetSelectorDialog(config = {}) {
    await prepareWebClientForSpreadsheet();
    const target = getFixture();
    const env = await makeTestEnv({
        serverData: config.serverData || serverData,
        mockRPC: config.mockRPC,
    });
    //@ts-ignore
    env.dialogData = {
        isActive: true,
        close: () => {},
    };
    const props = {
        ...getDefaultProps(),
        ...(config.props || {}),
    };
    await mount(SpreadsheetSelectorDialog, target, { env, props });
    return { target, env };
}

QUnit.module("documents_spreadsheet > Spreadsheet Selector Dialog", {}, () => {
    QUnit.test("Display only spreadsheet and a blank spreadsheet", async (assert) => {
        const { target } = await mountSpreadsheetSelectorDialog();
        assert.strictEqual(target.querySelectorAll(".o-sp-dialog-item").length, 3);
    });

    QUnit.test("Threshold is not displayed with pivot type", async (assert) => {
        const { target } = await mountSpreadsheetSelectorDialog({ props: { type: "PIVOT" } });
        assert.strictEqual(
            target.querySelector(".modal-title").textContent,
            "Select a spreadsheet to insert your pivot."
        );
        assert.strictEqual(
            target.querySelector(".o-sp-dialog-meta-name-label").textContent,
            "Name of the pivot:"
        );
        assert.strictEqual(target.querySelector(".o-sp-dialog-meta-threshold"), null);
    });

    QUnit.test("Threshold is not displayed with link type", async (assert) => {
        const { target } = await mountSpreadsheetSelectorDialog({ props: { type: "LINK" } });
        assert.strictEqual(
            target.querySelector(".modal-title").textContent,
            "Select a spreadsheet to insert your link."
        );
        assert.strictEqual(
            target.querySelector(".o-sp-dialog-meta-name-label").textContent,
            "Name of the link:"
        );
        assert.strictEqual(target.querySelector(".o-sp-dialog-meta-threshold"), null);
    });

    QUnit.test("Threshold is displayed with list type", async (assert) => {
        const { target } = await mountSpreadsheetSelectorDialog({ props: { type: "LIST" } });
        assert.strictEqual(
            target.querySelector(".modal-title").textContent,
            "Select a spreadsheet to insert your list."
        );
        assert.strictEqual(
            target.querySelector(".o-sp-dialog-meta-name-label").textContent,
            "Name of the list:"
        );
        assert.ok(target.querySelector(".o-sp-dialog-meta-threshold"));
    });

    QUnit.test("Can change the name of an object", async (assert) => {
        assert.expect(1);
        const NEW_NAME = "new name";
        const confirm = (args) => {
            assert.strictEqual(args.name, NEW_NAME);
        };
        const { target } = await mountSpreadsheetSelectorDialog({ props: { confirm } });
        /** @type {HTMLInputElement} */
        const input = target.querySelector(".o-sp-dialog-meta-name input");
        input.value = NEW_NAME;
        await triggerEvent(input, null, "input");
        await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    });

    QUnit.test("Can change the threshold of a list object", async (assert) => {
        assert.expect(2);
        const threshold = 10;
        const confirm = (args) => {
            assert.strictEqual(args.threshold, threshold);
        };
        const { target } = await mountSpreadsheetSelectorDialog({
            props: { type: "LIST", confirm, threshold: 4 },
        });
        /** @type {HTMLInputElement} */
        const input = target.querySelector(".o-sp-dialog-meta-threshold-input");
        assert.strictEqual(input.value, "4");
        input.value = threshold.toString();
        await triggerEvent(input, null, "input");
        await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    });

    QUnit.test(
        "Change the search bar content trigger a new search with updated domain",
        async (assert) => {
            const { target } = await mountSpreadsheetSelectorDialog({
                mockRPC: async function (route, args) {
                    if (
                        args.method === "get_spreadsheets_to_display" &&
                        args.model === "documents.document"
                    ) {
                        assert.step(JSON.stringify(args.args[0]));
                    }
                },
            });
            /** @type {HTMLInputElement} */
            const input = target.querySelector(".o-sp-searchview-input");
            input.value = "a";
            await triggerEvent(input, null, "input");
            assert.verifySteps(["[]", JSON.stringify([["name", "ilike", "a"]])]);
        }
    );

    QUnit.test("Pager is limited to 9 elements", async (assert) => {
        const data = JSON.parse(JSON.stringify(serverData));
        data.models["documents.document"].records = [];
        // Insert 20 elements
        for (let i = 1; i <= 20; i++) {
            data.models["documents.document"].records.push({
                folder_id: 1,
                id: i,
                handler: "spreadsheet",
                name: `Spreadsheet_${i}`,
                raw: "{}",
            });
        }
        const { target } = await mountSpreadsheetSelectorDialog({
            serverData: data,
            mockRPC: async function (route, args) {
                if (
                    args.method === "get_spreadsheets_to_display" &&
                    args.model === "documents.document"
                ) {
                    assert.step(
                        JSON.stringify({ offset: args.kwargs.offset, limit: args.kwargs.limit })
                    );
                }
            },
        });
        await click(target, ".o_pager_next");
        await click(target, ".o_pager_next");
        assert.verifySteps([
            JSON.stringify({ offset: 0, limit: 9 }),
            JSON.stringify({ offset: 9, limit: 9 }),
            JSON.stringify({ offset: 18, limit: 9 }),
        ]);
    });

    QUnit.test("Can select the empty spreadsheet", async (assert) => {
        assert.expect(1);
        const confirm = (args) => {
            assert.strictEqual(args.spreadsheet, false);
        };
        const { target } = await mountSpreadsheetSelectorDialog({ props: { confirm } });
        const blank = target.querySelector(".o-sp-dialog-item-blank img");
        await triggerEvent(blank, null, "focus");
        await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    });

    QUnit.test("Can select an existing spreadsheet", async (assert) => {
        assert.expect(1);
        const confirm = (args) => {
            assert.strictEqual(args.spreadsheet.id, 1);
        };
        const { target } = await mountSpreadsheetSelectorDialog({ props: { confirm } });
        const blank = target.querySelector('.o-sp-dialog-item div[data-id="1"]');
        await triggerEvent(blank, null, "focus");
        await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    });

    QUnit.test("Selected spreadsheet is identifiable", async (assert) => {
        const { target } = await mountSpreadsheetSelectorDialog();
        assert.hasClass(
            target.querySelector(".o-sp-dialog-item-blank img"),
            "selected",
            "Blank spreadsheet should be selected by default"
        );
        const sp = target.querySelector('.o-sp-dialog-item div[data-id="1"]');
        await triggerEvent(sp, null, "focus");
        assert.hasClass(sp, "selected", "Selected spreadsheet should be identifiable");
    });
});
