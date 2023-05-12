/** @odoo-module */

import { registry } from "@web/core/registry";

import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { click, getFixture } from "@web/../tests/helpers/utils";
import { makeFakeNotificationService } from "@web/../tests/helpers/mock_services";
import { getVisibleButtons } from "@web/../tests/search/helpers";

QUnit.module("timesheet_grid", (hooks) => {
    let target;
    hooks.beforeEach(async function (assert) {
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.module("timesheet_validation_kanban_view");

    QUnit.test("Should trigger notification on validation", async function(assert) {
        const notificationMock = (message, options) => {
            assert.step("notification_triggered");
            return () => {};
        };
        registry.category("services").add("notification", makeFakeNotificationService(notificationMock), {
            force: true,
        });
        await makeView({
            type: "kanban",
            resModel: "account.analytic.line",
            serverData: {
                models: {
                    'account.analytic.line': {
                        fields: {
                            unit_amount: { string: "Unit Amount", type: "integer" },
                        },
                        records: [
                            { id: 1, unit_amount: 1 },
                        ],
                    },
                },
                views: {
                    "account.analytic.line,false,kanban": `
                        <kanban js_class="timesheet_validation_kanban">
                            <templates>
                                <t t-name="kanban-box">
                                    <div><field name="unit_amount"/></div>
                                </t>
                            </templates>
                        </kanban>
                    `,
                },
            },
            mockRPC(route, args) {
                if (args.method === "action_validate_timesheet") {
                    assert.step("action_validate_timesheet");
                    return Promise.resolve({
                        params: {
                            type: "dummy type",
                            title: "dummy title",
                        },
                    });
                }
            },
        });
        const validateButton = getVisibleButtons(target).find(btn => btn.innerText === "Validate");
        await click(validateButton);
        assert.verifySteps(["action_validate_timesheet", "notification_triggered"]);
    });

});
