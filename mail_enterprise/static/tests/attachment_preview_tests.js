odoo.define('mail_enterprise.attachment_side_preview_tests', function (require) {
"use strict";

const {
    afterNextRender,
    start,
} = require('mail/static/src/utils/test_utils.js');

var config = require('web.config');
var FormView = require('web.FormView');
var testUtils = require('web.test_utils');

QUnit.module('MailAttachmentOnSide', {

    beforeEach: function () {
        this.data = {
            // FIXME could be removed once task-2248306 is done
            'mail.message': {fields: {}},
            partner: {
                fields: {
                    message_attachment_count: {string: 'Attachment count', type: 'integer'},
                    display_name: { string: "Displayed name", type: "char" },
                    foo: {string: "Foo", type: "char", default: "My little Foo Value"},
                    message_ids: {
                        string: "messages",
                        type: "one2many",
                        relation: 'mail.message',
                        relation_field: "res_id",
                    },
                },
                records: [{
                    id: 2,
                    message_attachment_count: 0,
                    display_name: "first partner",
                    foo: "HELLO",
                    message_ids: [],
                }]
            },
            'ir.attachment': {
                fields: {},
                records: [],
            },
        };
    },
}, function () {

    QUnit.test('Attachment on side', async function (assert) {
        assert.expect(9);

        var count = 0;
        this.data.partner.records[0].message_ids = [1];
        var messages = [{
            attachment_ids: [{
                filename: 'image1.jpg',
                id: 1,
                mimetype: 'image/jpeg',
                name: 'Test Image 1',
                res_id: 2,
                res_model: 'partner',
                url: '/web/content/1?download=true',
            }],
            author_id: ["1", "Kamlesh Sulochan"],
            body: "Attachment viewer test",
            date: "2016-12-20 09:35:40",
            displayed_author: "Kamlesh Sulochan",
            id: 1,
            is_note: false,
            is_discussion: true,
            is_starred: false,
            model: 'partner',
            res_id: 2,
        }];

        let form;
        await afterNextRender(async () => {
            const { widget } = await start({
                hasView: true,
                View: FormView,
                model: 'partner',
                data: this.data,
                arch: '<form string="Partners">' +
                        '<sheet>' +
                            '<field name="foo"/>' +
                        '</sheet>' +
                        '<div class="o_attachment_preview" options="{\'order\':\'desc\'}"></div>' +
                        '<div class="oe_chatter">' +
                            '<field name="message_ids"/>' +
                        '</div>' +
                    '</form>',
                // FIXME could be removed once task-2248306 is done
                archs: {
                    'mail.message,false,list': '<tree/>',
                },
                res_id: 2,
                config: {
                    device: {
                        size_class: config.device.SIZES.XXL,
                    },
                },
                mockRPC: function (route, args) {
                    if (args.method === 'search_read') {
                        if (count === 0) {
                            return Promise.resolve([messages[0].attachment_ids[0]]);
                        }
                        else {
                            return Promise.resolve([messages[0].attachment_ids[0],
                                                    messages[1].attachment_ids[0]]);
                        }
                    }
                    if (args.method === 'message_format') {
                        var requestedMessages = _.filter(messages, function (message) {
                            return _.contains(args.args[0], message.id);
                        });
                        return Promise.resolve(requestedMessages);
                    }
                    if (route === '/mail/get_suggested_recipients') {
                        return Promise.resolve({2: []});
                    }
                    if (_.str.contains(route, '/web/static/lib/pdfjs/web/viewer.html')){
                        var canvas = document.createElement('canvas');
                        return Promise.resolve(canvas.toDataURL());
                    }
                    if (args.method === 'message_fetch') {
                        return Promise.resolve(messages);
                    }
                    if (args.method === 'message_post') {
                        messages.push({
                            attachment_ids: [{
                                filename: 'invoice.pdf',
                                id: 2,
                                mimetype: 'application/pdf',
                                name: 'INV007/2018',
                                res_id: 2,
                                res_model: 'partner',
                                url: '/web/content/1?download=true',
                            }],
                            author_id: ["5", "Bhallaldeva"],
                            body: args.kwargs.body,
                            date: "2016-12-20 10:35:40",
                            displayed_author: "Bhallaldeva",
                            id: 5,
                            is_note: false,
                            is_discussion: true,
                            is_starred: false,
                            model: 'partner',
                            res_id: 2,
                        });
                        return Promise.resolve(5);
                    }
                    if (args.method === 'register_as_main_attachment') {
                        return Promise.resolve(true);
                    }
                    return this._super.apply(this, arguments);
                },
            });
            form = widget;
        });

        assert.containsOnce(form, '.o_attachment_preview_img > img',
            "There should be an image for attachment preview");
        assert.containsOnce(form, '.o_form_sheet_bg > .o_FormRenderer_chatterContainer',
            "Chatter should moved inside sheet");
        assert.containsOnce(form, '.o_form_sheet_bg + .o_attachment_preview',
            "Attachment preview should be next sibling to .o_form_sheet_bg");

        // Don't display arrow if there is no previous/next element
        assert.containsNone(form, '.arrow',
            "Don't display arrow if there is no previous/next attachment");

        // send a message with attached PDF file
        await afterNextRender(() =>
            document.querySelector('.o_ChatterTopbar_buttonSendMessage').click()
        );
        await afterNextRender(() => {
            document.querySelector('.o_ComposerTextInput_textarea').focus();
            document.execCommand('insertText', false, "Attached the pdf file");
        });
        await afterNextRender(() =>
            document.querySelector('.o_Composer_buttonSend').click()
        );

        assert.containsN(form, '.arrow', 2,
            "Display arrows if there multiple attachments");
        assert.containsNone(form, '.o_attachment_preview_img > img',
            "Preview image should be removed");
        assert.containsOnce(form, '.o_attachment_preview_container > iframe',
            "There should be iframe for pdf viewer");
        await testUtils.dom.click(form.$('.o_move_next'), {allowInvisible:true});
        assert.containsOnce(form, '.o_attachment_preview_img > img',
            "Display next attachment");
        await testUtils.dom.click(form.$('.o_move_previous'), {allowInvisible:true});
        assert.containsOnce(form, '.o_attachment_preview_container > iframe',
            "Display preview attachment");
        form.destroy();
    });

    QUnit.test('Attachment on side on new record', async function (assert) {
        assert.expect(3);

        const { widget: form } = await start({
            hasView: true,
            View: FormView,
            model: 'partner',
            data: this.data,
            arch: '<form string="Partners">' +
                    '<sheet>' +
                        '<field name="foo"/>' +
                    '</sheet>' +
                    '<div class="o_attachment_preview" options="{\'order\':\'desc\'}"></div>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
            // FIXME could be removed once task-2248306 is done
            archs: {
                'mail.message,false,list': '<tree/>',
            },
            config: {
                device: {
                    size_class: config.device.SIZES.XXL,
                },
            },
        });

        assert.containsOnce(form, '.o_form_sheet_bg .o_attachment_preview',
            "the preview should not be displayed");
        assert.strictEqual(form.$('.o_form_sheet_bg .o_attachment_preview').children().length, 0,
            "the preview should be empty");
        assert.containsOnce(form, '.o_form_sheet_bg + .o_FormRenderer_chatterContainer',
            "chatter should not have been moved");

        form.destroy();
    });

    QUnit.test('Attachment on side not displayed on smaller screens', async function (assert) {
        assert.expect(2);

        this.data.partner.records[0].message_ids = [1];
        var messages = [{
            attachment_ids: [{
                filename: 'image1.jpg',
                id:1,
                mimetype: 'image/jpeg',
                name: 'Test Image 1',
                res_id: 2,
                res_model: 'partner',
                url: '/web/content/1?download=true',
            }],
            author_id: ["1", "Kamlesh Sulochan"],
            body: "Attachment viewer test",
            date: "2016-12-20 09:35:40",
            displayed_author: "Kamlesh Sulochan",
            id: 1,
            is_note: false,
            is_discussion: true,
            is_starred: false,
            model: 'partner',
            res_id: 2,
        }];

        const { widget: form } = await start({
            hasView: true,
            View: FormView,
            model: 'partner',
            data: this.data,
            arch: '<form string="Partners">' +
                    '<sheet>' +
                        '<field name="foo"/>' +
                    '</sheet>' +
                    '<div class="o_attachment_preview" options="{\'order\':\'desc\'}"></div>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
            // FIXME could be removed once task-2248306 is done
            archs: {
                'mail.message,false,list': '<tree/>',
            },
            res_id: 2,
            config: {
                device: {
                    size_class: config.device.SIZES.XL,
                },
            },
            mockRPC: function (route, args) {
                if (args.method === 'message_format') {
                    var requestedMessages = _.filter(messages, function (message) {
                        return _.contains(args.args[0], message.id);
                    });
                    return Promise.resolve(requestedMessages);
                }
                if (args.method === 'message_fetch') {
                    return Promise.resolve(messages);
                }
                return this._super.apply(this, arguments);
            },
        });
        assert.strictEqual(form.$('.o_attachment_preview').children().length, 0,
            "there should be nothing previewed");
        assert.containsOnce(form, '.o_form_sheet_bg + .o_FormRenderer_chatterContainer',
            "chatter should not have been moved");

        form.destroy();
    });

    QUnit.test('Attachment triggers list resize', async function (assert) {
        assert.expect(3);

        this.data.partner.fields.yeses = { relation: 'yes', string: "Yeses", type: 'many2many' };
        this.data.partner.records[0].yeses = [-1720932];
        this.data.yes = {
            fields: { the_char: { string: "The Char", type: 'char' } },
            records: [{ id: -1720932, the_char: new Array(100).fill().map(_ => "yes").join() }],
        };

        const attachmentLoaded = testUtils.makeTestPromise();
        const { widget: form } = await start({
            hasView: true,
            arch: `
                <form string="Whatever">
                    <sheet>
                        <field name="yeses"/>
                    </sheet>
                    <div class="o_attachment_preview" options="{ 'order': 'desc' }"/>
                    <div class="oe_chatter">
                        <field name="message_ids"/>
                    </div>
                </form>`,
            archs: {
                // FIXME could be removed once task-2248306 is done
                'mail.message,false,list': '<tree/>',
                'yes,false,list': `
                    <tree>
                        <field name="the_char"/>
                    </tree>`,
            },
            // Simulates a server delay before each action
            async mockRPC(route, { method }) {
                if (route === '/web/image/1?unique=1') {
                    await testUtils.nextTick();
                    attachmentLoaded.resolve();
                }
                switch (method) {
                    case 'register_as_main_attachment':
                        await testUtils.nextTick();
                        return true;
                    case 'search_read':
                        await testUtils.nextTick();
                        return [{
                            filename: 'image1.jpg',
                            id:1,
                            mimetype: 'image/jpeg',
                            name: 'Test Image 1',
                            res_id: 2,
                            res_model: 'partner',
                            url: '/web/content/1?download=true',
                        }];
                }
                return this._super(...arguments);
            },
            config: {
                device: { size_class: config.device.SIZES.XXL },
            },
            data: this.data,
            model: 'partner',
            res_id: 2,
            View: FormView,
        });

        // Sets an arbitrary width to check if it is correctly overriden.
        form.el.querySelector('table th').style.width = '0px';

        assert.containsNone(form, 'img#attachment_img');

        await attachmentLoaded;

        assert.containsOnce(form, 'img#attachment_img');
        assert.notEqual(form.el.querySelector('table th').style.width, '0px',
            "List should have been resized after the attachment has been appended.");

        form.destroy();
    });
});


});
