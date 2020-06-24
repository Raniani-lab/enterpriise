odoo.define('mail_enterprise/static/src/widgets/form_renderer/form_renderer_tests.js', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    afterNextRender,
    beforeEach: utilsBeforeEach,
    start,
} = require('mail/static/src/utils/test_utils.js');

const config = require('web.config');
const FormView = require('web.FormView');
const {
    dom: { triggerEvent },
    fields: { editInput },
} = require('web.test_utils');

QUnit.module('mail_enterprise', {}, function () {
QUnit.module('widgets', {}, function () {
QUnit.module('form_renderer', {}, function () {
QUnit.module('form_renderer_tests.js', {
    beforeEach() {
        utilsBeforeEach(this);
        // FIXME archs could be removed once task-2248306 is done
        // The mockServer will try to get the list view
        // of every relational fields present in the main view.
        // In the case of mail fields, we don't really need them,
        // but they still need to be defined.
        this.createView = async (viewParams, ...args) => {
            await afterNextRender(async () => {
                const viewArgs = Object.assign({
                    archs: {
                        'mail.activity,false,list': '<tree/>',
                        'mail.followers,false,list': '<tree/>',
                        'mail.message,false,list': '<tree/>',
                    }},
                    viewParams,
                );
                const { widget } = await start(viewArgs, ...args);
                this.widget = widget;
            });
        };
    },
    afterEach() {
        if (this.widget) {
            this.widget.destroy();
        }
        utilsAfterEach(this);
    },
});

QUnit.test('Message list loads new messages on scroll', async function (assert) {
    assert.expect(8);

    this.data['res.partner'].records = [{
        activity_ids: [],
        id: 1,
        display_name: "Partner 1",
        description: [...Array(60).keys()].join('\n'),
        message_ids: [],
        message_follower_ids: [],
    }];

    const messages = [...Array(60).keys()].map(id => {
        return {
            author_id: [10, "Demo User"],
            body: `<p>Message ${id + 1}</p>`,
            date: "2019-04-20 10:00:00",
            id: id + 1,
            message_type: 'comment',
            model: 'res.partner',
            record_name: 'Partner 1',
            res_id: 1,
        };
    });
    this.data['mail.message'].records = messages;

    await this.createView({
        data: this.data,
        hasView: true,
        // View params
        View: FormView,
        model: 'res.partner',
        arch: `
            <form string="Partners">
                <sheet>
                    <field name="name"/>
                    <field name="description"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_ids" />
                </div>
            </form>
        `,
        viewOptions: {
            currentId: 1,
        },
        config: {
            device: { size_class: config.device.SIZES.XXL },
        },
        env: {
            device: { size_class: config.device.SIZES.XXL },
        },
        async mockRPC(route, args) {
            if (args.method === 'message_fetch') {
                assert.step('message_fetch');
            }
            return this._super.call(this, ...arguments);
        }
    });
    assert.verifySteps(
        ['message_fetch'],
        'Initial message fetch should be done'
    );

    const allMessages = document.querySelectorAll('.o_MessageList_message');
    const lastMessage = allMessages[allMessages.length - 1];

    const messageList = document.querySelector('.o_ThreadViewer_messageList');
    await afterNextRender(async () => {
        // This will trigger the DOM Event "scroll"
        messageList.scrollTop = messageList.scrollHeight - messageList.offsetHeight;
    });
    const lastMessageRect = lastMessage.getBoundingClientRect();
    const listRect = messageList.getBoundingClientRect();
    assert.ok(
        lastMessageRect.top > listRect.top && lastMessageRect.bottom < listRect.bottom,
        "The last message should be visible"
    );
    assert.verifySteps(
        ['message_fetch'],
        'The message_fetch to load new messages should be done when scrolling to the bottom'
    );

    await afterNextRender(async () => {
        // This will trigger the DOM Event "scroll"
        messageList.scrollTop = messageList.scrollHeight - messageList.offsetHeight;
    });
    assert.verifySteps(
        ['message_fetch'],
        'The message_fetch to load new messages should be done when scrolling to the bottom'
    );
    assert.strictEqual(
        messageList.scrollTop,
        messageList.scrollHeight - messageList.offsetHeight,
        "The message list should be scrolled to its bottom"
    );
});

QUnit.test('Message list scroll position is kept when switching record', async function (assert) {
    assert.expect(10);

    this.data['res.partner'].records = [{
        activity_ids: [],
        id: 1,
        display_name: "Partner 1",
        description: [...Array(60).keys()].join('\n'),
        message_ids: [],
        message_follower_ids: [],
    }, {
        activity_ids: [],
        id: 2,
        display_name: "Partner 2",
        message_ids: [],
        message_follower_ids: [],
    }];

    const messages = [...Array(60).keys()].map(id => {
        return {
            author_id: [10, "Demo User"],
            body: `<p>Message ${id + 1}</p>`,
            date: "2019-04-20 10:00:00",
            id: id + 1,
            message_type: 'comment',
            model: 'res.partner',
            record_name: `Partner ${id % 2 ? 1 : 2}`,
            res_id: id % 2 ? 1 : 2,
        };
    });
    this.data['mail.message'].records = messages;

    await this.createView({
        data: this.data,
        hasView: true,
        // View params
        View: FormView,
        model: 'res.partner',
        arch: `
            <form string="Partners">
                <sheet>
                    <field name="name"/>
                    <field name="description"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_ids"/>
                </div>
            </form>
        `,
        viewOptions: {
            currentId: 1,
            ids: [1, 2],
        },
        config: {
            device: { size_class: config.device.SIZES.XXL },
        },
        env: {
            device: { size_class: config.device.SIZES.XXL },
        },
    });

    const formViewEl = document.querySelector('.o_form_view');
    const controllerContentEl = document.querySelector('.o_content');

    assert.hasClass(document.querySelector('.o_FormRenderer_chatterContainer'), 'o-aside',
        "chatter should be aside"
    );
    assert.strictEqual(
        document.querySelector('.breadcrumb-item.active').textContent,
        'Partner 1',
        "Form view should display partner 'Partner 1'"
    );
    assert.strictEqual(controllerContentEl.scrollTop, 0,
        "The controller container should not be scrolled"
    );
    assert.strictEqual(document.querySelector('.o_ThreadViewer_messageList').scrollTop, 0,
        "The top of the message list should be visible"
    );

    const messageList = document.querySelector('.o_ThreadViewer_messageList');
    await afterNextRender(async () => {
        messageList.scrollTop = messageList.scrollHeight - messageList.offsetHeight;
    });
    assert.strictEqual(
        messageList.scrollTop,
        messageList.scrollHeight - messageList.offsetHeight,
        "The message list should be scrolled to its bottom"
    );
    const messageListScrollTopBeforeSwitch = messageList.scrollTop;

    await afterNextRender(() =>
        document.querySelector('.o_pager_next').click()
    );
    assert.strictEqual(
        document.querySelector('.breadcrumb-item.active').textContent,
        'Partner 2',
        "Form view should display partner 'Partner 2'"
    );
    assert.strictEqual(document.querySelector('.o_ThreadViewer_messageList').scrollTop, 0,
        "The message list scroll should have been reset after changing record with the pager"
    );
    assert.strictEqual(controllerContentEl.scrollTop, 0,
        "The controller container should not be scrolled"
    );

    await afterNextRender(() =>
        document.querySelector('.o_pager_previous').click()
    );
    const messageListScrollTop = document.querySelector('.o_ThreadViewer_messageList').scrollTop;
    assert.ok(messageListScrollTop >= messageListScrollTopBeforeSwitch - 50,
        "The record's scroll position should have been more or less restored, within a margin"
    );
    assert.strictEqual(controllerContentEl.scrollTop, 0,
        "The controller container should not be scrolled"
    );
});

QUnit.test('Message list is scrolled to new message after posting a message', async function (assert) {
    assert.expect(10);

    this.data['res.partner'].records = [{
        activity_ids: [],
        id: 1,
        display_name: "Partner 1",
        description: [...Array(60).keys()].join('\n'),
        message_ids: [],
        message_follower_ids: [],
    }];

    const messages = [...Array(60).keys()].map(id => {
        return {
            author_id: [10, "Demo User"],
            body: `<p>Message ${id + 1}</p>`,
            date: "2019-04-20 10:00:00",
            id: id + 1,
            message_type: 'comment',
            model: 'res.partner',
            record_name: 'Partner 1',
            res_id: 1,
        };
    });
    this.data['mail.message'].records = messages;

    await this.createView({
        data: this.data,
        hasView: true,
        // View params
        View: FormView,
        model: 'res.partner',
        arch: `
            <form string="Partners">
                <header>
                    <button name="primaryButton" string="Primary" type="object" class="oe_highlight" />
                </header>
                <sheet>
                    <field name="name"/>
                    <field name="description"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_ids" options="{'post_refresh': 'always'}"/>
                </div>
            </form>
        `,
        viewOptions: {
            currentId: 1,
        },
        config: {
            device: { size_class: config.device.SIZES.XXL },
        },
        env: {
            device: { size_class: config.device.SIZES.XXL },
        },
        async mockRPC(route, args) {
            if (args.method === 'message_post') {
                assert.step('message_post');
            }
            return this._super.call(this, ...arguments);
        }
    });
    const controllerContentEl = document.querySelector('.o_content');
    const formViewEl = document.querySelector('.o_form_view');

    assert.hasClass(document.querySelector('.o_FormRenderer_chatterContainer'), 'o-aside',
        "chatter should be aside"
    );
    assert.strictEqual(controllerContentEl.scrollTop, 0,
        "The controller container should not be scrolled"
    );
    assert.strictEqual(document.querySelector('.o_ThreadViewer_messageList').scrollTop, 0,
        "The top of the message list is visible"
    );

    await afterNextRender(() =>
        document.querySelector('.o_ChatterTopbar_buttonLogNote').click()
    );
    assert.strictEqual(controllerContentEl.scrollTop, 0,
        "The controller container should not be scrolled"
    );

    const messageList = document.querySelector('.o_ThreadViewer_messageList');
    await afterNextRender(async () => {
        // This will trigger the DOM Event "scroll"
        messageList.scrollTop = messageList.scrollHeight - messageList.offsetHeight;
    });
    await afterNextRender(async () => {
        // Trigger a second time to get to the bottom, the first time
        // extended the list with new messages
        messageList.scrollTop = messageList.scrollHeight - messageList.offsetHeight;
    });
    assert.strictEqual(
        messageList.scrollTop,
        messageList.scrollHeight - messageList.offsetHeight,
        "The message list should be scrolled to its bottom"
    );

    await afterNextRender(() =>
        editInput(
            document.querySelector('.o_ComposerTextInput_textarea'),
            "New Message"
        )
    );
    assert.verifySteps([], "Message post should not yet be done");

    await afterNextRender(() =>
        document.querySelector('.o_Composer_buttonSend').click()
    );
    assert.verifySteps(['message_post'], "Message post should be done");
    assert.strictEqual(controllerContentEl.scrollTop, 0,
        "The controller container should not be scrolled after sending a message"
    );
    assert.strictEqual(document.querySelector('.o_ThreadViewer_messageList').scrollTop, 0,
        "The top of the message list should be visible after sending a message"
    );
});
});
});
});

});
