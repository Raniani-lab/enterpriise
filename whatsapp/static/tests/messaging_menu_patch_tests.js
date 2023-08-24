/* @odoo-module */

import { Command } from "@mail/../tests/helpers/command";
import { click, contains, start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("messaging menu (patch)");

QUnit.test("WhatsApp Channel notification items should have thread icon", async (assert) => {
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
    });
    await start();
    await click(".o_menu_systray i[aria-label='Messages']");
    await contains(".o-mail-NotificationItem .o-mail-ThreadIcon");
});

QUnit.test("Notification items should have unread counter for unread messages", async (assert) => {
    const pyEnv = await startServer();
    pyEnv["discuss.channel"].create({
        name: "WhatsApp 1",
        channel_type: "whatsapp",
        channel_member_ids: [
            Command.create({ message_unread_counter: 1, partner_id: pyEnv.currentPartnerId }),
        ],
    });
    await start();
    await click(".o_menu_systray i[aria-label='Messages']");
    assert.strictEqual($(".o-mail-MessagingMenu-counter").text(), "1");
});
