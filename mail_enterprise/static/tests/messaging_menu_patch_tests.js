/* @odoo-module */

import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { afterNextRender, click, start } from "@mail/../tests/helpers/test_utils";

import { patchWithCleanup } from "@web/../tests/helpers/utils";

import { methods } from "@web_mobile/js/services/core";

QUnit.module("messaging_menu (patch)");

QUnit.test("'backbutton' event should close messaging menu", async (assert) => {
    // simulate the feature is available on the current device
    // component must and will be destroyed before the overrideBackButton is unpatched
    patchWithCleanup(methods, {
        overrideBackButton({ enabled }) {},
    });
    await start();
    await click(".o_menu_systray i[aria-label='Messages']");

    assert.containsOnce($, ".o-mail-MessagingMenu");
    await afterNextRender(() => {
        // simulate 'backbutton' event triggered by the mobile app
        const backButtonEvent = new Event("backbutton");
        document.dispatchEvent(backButtonEvent);
    });
    assert.containsNone($, ".o-mail-MessagingMenu");
});

QUnit.test(
    "[technical] messaging menu should properly override the back button",
    async (assert) => {
        // simulate the feature is available on the current device
        // component must and will be destroyed before the overrideBackButton is unpatched
        patchWithCleanup(methods, {
            overrideBackButton({ enabled }) {
                assert.step(`overrideBackButton: ${enabled}`);
            },
        });
        patchUiSize({ size: SIZES.SM });
        await start();

        await click(".o_menu_systray i[aria-label='Messages']");
        assert.verifySteps(["overrideBackButton: true"]);

        await click(".o_menu_systray i[aria-label='Messages']");
        assert.verifySteps(["overrideBackButton: false"]);
    }
);
