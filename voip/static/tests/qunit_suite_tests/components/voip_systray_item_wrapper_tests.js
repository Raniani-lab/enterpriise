/** @odoo-module **/

import { afterNextRender, start } from "@mail/../tests/helpers/test_utils";
import { makeDeferred } from "@mail/utils/deferred";
import { VoipSystrayItemWrapper } from "@voip/components/voip_systray_item_wrapper/voip_systray_item_wrapper";
import { registry } from "@web/core/registry";

QUnit.module("voip", {}, function () {
QUnit.module("components", {}, function () {
QUnit.module("voip_systray_item_wrapper_tests.js");

QUnit.test("A spinner is displayed instead of VoipSystrayItemView until Messaging is created.", async function (assert) {
    assert.expect(2);

    registry.category("systray").add("voip", { Component: VoipSystrayItemWrapper });
    const messagingBeforeCreationDeferred = makeDeferred();
    await start({
        messagingBeforeCreationDeferred,
        waitUntilMessagingCondition: "none",
    });
    assert.containsOnce(
        document.body,
        ".o_VoipSystrayItemWrapper_spinner",
        "VoipSystrayItemWrapper should display a spinner as long as Messaging is not created."
    );

    // simulate messaging creation
    await afterNextRender(() => messagingBeforeCreationDeferred.resolve());
    assert.containsOnce(
        document.body,
        ".o_VoipSystrayItemView",
        "VoipSystrayItemView should appear as soon as Messaging has been created."
    );
});
});
});
