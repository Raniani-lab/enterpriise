/* @odoo-module */

import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { click, contains, start } from "@mail/../tests/helpers/test_utils";

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

    await contains(".o-mail-MessagingMenu");
    // simulate 'backbutton' event triggered by the mobile app
    const backButtonEvent = new Event("backbutton");
    document.dispatchEvent(backButtonEvent);
    await contains(".o-mail-MessagingMenu", 0);
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
        await contains(".o-mail-MessagingMenu");
        assert.verifySteps(["overrideBackButton: true"]);

        await click(".o_menu_systray i[aria-label='Messages']");
        await contains(".o-mail-MessagingMenu", 0);
        assert.verifySteps(["overrideBackButton: false"]);
    }
);
