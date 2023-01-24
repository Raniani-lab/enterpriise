/** @odoo-module **/

import { getDashboardBasicServerData } from "./utils/test_data";
import { createDashboardEditAction, createNewDashboard } from "./utils/test_helpers";
import { getCellContent } from "@spreadsheet/../tests/utils/getters";

QUnit.module("spreadsheet dashboard edition action", {}, function () {
    QUnit.test("open dashboard with existing data", async function (assert) {
        const serverData = getDashboardBasicServerData();
        const spreadsheetId = createNewDashboard(serverData, {
            sheets: [
                {
                    cells: {
                        A1: { content: "Hello" },
                    },
                },
            ],
        });
        const { model } = await createDashboardEditAction({ serverData, spreadsheetId });
        assert.strictEqual(getCellContent(model, "A1"), "Hello");
    });
});
