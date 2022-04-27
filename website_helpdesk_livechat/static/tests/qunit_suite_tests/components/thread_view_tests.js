/** @odoo-module **/

import { insertAndReplace, replace } from '@mail/model/model_field_command';
import {
    afterNextRender,
    start,
    startServer,
} from '@mail/../tests/helpers/test_utils';

QUnit.module('website_helpdesk_livechat', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('thread_view_tests.js');

QUnit.test('[technical] /helpdesk command gets a body as kwarg', async function (assert) {
    assert.expect(2);

    const pyEnv = await startServer();
    const mailChannelId1 = pyEnv['mail.channel'].create({
        channel_type: 'channel',
        name: "General",
    });
    const mailMessageId1 = pyEnv['mail.message'].create({
        model: 'mail.channel',
        res_id: mailChannelId1,
    });
    const [mailChannelPartnerId] = pyEnv['mail.channel.partner'].search([['channel_id', '=', mailChannelId1], ['partner_id', '=', pyEnv.currentPartnerId]]);
    pyEnv['mail.channel.partner'].write([mailChannelPartnerId], { seen_message_id: mailMessageId1 });
    const { createThreadViewComponent, messaging } = await start({
        mockRPC(route, { model, method, kwargs }) {
            if (model === 'mail.channel' && method === 'execute_command_helpdesk') {
                assert.step(`execute command helpdesk. body: ${kwargs.body}`);
                return Promise.resolve();
            }
            return this._super(...arguments);
        },
    });
    const thread = messaging.models['Thread'].findFromIdentifyingData({
        id: mailChannelId1,
        model: 'mail.channel'
    });
    const threadViewer = messaging.models['ThreadViewer'].create({
        hasThreadView: true,
        qunitTest: insertAndReplace(),
        thread: replace(thread),
    });
    await createThreadViewComponent(threadViewer.threadView);

    document.querySelector('.o_ComposerTextInput_textarea').focus();
    await afterNextRender(() => document.execCommand('insertText', false, "/helpdesk something"));
    await afterNextRender(() => document.querySelector('.o_Composer_buttonSend').click());
    assert.verifySteps([
        'execute command helpdesk. body: /helpdesk something',
    ]);
});

});
});
