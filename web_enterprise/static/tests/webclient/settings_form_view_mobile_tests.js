/** @odoo-module **/

import { getFixture, triggerEvent, mockTimeout, nextTick } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";

let target, serverData;

QUnit.module("Mobile SettingsFormView", (hooks) => {
    hooks.beforeEach(() => {
        serverData = {
            models: {
                project: {
                    fields: {
                        foo: { string: "Foo", type: "boolean" },
                        bar: { string: "Bar", type: "boolean" },
                    },
                },
            },
        };
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.module("BaseSettings Mobile");

    QUnit.test("swipe settings in mobile [REQUIRE TOUCHEVENT]", async function (assert) {
        const { execRegisteredTimeouts } = mockTimeout();
        await makeView({
            type: "form",
            resModel: "project",
            serverData,
            arch: `
                <form string="Settings" class="oe_form_configuration o_base_settings" js_class="base_settings">
                    <div class="o_setting_container">
                        <div class="settings">
                            <div class="app_settings_block" string="CRM" data-key="crm">
                                <div class="row mt16 o_settings_container">
                                    <div class="col-12 col-lg-6 o_setting_box">
                                        <div class="o_setting_left_pane">
                                            <field name="bar"/>
                                        </div>
                                        <div class="o_setting_right_pane">
                                            <label for="bar"/>
                                            <div class="text-muted">this is bar</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="app_settings_block" string="Project" data-key="project">
                                <div class="row mt16 o_settings_container">
                                    <div class="col-12 col-lg-6 o_setting_box">
                                        <div class="o_setting_left_pane">
                                            <field name="foo"/>
                                        </div>
                                        <div class="o_setting_right_pane">
                                            <label for="foo"/>
                                            <div class="text-muted">this is foo</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>`,
        });

        const touchTarget = target.querySelector(".settings");
        // The scrollable element is set at its right limit
        touchTarget.scrollLeft = touchTarget.scrollWidth - touchTarget.offsetWidth;
        //swipeLeft
        await triggerEvent(target, ".settings", "touchstart", {
            touches: [
                {
                    identifier: 0,
                    clientX: 0,
                    clientY: 0,
                    target: touchTarget,
                },
            ],
        });
        await triggerEvent(target, ".settings", "touchmove", {
            touches: [
                {
                    identifier: 0,
                    clientX: -touchTarget.clientWidth,
                    clientY: 0,
                    target: touchTarget,
                },
            ],
        });
        await triggerEvent(target, ".settings", "touchend", {});
        execRegisteredTimeouts();
        await nextTick();
        assert.hasAttrValue(
            target.querySelector(".selected"),
            "data-key",
            "project",
            "current setting should be project"
        );

        // The scrollable element is set at its left limit
        touchTarget.scrollLeft = 0;
        //swipeRight
        await triggerEvent(target, ".settings", "touchstart", {
            touches: [
                {
                    identifier: 0,
                    clientX: 0,
                    clientY: 0,
                    target: touchTarget,
                },
            ],
        });
        await triggerEvent(target, ".settings", "touchmove", {
            touches: [
                {
                    identifier: 0,
                    clientX: touchTarget.clientWidth,
                    clientY: 0,
                    target: touchTarget,
                },
            ],
        });
        await triggerEvent(target, ".settings", "touchend", {});
        execRegisteredTimeouts();
        await nextTick();
        assert.hasAttrValue(
            target.querySelector(".selected"),
            "data-key",
            "crm",
            "current setting should be crm"
        );
    });
});
