/** @odoo-module **/

import {
    afterNextRender,
    start,
    startServer,
} from '@mail/../tests/helpers/test_utils';

import testUtils, { file } from 'web.test_utils';
import config from 'web.config';
import FormView from 'web.FormView';
const { createFile, inputFiles } = file;

QUnit.module('mail_enterprise', {}, function () {
QUnit.module('attachment_preview_tests.js', {}, function () {

    QUnit.test('Should not have attachment preview for still uploading attachment', async function (assert) {
        assert.expect(2);

        const pyEnv = await startServer();
        const resPartnerId1 = pyEnv['res.partner'].create({});
        let form, env;
        await afterNextRender(async () => { // because of chatter container
            const { env: environment, widget } = await start({
                hasView: true,
                View: FormView,
                model: 'res.partner',
                arch: '<form string="Partners">' +
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
                res_id: resPartnerId1,
                async mockRPC(route, args) {
                    if (_.str.contains(route, '/web/static/lib/pdfjs/web/viewer.html')) {
                        assert.step("pdf viewer");
                    }
                    return this._super.apply(this, arguments);
                },
                async mockFetch(resource, init) {
                    const res = this._super(...arguments);
                    if (resource === '/mail/attachment/upload') {
                        await new Promise(() => {});
                    }
                    return res;
                }
            });
            env = environment;
            form = widget;
        });

        await afterNextRender(() =>
            document.querySelector('.o_ChatterTopbar_buttonAttachments').click()
        );
        const files = [
            await createFile({ name: 'invoice.pdf', contentType: 'application/pdf' }),
        ];
        const messaging = await env.services.messaging.get();
        const chatter = messaging.models['Chatter'].all()[0];
        await afterNextRender(() =>
            inputFiles(chatter.attachmentBoxView.fileUploader.fileInput, files)
        );
        assert.containsNone(form, '.o_attachment_preview_container');
        assert.verifySteps([], "The page should never render a PDF while it is uploading, as the uploading is blocked in this test we should never render a PDF preview");
        form.destroy();
    });

    QUnit.test('Attachment on side', async function (assert) {
        assert.expect(10);

        const pyEnv = await startServer();
        const resPartnerId1 = pyEnv['res.partner'].create({});
        const irAttachmentId1 = pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            res_id: resPartnerId1,
            res_model: 'res.partner',
        });
        pyEnv['mail.message'].create({
            attachment_ids: [irAttachmentId1],
            model: 'res.partner',
            res_id: resPartnerId1,
        });
        let form, env;
        await afterNextRender(async () => { // because of chatter container
            const { env: environment, widget } = await start({
                hasView: true,
                View: FormView,
                model: 'res.partner',
                arch: '<form string="Partners">' +
                        '<sheet>' +
                            '<field name="name"/>' +
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
                res_id: resPartnerId1,
                config: {
                    device: {
                        size_class: config.device.SIZES.XXL,
                    },
                },
                async mockRPC(route, args) {
                    if (_.str.contains(route, '/web/static/lib/pdfjs/web/viewer.html')) {
                        var canvas = document.createElement('canvas');
                        return canvas.toDataURL();
                    }
                    if (args.method === 'register_as_main_attachment') {
                        return true;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            env = environment;
            form = widget;
        });

        assert.containsOnce(form, '.o_attachment_preview_img > img',
            "There should be an image for attachment preview");
        assert.containsOnce(form, '.o_form_sheet_bg > .o_FormRenderer_chatterContainer',
            "Chatter should moved inside sheet");
        assert.doesNotHaveClass(
            document.querySelector('.o_FormRenderer_chatterContainer'),
            'o-aside',
            "Chatter should not have o-aside class as it is below form view and not aside",
        );
        assert.containsOnce(form, '.o_form_sheet_bg + .o_attachment_preview',
            "Attachment preview should be next sibling to .o_form_sheet_bg");

        // Don't display arrow if there is no previous/next element
        assert.containsNone(form, '.arrow',
            "Don't display arrow if there is no previous/next attachment");

        // send a message with attached PDF file
        await afterNextRender(() =>
            document.querySelector('.o_ChatterTopbar_buttonSendMessage').click()
        );
        const files = [
            await createFile({ name: 'invoice.pdf', contentType: 'application/pdf' }),
        ];
        const messaging = await env.services.messaging.get();
        const chatter = messaging.models['Chatter'].all()[0];
        await afterNextRender(() =>
            inputFiles(chatter.composerView.fileUploader.fileInput, files)
        );
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

        let form;
        await afterNextRender(async () => { // because of chatter container
            const { widget } = await start({
                hasView: true,
                View: FormView,
                model: 'res.partner',
                arch: '<form string="Partners">' +
                        '<sheet>' +
                            '<field name="name"/>' +
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
            form = widget;
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

        const pyEnv = await startServer();
        const resPartnerId1 = pyEnv['res.partner'].create({});
        const irAttachmentId1 = pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            res_id: resPartnerId1,
            res_model: 'res.partner',
        });
        pyEnv['mail.message'].create({
            attachment_ids: [irAttachmentId1],
            model: 'res.partner',
            res_id: resPartnerId1,
        });
        let form;
        await afterNextRender(async () => { // because of chatter container
            const { widget } = await start({
                hasView: true,
                View: FormView,
                model: 'res.partner',
                arch: '<form string="Partners">' +
                        '<sheet>' +
                            '<field name="name"/>' +
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
                res_id: resPartnerId1,
                config: {
                    device: {
                        size_class: config.device.SIZES.XL,
                    },
                },
            });
            form = widget;
        });
        assert.strictEqual(form.$('.o_attachment_preview').children().length, 0,
            "there should be nothing previewed");
        assert.containsOnce(form, '.o_form_sheet_bg + .o_FormRenderer_chatterContainer',
            "chatter should not have been moved");

        form.destroy();
    });

    QUnit.test('Attachment triggers list resize', async function (assert) {
        assert.expect(3);

        const pyEnv = await startServer();
        const mailChannelId1 = pyEnv['mail.channel'].create({
            name: new Array(100).fill().map(_ => 'name').join(),
        });
        const resPartnerId1 = pyEnv['res.partner'].create({ channel_ids: [mailChannelId1] });
        pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            name: 'Test Image 1',
            res_id: resPartnerId1,
            res_model: 'res.partner',
        });
        const { widget: form } = await start({
            hasView: true,
            arch: `
                <form string="Whatever">
                    <sheet>
                        <field name="channel_ids"/>
                    </sheet>
                    <div class="o_attachment_preview" options="{ 'order': 'desc' }"/>
                    <div class="oe_chatter">
                        <field name="message_ids"/>
                    </div>
                </form>`,
            archs: {
                // FIXME could be removed once task-2248306 is done
                'mail.message,false,list': '<tree/>',
                'mail.channel,false,list': `
                    <tree>
                        <field name="name"/>
                    </tree>`,
            },
            async mockRPC(route, { method }) {
                const _super = this._super.bind(this, ...arguments); // limitation of class.js
                switch (method) {
                    case 'register_as_main_attachment':
                        return true;
                }
                return _super();
            },
            config: {
                device: { size_class: config.device.SIZES.XXL },
            },
            model: 'res.partner',
            res_id: resPartnerId1,
            View: FormView,
        });

        // Sets an arbitrary width to check if it is correctly overriden.
        form.el.querySelector('table th').style.width = '0px';

        assert.containsNone(form, 'img#attachment_img');

        // Wait for image to be loaded
        await new Promise(resolve => {
            const loadHandler = async ev => {
                if (ev.target.dataset.src === "/web/image/1?unique=1") {
                    await testUtils.nextTick();
                    document.body.removeEventListener("load", loadHandler, { capture: true });
                    resolve();
                }
            };
            document.body.addEventListener("load", loadHandler, { capture: true });
        });

        assert.containsOnce(form, 'img#attachment_img');
        assert.notEqual(form.el.querySelector('table th').style.width, '0px',
            "List should have been resized after the attachment has been appended.");

        form.destroy();
    });
});
});
