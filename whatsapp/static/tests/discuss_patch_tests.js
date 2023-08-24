/* @odoo-module */

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("discuss (patch)");

QUnit.test("Basic topbar rendering for whatsapp channels", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
    });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    assert.containsOnce($, ".o-mail-Discuss-header .o-mail-ThreadIcon .fa-whatsapp");
    assert.strictEqual($(".o-mail-Discuss-threadName").val(), "WhatsApp 1");
    assert.ok($(".o-mail-Discuss-threadName")[0].disabled);
    assert.containsOnce($, ".o-mail-Discuss-header button[title='Add Users']");
    assert.containsNone($, ".o-mail-Discuss-header button[name='call']");
    assert.containsNone($, ".o-mail-Discuss-header button[name='settings']");
});

QUnit.test("Invite users into whatsapp channel", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
    });
    const partnerId = pyEnv["res.partner"].create({ name: "WhatsApp User" });
    pyEnv["res.users"].create({ partner_id: partnerId });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    await click(".o-mail-Discuss-header button[title='Add Users']");
    await click(".o-discuss-ChannelInvitation-selectable");
    await click("button[title='Invite']:not([disabled])");
    const [channelMemberId] = pyEnv["discuss.channel.member"].search([
        ["channel_id", "=", channelId],
        ["partner_id", "=", partnerId],
    ]);
    const [channel] = pyEnv["discuss.channel"].searchRead([["id", "=", channelId]]);
    assert.ok(channel.channel_member_ids.includes(channelMemberId));
});
