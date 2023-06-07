/* @odoo-module */

import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { afterNextRender, start, startServer } from "@mail/../tests/helpers/test_utils";

import { nextTick } from "@web/../tests/helpers/utils";

QUnit.module("thread (patch)");

QUnit.test("message list desc order", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "partner 1" });
    for (let i = 0; i <= 60; i++) {
        pyEnv["mail.message"].create({
            body: "not empty",
            model: "res.partner",
            res_id: partnerId,
        });
    }
    patchUiSize({ size: SIZES.XXL });
    const { openFormView } = await start();
    await openFormView("res.partner", partnerId);
    assert.notOk(
        $(".o-mail-Message").prevAll("button:contains(Load More)")[0],
        "load more link should NOT be before messages"
    );
    assert.notOk(
        $("button:contains(Load More)").nextAll(".o-mail-Message")[0],
        "load more link should be after messages"
    );
    assert.containsN($, ".o-mail-Message", 30);

    // scroll to bottom
    await afterNextRender(() => {
        const scrollable = $(".o-mail-Chatter")[0];
        scrollable.scrollTop = scrollable.scrollHeight - scrollable.clientHeight;
    });
    assert.containsN($, ".o-mail-Message", 60);

    $(".o-mail-Chatter")[0].scrollTop = 0;
    await nextTick();
    assert.containsN(
        $,
        ".o-mail-Message",
        60,
        "scrolling to top should not trigger any message fetching"
    );
});
