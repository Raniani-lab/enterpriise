/* @odoo-module */

import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { afterNextRender, click, start, startServer } from "@mail/../tests/helpers/test_utils";

import { patchWithCleanup } from "@web/../tests/helpers/utils";

import { methods } from "@web_mobile/js/services/core";

QUnit.module("chat_window (patch)");

QUnit.test("'backbutton' event should close chat window", async (assert) => {
    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {},
    });
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({
        channel_member_ids: [
            [
                0,
                0,
                {
                    is_minimized: true,
                    partner_id: pyEnv.currentPartnerId,
                },
            ],
        ],
    });
    await start();

    assert.containsOnce($, ".o-mail-ChatWindow");
    await afterNextRender(() => {
        // simulate 'backbutton' event triggered by the mobile app
        const backButtonEvent = new Event("backbutton");
        document.dispatchEvent(backButtonEvent);
    });
    assert.containsNone($, ".o-mail-ChatWindow");
});

QUnit.test("[technical] chat window should properly override the back button", async (assert) => {
    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {
            assert.step(`overrideBackButton: ${enabled}`);
        },
    });
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({ name: "test" });
    patchUiSize({ size: SIZES.SM });
    await start();

    await click(".o_menu_systray i[aria-label='Messages']");
    await click(".o-mail-NotificationItem:contains(test)");
    assert.verifySteps(["overrideBackButton: true"]);

    await click(".o-mail-ChatWindow [title*='Close']");
    // The messaging menu is re-open when a chat window is closed,
    // so we need to close it because it overrides the back button too.
    // As long as something overrides the back button, it can't be disabled.
    await click(".o_menu_systray i[aria-label='Messages']");
    assert.verifySteps(["overrideBackButton: false"]);
});
