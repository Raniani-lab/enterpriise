/* @odoo-module */

import { contains } from "@mail/../tests/helpers/test_utils";

import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { click, getFixture } from "@web/../tests/helpers/utils";
import { getVisibleButtons } from "@web/../tests/search/helpers";

QUnit.module("timesheet_grid", (hooks) => {
    let target;
    hooks.beforeEach(async function () {
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.module("timesheet_validation_kanban_view");

    QUnit.test("Should trigger notification on validation", async function (assert) {
        await makeView({
            type: "kanban",
            resModel: "account.analytic.line",
            serverData: {
                models: {
                    "account.analytic.line": {
                        fields: {
                            unit_amount: { string: "Unit Amount", type: "integer" },
                        },
                        records: [{ id: 1, unit_amount: 1 }],
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
                            type: "danger",
                            title: "dummy title",
                        },
                    });
                }
            },
        });
        const validateButton = getVisibleButtons(target).find(
            (btn) => btn.innerText === "Validate"
        );
        await click(validateButton);
        await contains(".o_notification.border-danger .o_notification_content", {
            text: "dummy title",
        });
        assert.verifySteps(["action_validate_timesheet"]);
    });
});
