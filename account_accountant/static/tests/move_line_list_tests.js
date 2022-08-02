odoo.define('account_accountant.MoveLineListViewTests', function (require) {
    "use strict";

    var BasicController = require('web.BasicController');
    const legacyViewRegistry = require("web.view_registry");
    var testUtils = require('web.test_utils');
    const { patchWithCleanup } = require("@web/../tests/helpers/utils");

    var MoveLineListView = require('account_accountant.MoveLineListView').AccountMoveListView;

    const { start, startServer } = require('@mail/../tests/helpers/test_utils');
    const { patchUiSize, SIZES } = require('@mail/../tests/helpers/patch_ui_size');
    const { ROUTES_TO_IGNORE: MAIL_ROUTES_TO_IGNORE } = require('@mail/../tests/helpers/webclient_setup');

    const ROUTES_TO_IGNORE = [
        '/longpolling/im_status',
        '/mail/init_messaging',
        '/mail/load_message_failures',
        '/web/dataset/call_kw/account.move.line/get_views',
        ...MAIL_ROUTES_TO_IGNORE
    ];
    legacyViewRegistry.add('account_move_line_list', MoveLineListView);

    QUnit.module('Views', {}, function () {
        QUnit.module('MoveLineListView');

        QUnit.test('No preview on small devices', async function (assert) {
            assert.expect(6);

            const pyEnv = await startServer();
            const accountMoveLineIds = pyEnv['account.move.line'].create([
                { name: "line1" },
                { name: "line2" },
                { name: "line3" },
                { name: "line4" },
            ]);
            pyEnv['account.move'].create([
                { name: "move1", invoice_line_ids: [accountMoveLineIds[0], accountMoveLineIds[1]] },
                { name: "move2", invoice_line_ids: [accountMoveLineIds[2], accountMoveLineIds[3]] },
            ]);
            patchUiSize({ size: SIZES.XL });
            const views = {
                'account.move.line,false,list':
                    "<tree editable='bottom' js_class='account_move_line_list'>" +
                        "<field name='id'/>" +
                        "<field name='name'/>" +
                        "<field name='move_attachment_ids' invisible='1'/>" +
                    "</tree>",
            };
            const { openView } = await start({
                serverData: { views },
                mockRPC: function (route, args) {
                    if (ROUTES_TO_IGNORE.includes(route)) {
                        return;
                    }
                    if (route.indexOf('/web/static/lib/pdfjs/web/viewer.html') !== -1) {
                        throw new Error('the pdf should not be loaded on small screens');
                    }
                    var method = args.method || route;
                    assert.step(method + '/' + args.model);
                    if (args.model === 'ir.attachment' && args.method === 'read') {
                        throw new Error('the attachments should not be read on small screens');
                    }
                },
            });
            await openView({
                context: {
                    group_by: ['move_id'],
                },
                res_model: 'account.move.line',
                views: [[false, 'list']],
            });

            assert.verifySteps(['web_read_group/account.move.line']);
            assert.containsOnce(document.body, '.o_move_line_list_view',
                "the class should be set");
            assert.containsNone(document.body, '.o_attachment_preview',
                "there should be no attachment preview on small screens");

            await testUtils.dom.click(document.querySelectorAll('.o_group_header')[1]);
            assert.verifySteps(['/web/dataset/search_read/account.move.line'],
                "should not read attachments");
        });

        QUnit.test('Fetch and preview of attachments on big devices', async function (assert) {
            assert.expect(21);

            const pyEnv = await startServer();
            const accountMoveLineIds = pyEnv['account.move.line'].create([
                { name: "line1" },
                { name: "line2" },
                { name: "line3" },
                { name: "line4" },
            ]);
            pyEnv['account.move'].create([
                { name: "move1", invoice_line_ids: [accountMoveLineIds[0], accountMoveLineIds[1]] },
                { name: "move2", invoice_line_ids: [accountMoveLineIds[2], accountMoveLineIds[3]] },
            ]);
            const attachmentIds = pyEnv['ir.attachment'].create([
                { res_id: accountMoveLineIds[2], res_model: 'account.move.line', mimetype: 'application/pdf' },
                { res_id: accountMoveLineIds[3], res_model: 'account.move.line', mimetype: 'application/pdf' },
            ]);
            pyEnv['account.move.line'].write([accountMoveLineIds[2]], { move_attachment_ids: [attachmentIds[0]] });
            pyEnv['account.move.line'].write([accountMoveLineIds[3]], { move_attachment_ids: [attachmentIds[1]] });
            let listController;
            patchWithCleanup(BasicController.prototype, {
                init() {
                    this._super(...arguments);
                    listController = this;
                },
            });
            patchUiSize({ size: SIZES.XXL });
            const views = {
                'account.move.line,false,list':
                    "<tree editable='bottom' js_class='account_move_line_list'>" +
                        "<field name='id'/>" +
                        "<field name='name'/>" +
                        "<field name='move_attachment_ids' invisible='1'/>" +
                    "</tree>",
            };
            const { openView } = await start({
                serverData: { views },
                mockRPC: function (route, args) {
                    if (ROUTES_TO_IGNORE.includes(route)) {
                        return;
                    }
                    if (route.indexOf('/web/static/lib/pdfjs/web/viewer.html') !== -1) {
                        return Promise.resolve();
                    }
                    var method = args.method || route;
                    assert.step(method + '/' + args.model);
                    if (args.model === 'ir.attachment' && args.method === 'read') {
                        assert.deepEqual(args.args, [[1, 2], ["mimetype"]]);
                    }
                },
            });
            await openView({
                context: {
                    group_by: ['move_id'],
                },
                res_model: 'account.move.line',
                views: [[false, 'list']],
            });

            assert.verifySteps(['web_read_group/account.move.line']);
            assert.containsOnce(document.body, '.o_move_line_list_view',
                "the class should be set");
            assert.containsOnce(document.body, '.o_attachment_preview',
                "there should be an attachment preview");
            assert.containsOnce(document.body, '.o_attachment_preview .o_move_line_empty',
                "the attachment preview should be empty");

            await testUtils.dom.click(document.querySelector('.o_group_header'));
            assert.verifySteps(['/web/dataset/search_read/account.move.line']);

            await testUtils.dom.click(document.querySelectorAll('.o_data_row .o_data_cell')[1]);
            assert.containsOnce(document.body, '.o_attachment_preview .o_move_line_without_attachment',
                "an empty message should be displayed");

            await testUtils.dom.click(document.querySelectorAll('.o_data_row')[1].querySelectorAll('.o_data_cell')[1]);
            assert.verifySteps([], "no extra rpc should be done");
            assert.containsOnce(document.body, '.o_attachment_preview .o_move_line_without_attachment',
                "the empty message should still be displayed");

            await testUtils.dom.click(document.querySelectorAll('.o_group_header')[1]);
            assert.verifySteps(['/web/dataset/search_read/account.move.line', 'read/ir.attachment']);
            await testUtils.dom.click(document.querySelectorAll('.o_data_row')[2].querySelectorAll('.o_data_cell')[1]);
            assert.hasAttrValue(document.querySelector('.o_attachment_preview iframe'), 'data-src',
                '/web/static/lib/pdfjs/web/viewer.html?file=/web/content/1?filename%3Dundefined',
                "the src attribute should be correctly set on the iframe");

            await testUtils.dom.click(document.querySelectorAll('.o_data_row')[3].querySelectorAll('.o_data_cell')[1]);
            assert.hasAttrValue(document.querySelector('.o_attachment_preview iframe'), 'data-src',
                '/web/static/lib/pdfjs/web/viewer.html?file=/web/content/2?filename%3Dundefined',
                "the src attribute should still be correctly set on the iframe");
            // reload with groupBy
            await listController.reload({ groupBy: ['move_id', 'move_attachment_ids'] });

            await testUtils.dom.click(document.querySelectorAll('.o_group_header')[1]);
            // clicking on group header line should not do read call to ir.attachment
            assert.verifySteps([
                "web_read_group/account.move.line",
                "web_read_group/account.move.line",
                "web_read_group/account.move.line",
                "/web/dataset/search_read/account.move.line"
            ]);
        });

        QUnit.test('group buttons are toggled when hovering the group', async function (assert) {
            assert.expect(12);

            const pyEnv = await startServer();
            const accountMoveLineIds = pyEnv['account.move.line'].create([
                { name: "line1" },
                { name: "line2" },
                { name: "line3" },
                { name: "line4" },
            ]);
            pyEnv['account.move'].create([
                { name: "move1", invoice_line_ids: [accountMoveLineIds[0], accountMoveLineIds[1]] },
                { name: "move2", invoice_line_ids: [accountMoveLineIds[2], accountMoveLineIds[3]] },
            ]);
            let listController;
            patchWithCleanup(BasicController.prototype, {
                init() {
                    this._super(...arguments);
                    listController = this;
                },
            });
            const views = {
                'account.move.line,false,list':
                    `<tree js_class='account_move_line_list'>
                        <field name='id'/>
                        <field name='name'/>
                        <field name='move_id'/>
                        <field name='move_attachment_ids'/>
                        <groupby name='move_id'>
                            <button name='edit' type='edit' icon='fa-edit' title='Edit' />
                        </groupby>
                    </tree>`,
            };
            const { openView } = await start({
                serverData: { views },
            });
            await openView({
                context: {
                    group_by: ['move_id'],
                },
                res_model: 'account.move.line',
                views: [[false, 'list']],
            });

            assert.containsN(document.body, '.o_group_header', 2, "there should be two group rows");
            assert.doesNotHaveClass(document.querySelector('.o_group_header'), 'o_group_buttons',
                "group button should not be available in collapsed group");

            // expand first group
            await testUtils.dom.click(document.querySelector('.o_group_header'));
            assert.containsN(document.body, '.o_data_row', 2, "there should be two data rows");

            // mouseover on header row
            await testUtils.dom.triggerMouseEvent(document.querySelector('.o_group_header'), "mouseover");
            assert.hasClass(document.querySelector('.o_group_header'), 'show_group_buttons');
            await testUtils.dom.triggerMouseEvent(document.querySelector('.o_group_header'), "mouseout");
            assert.doesNotHaveClass(document.querySelector('.o_group_header'), 'show_group_buttons');

            // mouseover on data row
            await testUtils.dom.triggerMouseEvent(document.querySelector('.o_data_row'), "mouseover");
            assert.hasClass(document.querySelector('.o_group_header'), 'show_group_buttons');
            await testUtils.dom.triggerMouseEvent(document.querySelector('.o_data_row'), "mouseout");
            assert.doesNotHaveClass(document.querySelector('.o_group_header'), 'show_group_buttons');

            // reload with groupBy
            await listController.reload({ groupBy: ['move_id', 'partner_id'] });
            assert.containsN(document.body, '.o_group_header', 3,
                "there should be three group rows, two for root groups and one inside move_id group");

            // mouseover on sub group row
            await testUtils.dom.triggerMouseEvent(document.querySelectorAll('.o_group_header')[1], "mouseover");
            assert.hasClass(document.querySelector('.o_group_header'), 'show_group_buttons');
            await testUtils.dom.triggerMouseEvent(document.querySelectorAll('.o_group_header')[1], "mouseout");
            assert.doesNotHaveClass(document.querySelector('.o_group_header'), 'show_group_buttons');

            // expand first sub group
            await testUtils.dom.click(document.querySelectorAll('.o_group_header')[1]);
            assert.containsN(document.body, '.o_data_row', 2, "there should be two data rows");

            // mouseover on sub group row
            await testUtils.dom.triggerMouseEvent(document.querySelector('.o_data_row'), "mouseover");
            assert.hasClass(document.querySelector('.o_group_header'), 'show_group_buttons');
        });

    });

});
