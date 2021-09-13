/** @odoo-module **/

import { insert, link } from '@mail/model/model_field_command';
import {
    afterEach,
    afterNextRender,
    beforeEach,
    createRootMessagingComponent,
    start,
} from '@mail/utils/test_utils';

QUnit.module('website_helpdesk_livechat', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('thread_view', {}, function () {
QUnit.module('thread_view_tests.js', {
    beforeEach() {
        beforeEach(this);

        /**
         * @param {mail.thread_view} threadView
         * @param {Object} [otherProps={}]
         */
        this.createThreadViewComponent = async (threadView, otherProps = {}) => {
            const props = Object.assign({ threadViewLocalId: threadView.localId }, otherProps);
            await createRootMessagingComponent(this, "ThreadView", { props, target: this.widget.el });
        };

        this.start = async params => {
            const { afterEvent, env, widget } = await start(Object.assign({}, params, {
                data: this.data,
            }));
            this.afterEvent = afterEvent;
            this.env = env;
            this.widget = widget;
        };
    },
    afterEach() {
        afterEach(this);
    },
});

QUnit.test('[technical] /helpdesk command gets a body as kwarg', async function (assert) {
    assert.expect(2);

    this.data['mail.channel'].records = [{
        channel_type: 'channel',
        id: 20,
        is_pinned: true,
        message_unread_counter: 0,
        seen_message_id: 10,
        name: "General",
    }];
    await this.start({
        mockRPC(route, { model, method, kwargs }) {
            if (model === 'mail.channel' && method === 'execute_command_helpdesk') {
                assert.step(`execute command helpdesk. body: ${kwargs.body}`);
                return Promise.resolve();
            }
            return this._super(...arguments);
        }
    });
    const thread = this.messaging.models['mail.thread'].findFromIdentifyingData({
        id: 20,
        model: 'mail.channel'
    });
    const threadViewer = this.messaging.models['mail.thread_viewer'].create({
        hasThreadView: true,
        thread: link(thread),
    });
    await this.createThreadViewComponent(threadViewer.threadView, { hasComposer: true });

    document.querySelector('.o_ComposerTextInput_textarea').focus();
    await afterNextRender(() => document.execCommand('insertText', false, "/helpdesk something"));
    await afterNextRender(() => document.querySelector('.o_Composer_buttonSend').click());
    assert.verifySteps([
        'execute command helpdesk. body: /helpdesk something',
    ]);
});

});
});
});
