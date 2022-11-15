/** @odoo-module **/

import { click, insertText, start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("thread (patch)");

QUnit.test("[technical] /helpdesk command gets a body as kwarg", async (assert) => {
    const pyEnv = await startServer();
    const channelId = pyEnv["mail.channel"].create({
        channel_type: "channel",
        name: "General",
    });
    const messageId = pyEnv["mail.message"].create({
        model: "mail.channel",
        res_id: channelId,
    });
    const [channelMemberId] = pyEnv["mail.channel.member"].search([
        ["channel_id", "=", channelId],
        ["partner_id", "=", pyEnv.currentPartnerId],
    ]);
    pyEnv["mail.channel.member"].write([channelMemberId], {
        seen_message_id: messageId,
    });
    const { openDiscuss } = await start({
        mockRPC(route, { model, method, kwargs }) {
            if (model === "mail.channel" && method === "execute_command_helpdesk") {
                assert.step(`execute command helpdesk. body: ${kwargs.body}`);
                // random value returned in order for the mock server to know that this route is implemented.
                return true;
            }
        },
    });
    await openDiscuss(channelId);
    await insertText(".o-mail-Composer-input", "/helpdesk something");
    await click(".o-mail-Composer-send");
    assert.verifySteps(["execute command helpdesk. body: /helpdesk something"]);
});
