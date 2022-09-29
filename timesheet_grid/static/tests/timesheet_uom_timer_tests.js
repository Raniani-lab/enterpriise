/** @odoo-module **/

import { registry } from "@web/core/registry";

import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { click, getFixture } from '@web/../tests/helpers/utils';
import { timerService } from '@timer/services/timer_service';


QUnit.module("timesheet_grid", {}, function () {
    let serverData;
    let target;
    QUnit.module("components");
    QUnit.module("timesheet_uom_hour_timer", {
        async beforeEach() {
            serverData = {
                models: {
                    'account.analytic.line': {
                        fields: {
                            unit_amount: { string: "Unit Amount", type: "integer" },
                            duration_unit_amount: { string: "Duration Unit Amount", type: "float" },
                            display_timer: { string: "Display Timer", type: "boolean" },
                            is_timer_running: { string: "Is Timer Running", type: "boolean" },
                            timer_start: { string: "Is Timer Started", type: "boolean" },
                            timer_pause: { string: "Is Timer Paused", type: "boolean" },
                        },
                        records: [
                            {
                                id: 1,
                                unit_amount: 1,
                                duration_unit_amount: 1,
                                display_timer: true,
                                is_timer_running: false,
                                timer_start: false,
                                timer_pause: false,
                            },
                        ],
                    },
                },
                views: {
                    "account.analytic.line,false,list": `
                        <tree editable="bottom">
                            <field name="unit_amount" widget="timesheet_uom_hour_timer"/>
                        </tree>
                    `,
                },
            };
            setupViewRegistries();
            registry.category("services").add("timer", timerService);
            target = getFixture();
        }
    }, function () {
        QUnit.debug("button is not displayed on edit", async (assert) => {
            await makeView({
                type: "list",
                resModel: "account.analytic.line",
                serverData,
            });
            assert.containsOnce(target, 'div[name="unit_amount"] > button', "button is displayed when view is in readonly");
            await click(target, 'div[name="unit_amount"]');
            assert.containsNone(target, 'div[name="unit_amount"] > button', "button is not displayed when view is in edit mode");
        });
    });
});
