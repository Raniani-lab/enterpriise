/** @odoo-module **/
import { registry } from "@web/core/registry";
import { actionService } from "@web/webclient/actions/action_service";

import { getDashboardBasicServerData } from "./utils/test_data";
import { createDashboardEditAction, createNewDashboard } from "./utils/test_helpers";
import { getCellContent } from "@spreadsheet/../tests/utils/getters";
import { doMenuAction } from "@spreadsheet/../tests/utils/ui";

import { registries } from "@odoo/o-spreadsheet";

const { topbarMenuRegistry } = registries;

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

    QUnit.test("copy dashboard from topbar menu", async function (assert) {
        const serviceRegistry = registry.category("services");
        serviceRegistry.add("actionMain", actionService);
        const fakeActionService = {
            dependencies: ["actionMain"],
            start(env, { actionMain }) {
                return {
                    ...actionMain,
                    doAction: (actionRequest, options = {}) => {
                        if (
                            actionRequest.tag === "action_edit_dashboard" &&
                            actionRequest.params.spreadsheet_id === 111
                        ) {
                            assert.step("redirect");
                        } else {
                            return actionMain.doAction(actionRequest, options);
                        }
                    },
                };
            },
        };
        serviceRegistry.add("action", fakeActionService, { force: true });
        const { env } = await createDashboardEditAction({
            mockRPC: function (route, args) {
                if (args.model == "spreadsheet.dashboard" && args.method === "copy") {
                    assert.step("dashboard_copied");
                    const { spreadsheet_data, thumbnail } = args.kwargs.default;
                    assert.ok(spreadsheet_data);
                    assert.ok(thumbnail);
                    return 111;
                }
            },
        });
        await doMenuAction(topbarMenuRegistry, ["file", "make_copy"], env);
        assert.verifySteps(["dashboard_copied", "redirect"]);
    });
});
