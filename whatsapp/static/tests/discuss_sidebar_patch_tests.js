/* @odoo-module */

import { Command } from "@mail/../tests/helpers/command";
import {
    click,
    contains,
    insertText,
    start,
    startServer,
} from "@mail/../tests/helpers/test_utils";

QUnit.module("discuss sidebar (patch)");

QUnit.test("Join whatsapp channels from add channel button", async (assert) => {
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create([
        {
            name: "WhatsApp 1",
            channel_type: "whatsapp",
        },
        {
            name: "WhatsApp 2",
            channel_type: "whatsapp",
            channel_member_ids: [
                Command.create({ is_pinned: false, partner_id: pyEnv.currentPartnerId }),
            ],
        },
    ]);
    const { openDiscuss } = await start();
    await openDiscuss();
    await click(".o-mail-DiscussSidebarCategory-whatsapp .o-mail-DiscussSidebarCategory-add");
    await insertText(".o-discuss-ChannelSelector input", "WhatsApp 2");
    await click(".o-mail-ChannelSelector-suggestion:contains(WhatsApp 2)");
    await contains(".o-mail-DiscussSidebarChannel:contains(WhatsApp 2)");
});

QUnit.test(
    "Clicking on cross icon in whatsapp sidebar category item unpins the channel",
    async (assert) => {
        const pyEnv = await startServer();
        const channelId = pyEnv["discuss.channel"].create({
            name: "WhatsApp 1",
            channel_type: "whatsapp",
        });
        const { openDiscuss } = await start();
        await openDiscuss();
        assert.containsOnce(
            $,
            ".o-mail-DiscussSidebarChannel:contains(WhatsApp 1) .o-mail-ThreadIcon .fa-whatsapp"
        );
        await click(
            ".o-mail-DiscussSidebarChannel:contains(WhatsApp 1) div[title='Unpin Conversation']"
        );
        const [channel] = pyEnv["discuss.channel"].searchRead([["id", "=", channelId]]);
        const [member] = pyEnv["discuss.channel.member"].searchRead([
            ["channel_id", "=", channel.id],
            ["partner_id", "=", pyEnv.currentPartnerId],
        ]);
        await contains(".o-mail-DiscussSidebarChannel:contains(WhatsApp 1)", {count: 0});
        assert.ok(channel.channel_member_ids.includes(member.id));
        assert.ok(!member.is_pinned);
    }
);

QUnit.test("Message unread counter in whatsapp channels", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
        channel_member_ids: [
            Command.create({ message_unread_counter: 1, partner_id: pyEnv.currentPartnerId }),
        ],
    });
    const { openDiscuss } = await start();
    await openDiscuss(channelId);
    assert.containsOnce($, ".o-mail-DiscussSidebarChannel:contains(WhatsApp 1) .badge:contains(1)");
});
