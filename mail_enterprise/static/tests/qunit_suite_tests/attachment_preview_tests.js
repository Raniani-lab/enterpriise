/** @odoo-module **/

import { patchUiSize, SIZES } from '@mail/../tests/helpers/patch_ui_size';
import {
    afterNextRender,
    dragenterFiles,
    dropFiles,
    start,
    startServer,
} from '@mail/../tests/helpers/test_utils';

import testUtils, { file } from 'web.test_utils';
const { createFile, inputFiles } = file;

QUnit.module('mail_enterprise', {}, function () {
QUnit.module('attachment_preview_tests.js', {}, function () {

    QUnit.test('Should not have attachment preview for still uploading attachment', async function (assert) {
        assert.expect(2);

        const pyEnv = await startServer();
        const resPartnerId1 = pyEnv['res.partner'].create({});
        const views = {
            'res.partner,false,form':
                '<form string="Partners">' +
                    '<div class="o_attachment_preview"/>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
        };
        patchUiSize({ size: SIZES.XXL });
        await afterNextRender(async () => { // because of chatter container
            const { openView } = await start({
                async mockRPC(route, args) {
                    if (_.str.contains(route, '/web/static/lib/pdfjs/web/viewer.html')) {
                        assert.step("pdf viewer");
                    }
                    if (route === '/mail/attachment/upload') {
                        await new Promise(() => {});
                    }
                },
                serverData: { views },
            });
            await openView({
                res_id: resPartnerId1,
                res_model: 'res.partner',
                views: [[false, 'form']],
            });

        });

        await afterNextRender(() =>
            dragenterFiles(document.querySelector('.o_Chatter'))
        );
        const files = [
            await createFile({ name: 'invoice.pdf', contentType: 'application/pdf' }),
        ];
        await afterNextRender(() =>
            dropFiles(document.querySelector('.o_Chatter_dropZone'), files)
        );
        assert.containsNone(document.body, '.o_attachment_preview_container');
        assert.verifySteps([], "The page should never render a PDF while it is uploading, as the uploading is blocked in this test we should never render a PDF preview");
    });

    QUnit.test('Attachment on side', async function (assert) {
        assert.expect(9);

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
        const views = {
            'res.partner,false,form':
                '<form string="Partners">' +
                    '<sheet>' +
                        '<field name="name"/>' +
                    '</sheet>' +
                    '<div class="o_attachment_preview"/>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
        };
        patchUiSize({ size: SIZES.XXL });
        const { click, env, openView } = await start({
            mockRPC(route, args) {
                if (_.str.contains(route, '/web/static/lib/pdfjs/web/viewer.html')) {
                    var canvas = document.createElement('canvas');
                    return canvas.toDataURL();
                }
            },
            serverData: { views },
        });
        await openView({
            res_id: resPartnerId1,
            res_model: 'res.partner',
            views: [[false, 'form']],
        });

        assert.containsOnce(document.body, '.o_attachment_preview_img > img',
            "There should be an image for attachment preview");
        assert.containsOnce(document.body, '.o_form_sheet_bg > .o_FormRenderer_chatterContainer',
            "Chatter should moved inside sheet");
        assert.doesNotHaveClass(
            document.querySelector('.o_FormRenderer_chatterContainer'),
            'o-aside',
            "Chatter should not have o-aside class as it is below form view and not aside",
        );
        assert.containsOnce(document.body, '.o_form_sheet_bg + .o_attachment_preview',
            "Attachment preview should be next sibling to .o_form_sheet_bg");

        // Don't display arrow if there is no previous/next element
        assert.containsNone(document.body, '.arrow',
            "Don't display arrow if there is no previous/next attachment");

        // send a message with attached PDF file
        await click('.o_ChatterTopbar_buttonSendMessage');
        const files = [
            await createFile({ name: 'invoice.pdf', contentType: 'application/pdf' }),
        ];
        const messaging = await env.services.messaging.get();
        const chatter = messaging.models['Chatter'].all()[0];
        await afterNextRender(() =>
            inputFiles(chatter.composerView.fileUploader.fileInput, files)
        );

        await click('.o_Composer_buttonSend');
        assert.containsN(document.body, '.arrow', 2,
            "Display arrows if there multiple attachments");

        await click('.o_move_next');
        assert.containsNone(document.body, '.o_attachment_preview_img > img',
            "Preview image should be removed");
        assert.containsOnce(document.body, '.o_attachment_preview_container > iframe',
            "There should be iframe for pdf viewer");

        await click('.o_move_previous');
        assert.containsOnce(document.body, '.o_attachment_preview_img > img',
            "Display next attachment");
    });

    QUnit.test('After switching record with the form pager, when using the attachment preview navigation, the attachment should be switched',
        async function (assert) {
            assert.expect(4);

            const pyEnv = await startServer();

            const resPartnerId1 = pyEnv['res.partner'].create({
                display_name: 'first partner',
                message_attachment_count: 2
            });

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

            const irAttachmentId2 = pyEnv['ir.attachment'].create({
                mimetype: 'application/pdf',
                res_id: resPartnerId1,
                res_model: 'res.partner',
            });
            pyEnv['mail.message'].create({
                attachment_ids: [irAttachmentId2],
                model: 'res.partner',
                res_id: resPartnerId1,
            });

            const resPartnerId2 = pyEnv['res.partner'].create({
                display_name: 'second partner',
                message_attachment_count: 0
            });

            const views = {
                'res.partner,false,form':
                    `<form string="Partners">
                        <sheet>
                            <field name="name"/>
                        </sheet>
                        <div class="o_attachment_preview"/>
                        <div class="oe_chatter">
                            <field name="message_ids"/>
                        </div>
                    </form>`,
            };
            patchUiSize({ size: SIZES.XXL });
            const { click, openView } = await start({
                serverData: { views },
                async mockRPC(route, args) {
                    if (route.includes('/web/static/lib/pdfjs/web/viewer.html')) {
                        return document.createElement('canvas').toDataURL();
                    }
                },
            });
            await openView(
                {
                    res_id: resPartnerId1,
                    res_model: 'res.partner',
                    views: [[false, 'form']]
                },
                {
                    resIds: [resPartnerId1, resPartnerId2],
                    index: 0,
                }
            );

            assert.strictEqual($('.o_pager_counter').text(), '1 / 2',
                'The form view pager should display 1 / 2');

            await click('.o_pager_next');
            await click('.o_pager_previous');
            assert.containsN(document.body, '.arrow', 2,
                'The attachment preview should contain 2 arrows to navigated between attachments');

            await testUtils.dom.click(document.querySelector('.o_attachment_preview_container .o_move_next'), {allowInvisible: true});
            assert.containsOnce(document.body, '.o_attachment_preview_img img',
                'The second attachment (of type img) should be displayed');

            await testUtils.dom.click(document.querySelector('.o_attachment_preview_container .o_move_previous'), {allowInvisible: true});
            assert.containsOnce(document.body, '.o_attachment_preview_container iframe',
                'The first attachment (of type pdf) should be displayed');
        });

    QUnit.test('Attachment on side on new record', async function (assert) {
        assert.expect(2);

        const views = {
            'res.partner,false,form':
                '<form string="Partners">' +
                    '<sheet>' +
                        '<field name="name"/>' +
                    '</sheet>' +
                    '<div class="o_attachment_preview"/>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
        };
        patchUiSize({ size: SIZES.XXL });
        const { openView } = await start({
            serverData: { views },
        });
        await openView({
            res_model: 'res.partner',
            views: [[false, 'form']],
        });

        assert.containsNone(document.body, '.o_attachment_preview',
            "the preview should not be displayed");
        assert.containsOnce(document.body, '.o_form_sheet_bg + .o_FormRenderer_chatterContainer',
            "chatter should not have been moved");
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
        const views = {
            'res.partner,false,form':
                '<form string="Partners">' +
                    '<sheet>' +
                        '<field name="name"/>' +
                    '</sheet>' +
                    '<div class="o_attachment_preview"/>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
        };
        patchUiSize({ size: SIZES.XL });
        const { openFormView } = await start({
            serverData: { views },
        });
        await openFormView({
            res_id: resPartnerId1,
            res_model: 'res.partner',
        });
        assert.containsNone(document.body, '.o_attachment_preview', "there should be nothing previewed");
        assert.containsOnce(document.body, '.o_form_sheet_bg + .o_FormRenderer_chatterContainer',
            "chatter should not have been moved");
    });

    QUnit.test('Attachment triggers list resize', async function (assert) {
        assert.expect(3);

        const pyEnv = await startServer();
        const mailChannelId1 = pyEnv['mail.channel'].create({
            name: new Array(100).fill().map(_ => 'name').join(),
        });
        const resPartnerId1 = pyEnv['res.partner'].create({ channel_ids: [mailChannelId1] });
        const views = {
            'res.partner,false,form':
                `<form string="Whatever">
                    <sheet>
                        <field name="channel_ids"/>
                    </sheet>
                    <div class="o_attachment_preview"/>
                    <div class="oe_chatter">
                        <field name="message_ids"/>
                    </div>
                </form>`,
            'mail.channel,false,list':
                `<tree>
                    <field name="name"/>
                </tree>`,
        };
        patchUiSize({ size: SIZES.XXL });
        const { openView } = await start({
            serverData: { views },
        });
        await openView({
            res_id: resPartnerId1,
            res_model: 'res.partner',
            views: [[false, 'form']],
        });

        // Sets an arbitrary width to check if it is correctly overriden.
        document.querySelector('table th').style.width = '0px';

        assert.containsNone(document.body, 'img#attachment_img');

        await afterNextRender(() =>
            dragenterFiles(document.querySelector('.o_Chatter'))
        );
        const files = [
            await createFile({
                content: 'hello, world',
                contentType: 'image/jpeg',
                name: 'image.jpeg',
            }),
        ];
        await afterNextRender(() =>
            dropFiles(document.querySelector('.o_Chatter_dropZone'), files)
        );
        assert.containsOnce(document.body, 'img#attachment_img');
        assert.notEqual(document.querySelector('table th').style.width, '0px',
            "List should have been resized after the attachment has been appended.");
    });
});
});
