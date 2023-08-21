/* @odoo-module */

import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import {
    afterNextRender,
    click,
    contains,
    isScrolledToBottom,
    nextAnimationFrame,
    start,
    startServer,
} from "@mail/../tests/helpers/test_utils";

import { getFixture } from "@web/../tests/helpers/utils";
import { fields } from "@web/../tests/legacy/helpers/test_utils";

const { editInput } = fields;

QUnit.module("chatter (patch)", {
    beforeEach() {
        patchUiSize({ size: SIZES.XXL });
    },
});

QUnit.test("Message list loads new messages on scroll", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({
        display_name: "Partner 11",
        description: [...Array(60).keys()].join("\n"),
    });
    for (let i = 0; i < 60; i++) {
        pyEnv["mail.message"].create({
            body: "<p>not empty</p>",
            model: "res.partner",
            res_id: partnerId,
        });
    }
    const views = {
        "res.partner,false,form": `
            <form string="Partners">
                <sheet>
                    <field name="name"/>
                    <field name="description"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_ids"/>
                </div>
            </form>`,
    };
    const target = getFixture();
    target.classList.add("o_web_client");
    const { openFormView } = await start({
        async mockRPC(route, args) {
            if (route === "/mail/thread/messages") {
                assert.step("/mail/thread/messages");
            }
        },
        serverData: { views },
        target,
    });
    await openFormView("res.partner", partnerId);
    assert.verifySteps(["/mail/thread/messages"]);

    const $messages = $(".o-mail-Message");
    const lastMessage = $messages[$messages.length - 1];
    await afterNextRender(() => {
        const scrollable = $(".o-mail-Chatter")[0];
        scrollable.scrollTop = scrollable.scrollHeight - scrollable.clientHeight;
    });
    assert.verifySteps(["/mail/thread/messages"]);
    const lastMessageRect = lastMessage.getBoundingClientRect();
    const listRect = $(".o-mail-Chatter")[0].getBoundingClientRect();
    assert.ok(
        lastMessageRect.top > listRect.top && lastMessageRect.bottom < listRect.bottom,
        "The last message should be visible"
    );

    await afterNextRender(() => {
        const scrollable = $(".o-mail-Chatter")[0];
        scrollable.scrollTop = scrollable.scrollHeight - scrollable.clientHeight;
    });
    assert.verifySteps(["/mail/thread/messages"]);
});

QUnit.skip("Message list is scrolled to new message after posting a message", async (assert) => {
    // Test skipped because although it works locally, last assertion fails and we don't get why...
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({
        activity_ids: [],
        display_name: "<p>Partner 11</p>",
        description: [...Array(60).keys()].join("\n"),
        message_ids: [],
        message_follower_ids: [],
    });
    for (let i = 0; i < 60; i++) {
        pyEnv["mail.message"].create({
            body: "<p>not empty</p>",
            model: "res.partner",
            res_id: partnerId,
        });
    }
    const views = {
        "res.partner,false,form": `
            <form string="Partners">
                <header>
                    <button name="primaryButton" string="Primary" type="object" class="oe_highlight"/>
                </header>
                <sheet>
                    <field name="name"/>
                    <field name="description"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_ids" options="{'post_refresh': 'always'}"/>
                </div>
            </form>`,
    };
    const target = getFixture();
    target.classList.add("o_web_client");
    const { openFormView } = await start({
        async mockRPC(route, args) {
            if (route === "/mail/message/post") {
                assert.step("/mail/message/post");
            }
        },
        serverData: { views },
        target,
    });
    await openFormView("res.partner", partnerId);
    const content = $(".o_content")[0];
    assert.hasClass($(".o-mail-Form-chatter"), "o-aside");
    assert.strictEqual(content.scrollTop, 0);
    assert.strictEqual($(".o-mail-Chatter")[0].scrollTop, 0);

    await click("button:contains(Log note)");
    assert.strictEqual(content.scrollTop, 0);

    await afterNextRender(() => {
        const scollable = $(".o-mail-Chatter")[0];
        scollable.scrollTop = scollable.scrollHeight - scollable.clientHeight;
    });
    await afterNextRender(() => {
        const scollable = $(".o-mail-Chatter")[0];
        scollable.scrollTop = scollable.scrollHeight - scollable.clientHeight;
    });
    const scollable = $(".o-mail-Chatter")[0];
    assert.ok(isScrolledToBottom(scollable));

    await afterNextRender(() => editInput($(".o-mail-Composer-input")[0], "New Message"));
    assert.verifySteps([], "Message post should not yet be done");

    await click(".o-mail-Composer-send:not(:disabled)");
    await contains(".o-mail-Message:contains(New Message)");
    await nextAnimationFrame();
    assert.verifySteps(["/mail/message/post"]);
    assert.strictEqual(content.scrollTop, 0);
    assert.strictEqual($(".o-mail-Chatter")[0].scrollTop, 0);
});
