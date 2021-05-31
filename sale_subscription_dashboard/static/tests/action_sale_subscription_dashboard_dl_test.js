/** @odoo-module */
import { mockDownload } from "@web/../tests/helpers/utils";
import { createWebClient, getActionManagerTestConfig, doAction } from "@web/../tests/webclient/actions/helpers";

let testConfig;
QUnit.module("Sale Subscription Dashboard Download Reports", {
    beforeEach: function () {
        testConfig = getActionManagerTestConfig();
    },
}, function () {
    QUnit.test("can execute sale subscription dashboard report download actions", async function (assert) {
        assert.expect(5);
        testConfig.serverData.actions[1] = {
            id: 1,
            data: {
                model: "sale.subscription",
                output_format: "pdf",
            },
            type: "ir_actions_sale_subscription_dashboard_download",
        };
        mockDownload((options) => {
            assert.step(options.url);
            assert.deepEqual(options.data, {
                model: "sale.subscription",
                output_format: "pdf",
            }, "should give the correct data");
            return Promise.resolve();
        });
        const webClient = await createWebClient({
            testConfig,
            mockRPC: function (route, args) {
                assert.step(args.method || route);
            },
        });
        await doAction(webClient, 1);
        assert.verifySteps([
            "/web/webclient/load_menus",
            "/web/action/load",
            "/salesman_subscription_reports",
        ]);
    });
});
