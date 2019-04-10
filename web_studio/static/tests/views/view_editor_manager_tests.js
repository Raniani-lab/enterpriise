odoo.define('web_studio.ViewEditorManager_tests', function (require) {
"use strict";

var mailTestUtils = require('mail.testUtils');

var ace = require('web_editor.ace');
var concurrency = require('web.concurrency');
var config = require('web.config');
var fieldRegistry = require('web.field_registry');
var framework = require('web.framework');
var ListRenderer = require('web.ListRenderer');
var testUtils = require('web.test_utils');
var session = require('web.session');

var studioTestUtils = require('web_studio.testUtils');

QUnit.module('Studio', {}, function () {

QUnit.module('ViewEditorManager', {
    beforeEach: function () {
        this.services = mailTestUtils.getMailServices();
        this.data = {
            coucou: {
                fields: {
                    display_name: {
                        string: "Display Name",
                        type: "char"
                    },
                    message_attachment_count: {
                        string: 'Attachment count',
                        type: 'integer',
                    },
                    char_field: {
                        string:"A char",
                        type: "char",
                    },
                    m2o: {
                        string: "M2O",
                        type: "many2one",
                        relation: 'product',
                    },
                    product_ids: {string: "Products", type: "one2many", relation: "product", searchable: true},
                    priority: {
                        string: "Priority",
                        type: "selection",
                        selection: [['1', "Low"], ['2', "Medium"], ['3', "High"]],
                    },
                    start: {
                        string: "Start Date",
                        type: 'datetime',
                    },
                    stop: {
                        string: "Stop Date",
                        type: 'datetime',
                    },
                },
            },
            product: {
                fields: {
                    display_name: {string: "Display Name", type: "char", searchable: true},
                    m2o: {string: "M2O", type: "many2one", relation: 'partner', searchable: true},
                    partner_ids: {string: "Partners", type: "one2many", relation: "partner", searchable: true},
                    coucou_id: {string: "coucou", type: "many2one", relation: "coucou"},
                },
                records: [{
                    id: 37,
                    display_name: 'xpad',
                    m2o: 7,
                    partner_ids: [4],
                }, {
                    id: 42,
                    display_name: 'xpod',
                }],
            },
            partner: {
                fields: {
                    display_name: {string: "Display Name", type: "char"},
                    image: {string: "Image", type: "binary"},
                },
                records: [{
                    id: 4,
                    display_name: "jean",
                }, {
                    id: 7,
                    display_name: "jacques",
                }],
            },
            'ir.attachment': {
                fields: {},
                records: [],
            },
        };
    },
}, function () {

    QUnit.module('List');

    QUnit.test('list editor sidebar', async function (assert) {
        assert.expect(5);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree/>",
        });

        assert.containsOnce(vem, '.o_web_studio_sidebar',
            "there should be a sidebar");
        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_new'),'active',
            "the Add tab should be active in list view");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('.o_web_studio_field_type_container').length, 2,
            "there should be two sections in Add (new & existing fields");

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));

        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'),'active',
            "the View tab should now be active");
        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_properties'),'disabled',
            "the Properties tab should now be disabled");

        vem.destroy();
    });

    QUnit.test('empty list editor', async function (assert) {
        assert.expect(5);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree/>",
        });

        assert.strictEqual(vem.view_type, 'list',
            "view type should be list");
        assert.containsOnce(vem, '.o_web_studio_list_view_editor',
            "there should be a list editor");
        assert.containsOnce(vem, '.o_web_studio_list_view_editor table thead th.o_web_studio_hook',
            "there should be one hook");
        assert.containsNone(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be no node");
        var nbFields = _.size(this.data.coucou.fields);
        assert.strictEqual(vem.$('.o_web_studio_sidebar .o_web_studio_existing_fields').children().length, nbFields,
            "all fields should be available");

        vem.destroy();
    });

    QUnit.test('list editor', async function (assert) {
        assert.expect(3);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name'/></tree>",
        });

        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be one node");
        assert.containsN(vem, 'table thead th.o_web_studio_hook', 2,
            "there should be two hooks (before & after the field)");
        var nbFields = _.size(this.data.coucou.fields) - 1; // - display_name
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('.o_web_studio_existing_fields').children().length, nbFields,
            "fields that are not already in the view should be available");

        vem.destroy();
    });

    QUnit.test('invisible list editor', async function (assert) {
        assert.expect(4);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name' invisible='1'/></tree>",
        });

        assert.containsNone(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be no node");
        assert.containsOnce(vem, 'table thead th.o_web_studio_hook',
            "there should be one hook");

        // click on show invisible
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#show_invisible'));

        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be one node (the invisible one)");
        assert.containsN(vem, 'table thead th.o_web_studio_hook', 2,
            "there should be two hooks (before & after the field)");

        vem.destroy();
    });

    QUnit.test('list editor with control node tag', async function(assert) {
        assert.expect(2);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><control><create string='Add a line'/></control></tree>",
        });

        assert.containsNone(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be no node");

        // click on show invisible
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#show_invisible'));

        assert.containsNone(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be no nodes (the control is filtered)");

        vem.destroy();
    });

    QUnit.test('list editor invisible to visible on field', async function (assert) {
        assert.expect(3);

        testUtils.patch(session.user_context, {
            lang: 'fr_FR',
            tz: 'Europe/Brussels',
        });

        var archReturn = '<tree><field name="char_field" modifiers="{}" attrs="{}"/></tree>';
        var fieldsView;

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name'/>" +
                        "<field name='char_field' invisible='1'/>" +
                    "</tree>",
            mockRPC: function(route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.context.tz, 'Europe/Brussels',
                        'The tz from user_context should have been passed');
                    assert.strictEqual(args.context.lang, false,
                        'The lang in context should be false explicitly');
                    assert.ok(!('column_invisible' in args.operations[0].new_attrs),
                            'we shouldn\'t send "column_invisible"');

                    fieldsView.arch = archReturn;
                    return Promise.resolve({
                        fields_views: {list: fieldsView},
                        fields: fieldsView.fields,
                    });
                }
                return this._super.apply(this, arguments);
            }
        });
        fieldsView = $.extend(true, {}, vem.fields_view);

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#show_invisible'));

        // select the second column
        await testUtils.dom.click(vem.$('thead th[data-node-id=2]'));
        // disable invisible
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#invisible'));

        testUtils.unpatch(session.user_context);
        vem.destroy();
    });

    QUnit.test('list editor invisible to visible on field readonly', async function (assert) {
        assert.expect(2);

        var archReturn = '<tree><field name="char_field" readonly="1" attrs="{}" invisible="1" modifiers="{&quot;column_invisible&quot;: true, &quot;readonly&quot;: true}"/></tree>';
        var fieldsView;

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name'/>" +
                        "<field name='char_field' readonly='1'/>" +
                    "</tree>",
            mockRPC: function(route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.ok(!('readonly' in args.operations[0].new_attrs),
                        'we shouldn\'t send "readonly"');
                    assert.equal(args.operations[0].new_attrs.invisible, 1,
                        'we should send "invisible"');

                    fieldsView.arch = archReturn;
                    return Promise.resolve({
                        fields_views: {list: fieldsView},
                        fields: fieldsView.fields,
                    });
                }
                return this._super.apply(this, arguments);
            }
        });
        fieldsView = $.extend(true, {}, vem.fields_view);

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#show_invisible'));

        // select the second column
        await testUtils.dom.click(vem.$('thead th[data-node-id=2]'));
        // disable invisible
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#invisible'));

        vem.destroy();
    });

    QUnit.test('list editor field', async function (assert) {
        assert.expect(5);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name'/></tree>",
        });

        // click on the field
        await testUtils.dom.click(vem.$('.o_web_studio_list_view_editor [data-node-id]'));

        assert.hasClass(vem.$('.o_web_studio_list_view_editor [data-node-id]'),'o_web_studio_clicked',
            "the column should have the clicked style");

        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_properties'),'active',
            "the Properties tab should now be active");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('input[name="string"]').val(), "Display Name",
            "the label in sidebar should be Display Name");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('select[name="widget"]').val(), "char",
            "the widget in sidebar should be set by default");

        vem.destroy();
    });

    QUnit.test('sorting rows is disabled in Studio', async function (assert) {
        assert.expect(3);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'product',
            arch: "<tree editable='true'> "+
                "<field name='id' widget='handle'/>" +
                "<field name='display_name'/>" +
            "</tree>",
        });

        assert.containsN(vem, '.ui-sortable-handle', 2,
            "the widget handle should be displayed");
        assert.strictEqual(vem.$('.o_data_cell').text(), "xpadxpod",
            "the records should be ordered");

        // Drag and drop the second line in first position
        await testUtils.dom.dragAndDrop(
            vem.$('.ui-sortable-handle').eq(1),
            vem.$('tbody tr').first(),
            {position: 'top'}
        );
        assert.strictEqual(vem.$('.o_data_cell').text(), "xpadxpod",
            "the records should not have been moved (sortable should be disabled in Studio)");

        vem.destroy();
    });

    QUnit.test('List grouped should not be grouped', async function (assert) {
        assert.expect(1);

        this.data.coucou.fields.croissant = {string: "Croissant", type: "integer"};
        this.data.coucou.records = [{id: 1, display_name: 'Red Right Hand', priority: '1', croissant: 3},
                                    {id: 2, display_name: 'Hell Broke Luce', priority: '1', croissant: 5}];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='croissant' sum='Total Croissant'/></tree>",
            groupBy: ['priority'],
        });

        assert.containsNone(vem, '.o_web_studio_list_view_editor .o_list_view_grouped',
            "The list should not be grouped");

        vem.destroy();
    });

    QUnit.test('move a field in list', async function (assert) {
        assert.expect(3);
        var arch = "<tree>" +
            "<field name='display_name'/>" +
            "<field name='char_field'/>" +
            "<field name='m2o'/>" +
        "</tree>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0], {
                        node: {
                            tag: 'field',
                            attrs: {name: 'm2o'},
                        },
                        position: 'before',
                        target: {
                            tag: 'field',
                            attrs: {name: 'display_name'},
                        },
                        type: 'move',
                    }, "the move operation should be correct");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = "<tree>" +
                        "<field name='m2o'/>" +
                        "<field name='display_name'/>" +
                        "<field name='char_field'/>" +
                    "</tree>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        assert.strictEqual(vem.$('.o_web_studio_list_view_editor th').text(), "Display NameA charM2O",
            "the columns should be in the correct order");

        // move the m2o at index 0
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_list_view_editor th:contains(M2O)'),
            vem.$('th.o_web_studio_hook:first'));

        assert.strictEqual(vem.$('.o_web_studio_list_view_editor th').text(), "M2ODisplay NameA char",
            "the moved field should be the first column");

        vem.destroy();
    });

    QUnit.module('Form');

    QUnit.test('empty form editor', async function (assert) {
        assert.expect(4);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form/>",
        });

        assert.strictEqual(vem.view_type, 'form',
            "view type should be form");
        assert.containsOnce(vem, '.o_web_studio_form_view_editor',
            "there should be a form editor");
        assert.containsNone(vem, '.o_web_studio_form_view_editor [data-node-id]',
            "there should be no node");
        assert.containsNone(vem, '.o_web_studio_form_view_editor .o_web_studio_hook',
            "there should be no hook");

        vem.destroy();
    });

    QUnit.test('form editor', async function (assert) {
        assert.expect(6);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        "<field name='display_name'/>" +
                    "</sheet>" +
                "</form>",
        });

        assert.containsOnce(vem, '.o_web_studio_form_view_editor [data-node-id]',
            "there should be one node");
        assert.containsOnce(vem, '.o_web_studio_form_view_editor .o_web_studio_hook',
            "there should be one hook");

        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor [data-node-id]'));

        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_properties'),'active',
            "the Properties tab should now be active");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor [data-node-id]'),'o_web_studio_clicked',
            "the column should have the clicked style");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('select[name="widget"]').val(), "char",
            "the widget in sidebar should be set by default");

        vem.destroy();
    });

    QUnit.test('many2one field edition', async function (assert) {
        assert.expect(3);

        this.data.product.records = [{
            id: 42,
            display_name: "A very good product",
        }];
        this.data.coucou.records = [{
            id: 1,
            display_name: "Kikou petite perruche",
            m2o: 42,
        }];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        "<field name='m2o'/>" +
                    "</sheet>" +
                "</form>",
            res_id: 1,
            mockRPC: function (route, args) {
                if (args.method === 'get_formview_action') {
                    throw new Error("The many2one form view should not be opened");
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.containsOnce(vem, '.o_web_studio_form_view_editor [data-node-id]',
            "there should be one node");

        // edit the many2one
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor [data-node-id]'));

        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor [data-node-id]'),'o_web_studio_clicked',
            "the column should have the clicked style");
        vem.destroy();
    });

    QUnit.test('image field edition (change size)', async function (assert) {
        assert.expect(10);

        var arch = "<form>" +
            "<sheet>" +
                "<field name='image' widget='image' options='{\"size\":[90, 90],\"preview_image\":\"coucou\"}'/>" +
            "</sheet>" +
        "</form>";
        var fieldsView;

        this.data.partner.records.push({
            id: 8,
            display_name: "kamlesh",
            image: "sulochan",
        });

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'partner',
            arch: arch,
            res_id: 8,
            mockRPC: function (route, args) {
                if (route === 'data:image/png;base64,sulochan') {
                    assert.step('image');
                    return Promise.resolve();
                } else if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].new_attrs.options, "{\"size\":[270,270],\"preview_image\":\"coucou\"}",
                        "appropriate options for 'image' widget should be passed");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = "<form>" +
                        "<sheet>" +
                            "<field name='image' widget='image' options='{\"size\": [270, 270]}'/>" +
                        "</sheet>" +
                    "</form>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsOnce(vem, '.o_web_studio_form_view_editor .o_field_image',
            "there should be one image");
        assert.verifySteps(['image'], "the image should have been fetched");

        // edit the image
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_image'));

        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field select#option_size',
            "the sidebar should display dropdown to change image size");
        assert.strictEqual(vem.$('.o_web_studio_sidebar_content.o_display_field select#option_size option:selected').val(), "[90,90]",
            "the image size should be correctly selected");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_field_image'),'o_web_studio_clicked',
            "image should have the clicked style");

        // change image size to large
        await testUtils.fields.editSelect(vem.$('.o_web_studio_sidebar_content.o_display_field select#option_size'), "[270,270]");

        assert.verifySteps(['image'], "the image should have been fetched again");
        assert.strictEqual(vem.$('.o_web_studio_sidebar_content.o_display_field select#option_size option:selected').val(), "[270,270]",
            "the image size should be correctly selected");
        vem.destroy();
    });

    QUnit.test('change widget binary to image (check default size)', async function (assert) {
        assert.expect(4);

        var arch = "<form>" +
            "<sheet>" +
                "<field name='image'/>" +
            "</sheet>" +
        "</form>";
        var fieldsView;

        this.data.partner.records[0].image = 'kikou';

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'partner',
            arch: arch,
            res_id: 4,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].new_attrs.options, '{"size":[90,90]}',
                        "appropriate default options for 'image' widget should be passed");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsOnce(vem, '.o_web_studio_form_view_editor [data-node-id]',
            "there should be one binary field");

        // edit the binary field
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor [data-node-id]'));

        // Change widget from binary to image
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field select#widget',
            "the sidebar should display dropdown to change widget");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor [data-node-id]'),'o_web_studio_clicked',
            "binary field should have the clicked style");

        // change widget to image
        await testUtils.fields.editSelect(vem.$('.o_web_studio_sidebar_content.o_display_field select#widget'), 'image');
        vem.destroy();
    });

    QUnit.test('invisible form editor', async function (assert) {
        assert.expect(6);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        "<field name='display_name' invisible='1'/>" +
                        "<group>" +
                            "<field name='m2o' attrs=\"{'invisible': [('id', '!=', '42')]}\"/>" +
                        "</group>" +
                    "</sheet>" +
                "</form>",
        });

        assert.containsN(vem, '.o_web_studio_form_view_editor .o_field_widget.o_invisible_modifier', 2,
            "there should be two invisible nodes");
        assert.containsOnce(vem, '.o_web_studio_form_view_editor [data-node-id]',
            "the invisible node should not be editable (only the group has a node-id set)");
        assert.containsN(vem, '.o_web_studio_form_view_editor .o_web_studio_hook', 2,
            "there should be two hooks (outside and inside the group");

        // click on show invisible
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#show_invisible'));

        assert.containsN(vem, '.o_web_studio_form_view_editor .o_web_studio_show_invisible[data-node-id]', 2,
            "there should be one visible nodes (the invisible ones)");
        assert.containsNone(vem, '.o_web_studio_form_view_editor .o_invisible_modifier[data-node-id]',
            "there should be no invisible node");
        assert.containsN(vem, '.o_web_studio_form_view_editor .o_web_studio_hook', 3,
            "there should be three hooks");

        vem.destroy();
    });

    QUnit.test('form editor - chatter edition', async function (assert) {
        assert.expect(5);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            services: this.services,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        "<field name='display_name'/>" +
                    "</sheet>" +
                    "<div class='oe_chatter'/>" +
                "</form>",
            mockRPC: function(route, args) {
                if (route === '/web_studio/get_email_alias') {
                    return Promise.resolve({email_alias: 'coucou'});
                }
                return this._super(route, args);
            },
        });

        assert.containsOnce(vem, '.o_web_studio_form_view_editor .oe_chatter[data-node-id]',
            "there should be a chatter node");

        // click on the chatter
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .oe_chatter[data-node-id]'));

        assert.hasClass(vem.$('.o_web_studio_sidebar .o_web_studio_properties'),'active',
            "the Properties tab should now be active");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_chatter',
            "the sidebar should now display the chatter properties");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .oe_chatter[data-node-id]'),'o_web_studio_clicked',
            "the chatter should have the clicked style");
        assert.strictEqual(vem.$('.o_web_studio_sidebar input[name="email_alias"]').val(), "coucou",
            "the email alias in sidebar should be fetched");

        vem.destroy();
    });

    QUnit.test('fields without value and label (outside of groups) are shown in form', async function (assert) {
        assert.expect(6);

        this.data.coucou.records = [{
            id: 1,
            display_name: "Kikou petite perruche",
        }];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        "<group>" +
                            "<field name='id'/>" +
                            "<field name='m2o'/>" +
                        "</group>" +
                        "<field name='display_name'/>" +
                        "<field name='char_field'/>" +
                    "</sheet>" +
                "</form>",
            res_id: 1,
        });

        assert.doesNotHaveClass(vem.$('.o_web_studio_form_view_editor [name="id"]'), 'o_web_studio_widget_empty',
            "non empty field in group should label should not be special");
        assert.doesNotHaveClass(vem.$('.o_web_studio_form_view_editor [name="m2o"]'), 'o_web_studio_widget_empty',
            "empty field in group should have without label should not be special");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor [name="m2o"]'),'o_field_empty',
            "empty field in group should have without label should still have the normal empty class");
        assert.doesNotHaveClass(vem.$('.o_web_studio_form_view_editor [name="display_name"]'), 'o_web_studio_widget_empty',
            "non empty field without label should not be special");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor [name="char_field"]'),'o_web_studio_widget_empty',
            "empty field without label should be special");
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor [name="char_field"]').text(), "A char",
            "empty field without label should have its string as label");

        vem.destroy();
    });

    QUnit.test('correctly display hook in form sheet', async function (assert) {
        assert.expect(4);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        // hook here
                        "<group>" +
                            "<group/>" +
                            "<group/>" +
                        "</group>" +
                        // hook here
                        "<group>" +
                            "<group/>" +
                            "<group/>" +
                        "</group>" +
                        // hook here
                    "</sheet>" +
                "</form>",
        });

        assert.containsN(vem, '.o_web_studio_form_view_editor .o_form_sheet > div.o_web_studio_hook', 3,
            "there should be three hooks as children of the sheet");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_form_sheet > div:eq(1)'),'o_web_studio_hook',
            "second div should be a hook");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_form_sheet > div:eq(3)'),'o_web_studio_hook',
            "fourth div should be a hook");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_form_sheet > div:eq(5)'),'o_web_studio_hook',
            "last div should be a hook");

        vem.destroy();
    });

    QUnit.test('correctly display hook below group title', async function (assert) {
        assert.expect(14);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<sheet>" +
                        "<group>" +
                        "</group>" +
                        "<group string='Kikou2'>" +
                        "</group>" +
                        "<group>" +
                            "<field name='m2o'/>" +
                        "</group>" +
                        "<group string='Kikou'>" +
                            "<field name='id'/>" +
                        "</group>" +
                    "</sheet>" +
                "</form>",
        });


        // first group (without title, without content)
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(0) .o_web_studio_hook').length, 1,
            "there should be 1 hook");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(0) tr:eq(1)'),'o_web_studio_hook',
            "the second row should be a hook");

        // second group (with title, without content)
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(1) .o_web_studio_hook').length, 1,
            "there should be 1 hook");
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(1) tr:eq(0)').text(), "Kikou2",
            "the first row is the group title");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(1) tr:eq(2)'),'o_web_studio_hook',
            "the third row should be a hook");

        // third group (without title, with content)
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(2) .o_web_studio_hook').length, 2,
            "there should be 2 hooks");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(2) tr:eq(0)'),'o_web_studio_hook',
            "the first row should be a hook");
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(2) tr:eq(1)').text(), "M2O",
            "the second row is the field");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(2) tr:eq(2)'),'o_web_studio_hook',
            "the third row should be a hook");

        // last group (with title, with content)
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(3) .o_web_studio_hook').length, 2,
            "there should be 2 hooks");
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(3) tr:eq(0)').text(), "Kikou",
            "the first row is the group title");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(3) tr:eq(1)'),'o_web_studio_hook',
            "the second row should be a hook");
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(3) tr:eq(2)').text(), "ID",
            "the third row is the field");
        assert.hasClass(vem.$('.o_web_studio_form_view_editor .o_inner_group:eq(3) tr:eq(3)'),'o_web_studio_hook',
            "the last row should be a hook");

        vem.destroy();
    });

    QUnit.test('notebook edition', async function (assert) {
        assert.expect(9);

        var arch = "<form>" +
            "<sheet>" +
                "<group>" +
                    "<field name='display_name'/>" +
                "</group>" +
                "<notebook>" +
                    "<page string='Kikou'>" +
                        "<field name='id'/>" +
                    "</page>" +
                "</notebook>" +
            "</sheet>" +
        "</form>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].node.tag, 'page',
                        "a page should be added");
                    assert.strictEqual(args.operations[0].node.attrs.string, 'New Page',
                        "the string attribute should be set");
                    assert.strictEqual(args.operations[0].position, 'inside',
                        "a page should be added inside the notebook");
                    assert.strictEqual(args.operations[0].target.tag, 'notebook',
                        "the target should be the notebook in edit_view");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsN(vem, '.o_notebook li', 2,
            "there should be one existing page and a fake one");

        // click on existing tab
        var $page = vem.$('.o_notebook li:first');
        await testUtils.dom.click($page);
        assert.hasClass($page,'o_web_studio_clicked', "the page should be clickable");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_page',
            "the sidebar should now display the page properties");
        var $pageInput = vem.$('.o_web_studio_sidebar_content.o_display_page input[name="string"]');
        assert.strictEqual($pageInput.val(), "Kikou", "the page name in sidebar should be set");
        assert.strictEqual(vem.$('.o_web_studio_sidebar_content.o_display_page .o_groups .o_field_many2manytags').length, 1,
            "the groups should be editable for notebook pages");

        // add a new page
        await testUtils.dom.click(vem.$('.o_notebook li:eq(1) > a'));

        vem.destroy();
    });

    QUnit.test('label edition', async function (assert) {
        assert.expect(9);

        var arch = "<form>" +
            "<sheet>" +
                "<group>" +
                    "<label for='display_name' string='Kikou'/>" +
                    "<div><field name='display_name' nolabel='1'/></div>" +
                "</group>" +
                "<group>" +
                    "<field name='char_field'/>" +
                "</group>" +
            "</sheet>" +
        "</form>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0].target, {
                        tag: 'label',
                        attrs: {
                            for: 'display_name',
                        },
                    }, "the target should be set in edit_view");
                    assert.deepEqual(args.operations[0].new_attrs, {string: 'Yeah'},
                        "the string attribute should be set in edit_view");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        var $label = vem.$('.o_web_studio_form_view_editor label[data-node-id="1"]');
        assert.strictEqual($label.text(), "Kikou",
            "the label should be correctly set");

        await testUtils.dom.click($label);
        assert.hasClass($label,'o_web_studio_clicked', "the label should be clickable");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_label',
            "the sidebar should now display the label properties");
        var $labelInput = vem.$('.o_web_studio_sidebar_content.o_display_label input[name="string"]');
        assert.strictEqual($labelInput.val(), "Kikou", "the label name in sidebar should be set");
        await testUtils.fields.editAndTrigger($labelInput, 'Yeah', 'change');

        var $fieldLabel = vem.$('.o_web_studio_form_view_editor label:contains("A char")');
        assert.strictEqual($fieldLabel.length, 1, "there should be a label for the field");
        await testUtils.dom.click($fieldLabel);
        assert.doesNotHaveClass($fieldLabel, 'o_web_studio_clicked', "the field label should not be clickable");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");

        vem.destroy();
    });

    QUnit.test('add a statusbar', async function (assert) {
        assert.expect(8);

        var arch = "<form>" +
            "<sheet>" +
                "<group><field name='display_name'/></group>" +
            "</sheet>" +
        "</form>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations.length, 2,
                        "there should be 2 operations (one for statusbar and one for the new field");
                    assert.deepEqual(args.operations[0], {type: 'statusbar'});
                    assert.deepEqual(args.operations[1].target, {tag: 'header'},
                        "the target should be correctly set");
                    assert.strictEqual(args.operations[1].position, 'inside',
                        "the position should be correctly set");
                    assert.deepEqual(args.operations[1].node.attrs, {widget: 'statusbar', options: "{'clickable': '1'}"},
                        "the options should be correctly set");

                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        var $statusbar = vem.$('.o_web_studio_form_view_editor .o_web_studio_statusbar_hook');
        assert.deepEqual($statusbar.length, 1, "there should be a hook to add a statusbar");
        await testUtils.dom.click($statusbar);

        assert.deepEqual($('.o_web_studio_field_modal').length, 1,
            "a modal should be open to create the new selection field");
        assert.deepEqual($('.o_web_studio_selection_editor li').length, 3,
            "there should be 3 pre-filled values for the selection field");
        await testUtils.dom.click($('.modal-footer .btn-primary:first'));

        vem.destroy();
    });

    QUnit.test('move a field in form', async function (assert) {
        assert.expect(3);
        var arch = "<form>" +
            "<sheet>" +
                "<group>" +
                    "<field name='display_name'/>" +
                    "<field name='char_field'/>" +
                    "<field name='m2o'/>" +
                "</group>" +
            "</sheet>" +
        "</form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0], {
                        node: {
                            tag: 'field',
                            attrs: {name: 'm2o'},
                        },
                        position: 'before',
                        target: {
                            tag: 'field',
                            attrs: {name: 'display_name'},
                        },
                        type: 'move',
                    }, "the move operation should be correct");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = "<form>" +
                        "<sheet>" +
                            "<group>" +
                                "<field name='m2o'/>" +
                                "<field name='display_name'/>" +
                                "<field name='char_field'/>" +
                            "</group>" +
                        "</sheet>" +
                    "</form>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_form_sheet').text(), "Display NameA charM2O",
            "the moved field should be the first column");

        // move m2o before display_name
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_form_view_editor .ui-draggable:eq(2)'),
            vem.$('.o_group .o_web_studio_hook:first'));

        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_form_sheet').text(), "M2ODisplay NameA char",
            "the moved field should be the first column");

        vem.destroy();
    });

    QUnit.module('Kanban');

    QUnit.test('empty kanban editor', async function (assert) {
        assert.expect(4);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<kanban>" +
                    "<templates><t t-name='kanban-box'/></templates>" +
                "</kanban>",
        });

        assert.strictEqual(vem.view_type, 'kanban',
            "view type should be kanban");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor',
            "there should be a kanban editor");
        assert.containsNone(vem, '.o_web_studio_kanban_view_editor [data-node-id]',
            "there should be no node");
        assert.containsNone(vem, '.o_web_studio_kanban_view_editor .o_web_studio_hook',
            "there should be no hook");

        vem.destroy();
    });

    QUnit.test('kanban editor', async function (assert) {
        assert.expect(13);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<kanban>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div class='o_kanban_record'>" +
                                "<field name='display_name'/>" +
                            "</div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>",
        });

        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor [data-node-id]',
            "there should be one node");
        assert.hasClass(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'),'o_web_studio_widget_empty',
            "the empty node should have the empty class");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor .o_web_studio_hook',
            "there should be one hook");
        assert.containsOnce(vem, '.o_kanban_record .o_web_studio_add_kanban_tags',
            "there should be the hook for tags");
        assert.containsOnce(vem, '.o_kanban_record .o_web_studio_add_dropdown',
            "there should be the hook for dropdown");
        assert.containsOnce(vem, '.o_kanban_record .o_web_studio_add_priority',
            "there should be the hook for priority");
        assert.containsOnce(vem, '.o_kanban_record .o_web_studio_add_kanban_image',
            "there should be the hook for image");

        await testUtils.dom.click(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'));

        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_properties'),'active',
            "the Properties tab should now be active");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");
        assert.hasClass(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'),'o_web_studio_clicked',
            "the field should have the clicked style");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('select[name="widget"]').val(), "char",
            "the widget in sidebar should be set by default");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('select[name="display"]').val(), "false",
            "the display attribute should be Default");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('input[name="string"]').val(), "Display Name",
            "the field should have the label Display Name in the sidebar");

        vem.destroy();
    });

    QUnit.test('kanban editor with async widget', async function (assert) {
        var done = assert.async();
        assert.expect(7);

        var fieldDef = testUtils.makeTestPromise();
        var FieldChar = fieldRegistry.get('char');
        fieldRegistry.add('asyncwidget', FieldChar.extend({
            willStart: function () {
                return fieldDef;
            },
        }));

        var prom = studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<kanban>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div><field name='display_name' widget='asyncwidget'/></div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>",
        });

        assert.containsNone(document.body, '.o_web_studio_kanban_view_editor');
        fieldDef.resolve();

        prom.then(async function (vem) {
            assert.containsOnce(document.body, '.o_web_studio_kanban_view_editor');

            assert.containsOnce(vem, '.o_web_studio_kanban_view_editor [data-node-id]');
            assert.containsOnce(vem, '.o_web_studio_kanban_view_editor .o_web_studio_hook');

            await testUtils.dom.click(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'));

            assert.hasClass(vem.$('.o_web_studio_sidebar .o_web_studio_properties'), 'active');
            assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");
            assert.hasClass(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'), 'o_web_studio_clicked');

            vem.destroy();
            done();
        });
    });

    QUnit.test('kanban editor add priority', async function (assert) {
        assert.expect(3);
        var arch = "<kanban>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div class='o_kanban_record'>" +
                                "<field name='display_name'/>" +
                            "</div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>";
        var fieldsView;

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/get_default_value') {
                    return Promise.resolve({});
                }
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0], {
                        field: 'priority',
                        type: 'kanban_priority',
                    }, "Proper field name and operation type should be passed");
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            kanban: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsOnce(vem, '.o_kanban_record .o_web_studio_add_priority',
            "there should be the hook for priority");
        // click the 'Add a priority' link
        await testUtils.dom.click(vem.$('.o_kanban_record .o_web_studio_add_priority'));
        assert.strictEqual($('.modal .modal-body select > option[value="priority"]').length, 1,
            "there should be 'Priority' option with proper value set in Field selection drop-down ");
        // select priority field from the drop-down
        $('.modal .modal-body select > option[value="priority"]').prop('selected', true);
        // Click 'Confirm' Button
        await testUtils.dom.click($('.modal .modal-footer .btn-primary'));

        vem.destroy();
    });

    QUnit.test('kanban editor add image', async function (assert) {
        assert.expect(3);
        // We have to add relational model specifically named 'res.parter' or
        // 'res.users' because it is hard-coded in the kanban record editor.
        this.data['res.partner'] = {
            fields: {
                display_name: {type: "char", string: "Display Name"},
                image: {type: "binary", string: "Image"},
            },
            records: [{id: 1, display_name: 'Dustin', image:'D Artagnan'}],
        };

        this.data.coucou.fields.partner_id = {string: 'Res Partner', type: 'many2one', relation: 'res.partner'};
        this.data.coucou.records = [{id: 1, display_name:'Eleven', partner_id: 1}];


        var arch = "<kanban>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div class='o_kanban_record'>" +
                                "<field name='display_name'/>" +
                            "</div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>";
        var fieldsView;

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/get_default_value') {
                    return Promise.resolve({});
                }
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0], {
                        field: 'partner_id',
                        type: 'kanban_image',
                    }, "Proper field name and operation type should be passed");
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            kanban: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsOnce(vem, '.o_kanban_record .o_web_studio_add_kanban_image',
            "there should be the hook for Image");
        // click the 'Add a Image' link
        await testUtils.dom.click(vem.$('.o_kanban_record .o_web_studio_add_kanban_image'));
        assert.strictEqual($('.modal .modal-body select > option[value="partner_id"]').length, 1,
            "there should be 'Res Partner' option with proper value set in Field selection drop-down ");
        // Click 'Confirm' Button
        await testUtils.dom.click($('.modal .modal-footer .btn-primary'));

        vem.destroy();
    });

    QUnit.test('kanban editor with widget', async function (assert) {
        assert.expect(4);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<kanban>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div class='o_kanban_record'>" +
                                "<field name='display_name' widget='email'/>" +
                            "</div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>",
        });

        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor [data-node-id]',
            "there should be one node");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor .o_web_studio_hook',
            "there should be one hook");

        await testUtils.dom.click(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'));

        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('select[name="widget"]').val(), "email",
            "the widget in sidebar should be correctly set");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('input[name="string"]').val(), "Display Name",
            "the field should have the label Display Name in the sidebar");

        vem.destroy();
    });

    QUnit.test('grouped kanban editor', async function (assert) {
        assert.expect(4);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<kanban default_group_by='display_name'>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div class='o_kanban_record'>" +
                                "<field name='display_name'/>" +
                            "</div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>",
        });

        assert.hasClass(vem.$('.o_web_studio_kanban_view_editor'),'o_kanban_grouped',
            "the editor should be grouped");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor [data-node-id]',
            "there should be one node");
        assert.hasClass(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'),'o_web_studio_widget_empty',
            "the empty node should have the empty class");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor .o_web_studio_hook',
            "there should be one hook");

        vem.destroy();
    });

    QUnit.test('grouped kanban editor with record', async function (assert) {
        assert.expect(4);

        this.data.coucou.records = [{
            id: 1,
            display_name: 'coucou 1',
        }];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<kanban default_group_by='display_name'>" +
                    "<templates>" +
                        "<t t-name='kanban-box'>" +
                            "<div class='o_kanban_record'>" +
                                "<field name='display_name'/>" +
                            "</div>" +
                        "</t>" +
                    "</templates>" +
                "</kanban>",
        });

        assert.hasClass(vem.$('.o_web_studio_kanban_view_editor'),'o_kanban_grouped',
            "the editor should be grouped");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor [data-node-id]',
            "there should be one node");
        assert.doesNotHaveClass(vem.$('.o_web_studio_kanban_view_editor [data-node-id]'), 'o_web_studio_widget_empty',
            "the empty node should not have the empty class");
        assert.containsOnce(vem, '.o_web_studio_kanban_view_editor .o_web_studio_hook',
            "there should be one hook");

        vem.destroy();
    });

    QUnit.test('enable stages in kanban editor', async function (assert) {
        assert.expect(7);

        this.data.x_coucou_stage = {
            fields: {},
        };
        this.data.coucou.fields.x_stage_id = {type: 'many2one', relation: 'x_coucou_stage', string: 'Stage', store: true};

        var fieldsView;
        var nbEditView = 0;
        var arch =
            "<kanban>" +
                "<templates>" +
                    "<t t-name='kanban-box'>" +
                        "<div class='o_kanban_record'>" +
                            "<field name='display_name'/>" +
                        "</div>" +
                    "</t>" +
                "</templates>" +
            "</kanban>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            session: {
                user_context: {studio: 1},
            },
            mockRPC: function (route, args) {
                if (route === '/web_studio/create_stages_model') {
                    assert.strictEqual(args.model_name, 'coucou',
                        "should create the stages model for the current model");
                    assert.strictEqual(args.context.studio, 1,
                        "studio should be correctly set in the context");
                    return Promise.resolve();
                }
                if (route === '/web_studio/edit_view') {
                    nbEditView++;
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = "<kanban default_group_by='x_stage_id'>" +
                            "<templates>" +
                                "<field name='x_stage_id'/>" +
                                "<t t-name='kanban-box'>" +
                                    "<div class='o_kanban_record'>" +
                                        "<field name='display_name'/>" +
                                    "</div>" +
                                "</t>" +
                            "</templates>" +
                        "</kanban>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            kanban: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.hasAttrValue(vem.$('.o_web_studio_sidebar input[name="enable_stage"]'), 'checked', undefined,
            "the stages shouldn't be enabled");
        assert.strictEqual(vem.$('.o_web_studio_sidebar select[name="default_group_by"]').val(), "",
            "the kanban should not be grouped");

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar input[name="enable_stage"]'));

        assert.strictEqual(nbEditView, 2,
            "should edit the view twice: add field in view & set the default_group_by");

        assert.hasAttrValue(vem.$('.o_web_studio_sidebar input[name="enable_stage"]'), 'checked', 'checked',
            "the stages should be enabled");
        assert.strictEqual(vem.$('.o_web_studio_sidebar select[name="default_group_by"]').val(), "x_stage_id",
            "the kanban should be grouped by stage");

        vem.destroy();
    });


    QUnit.test('enable stages in kanban editor, existing field stage_id', async function (assert) {
        assert.expect(7);

        this.data.x_coucou_stage = {
            fields: {},
        };
        this.data.coucou.fields.stage_id = {type: 'many2one', relation: 'x_coucou_stage', string: 'Stage', store: true};

        var fieldsView;
        var nbEditView = 0;
        var arch =
            "<kanban>" +
                "<templates>" +
                    "<t t-name='kanban-box'>" +
                        "<div class='o_kanban_record'>" +
                            "<field name='display_name'/>" +
                        "</div>" +
                    "</t>" +
                "</templates>" +
            "</kanban>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            session: {
                user_context: {studio: 1},
            },
            mockRPC: function (route, args) {
                if (route === '/web_studio/create_stages_model') {
                    assert.strictEqual(args.model_name, 'coucou',
                        "should create the stages model for the current model");
                    assert.strictEqual(args.context.studio, 1,
                        "studio should be correctly set in the context");
                    return Promise.resolve();
                }
                if (route === '/web_studio/edit_view') {
                    nbEditView++;
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = "<kanban default_group_by='stage_id'>" +
                            "<templates>" +
                                "<field name='stage_id'/>" +
                                "<t t-name='kanban-box'>" +
                                    "<div class='o_kanban_record'>" +
                                        "<field name='display_name'/>" +
                                    "</div>" +
                                "</t>" +
                            "</templates>" +
                        "</kanban>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            kanban: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.strictEqual(vem.$('.o_web_studio_sidebar input[name="enable_stage"]').attr('checked'), undefined,
            "the stages shouldn't be enabled");
        assert.strictEqual(vem.$('.o_web_studio_sidebar select[name="default_group_by"]').val(), "",
            "the kanban should not be grouped");

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar input[name="enable_stage"]'));

        assert.strictEqual(nbEditView, 2,
            "should edit the view twice: add field in view & set the default_group_by");

        assert.strictEqual(vem.$('.o_web_studio_sidebar input[name="enable_stage"]').attr('checked'), 'checked',
            "the stages should be enabled");
        assert.strictEqual(vem.$('.o_web_studio_sidebar select[name="default_group_by"]').val(), "stage_id",
            "the kanban should be grouped by stage");

        vem.destroy();
    });

    QUnit.test('Remove a drop-down menu using kanban editor', async function (assert) {
        assert.expect(5);
        var arch =
            '<kanban>' +
                '<templates>' +
                    '<t t-name="kanban-box">' +
                        '<div>' +
                            '<div>' +
                                '<field name="display_name"/>' +
                            '</div>' +
                            '<div class="o_dropdown_kanban dropdown">' +
                                '<a class="dropdown-toggle o-no-caret btn" data-toggle="dropdown" href="#">' +
                                    '<span class="fa fa-bars fa-lg"/>' +
                                '</a>' +
                                '<div class="dropdown-menu" role="menu">' +
                                    '<a type="edit" class="dropdown-item">Edit</a>'+
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</t>' +
                '</templates>' +
            '</kanban>';
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].type, 'remove', 'Should have passed correct OP type');
                    assert.strictEqual(args.operations[0].target.tag, 'div', 'Should have correct target tag');
                    assert.deepEqual(args.operations[0].target.xpath_info, [
                        {tag: 'kanban', indice: 1},
                        {tag: 'templates', indice: 1},
                        {tag: 't', indice: 1},
                        {tag: 'div', indice: 1},
                        {tag: 'div', indice: 2}],
                        'Should have correct xpath_info as we do not have any tag identifier attribute on drop-down div'
                    );
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            kanban: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);
        assert.containsOnce(vem, '.o_dropdown_kanban', "there should be one dropdown node");
        await testUtils.dom.click(vem.$('.o_dropdown_kanban'));
        // remove drop-down from sidebar
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        assert.strictEqual($('.modal-body:first').text(), "Are you sure you want to remove this div from the view?",
            "should display the correct message");
        await testUtils.dom.click($('.modal .btn-primary'));
        vem.destroy();
    });

    QUnit.module('Search');

    QUnit.test('empty search editor', async function (assert) {
        assert.expect(6);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<search/>",
        });

        assert.strictEqual(vem.view_type, 'search',
            "view type should be search");
        assert.containsOnce(vem, '.o_web_studio_search_view_editor',
            "there should be a search editor");
        assert.containsOnce(vem, '.o_web_studio_search_autocompletion_fields.table tbody tr.o_web_studio_hook',
            "there should be one hook in the autocompletion fields");
        assert.containsOnce(vem, '.o_web_studio_search_filters.table tbody tr.o_web_studio_hook',
            "there should be one hook in the filters");
        assert.containsOnce(vem, '.o_web_studio_search_group_by.table tbody tr.o_web_studio_hook',
            "there should be one hook in the group by");
        assert.containsNone(vem, '.o_web_studio_search_view_editor [data-node-id]',
            "there should be no node");
        vem.destroy();
    });

    QUnit.test('search editor', async function (assert) {
        assert.expect(14);

        var arch = "<search>" +
                "<field name='display_name'/>" +
                "<filter string='My Name' " +
                    "name='my_name' " +
                    "domain='[(\"display_name\",\"=\",coucou)]'" +
                "/>" +
                "<group expand='0' string='Filters'>" +
                    "<filter string='My Name2' " +
                        "name='my_name2' " +
                        "domain='[(\"display_name\",\"=\",coucou2)]'" +
                    "/>" +
                "</group>" +
                "<group expand='0' string='Group By'>" +
                    "<filter name='groupby_display_name' " +
                    "domain='[]' context=\"{'group_by':'display_name'}\"/>" +
                "</group>" +
            "</search>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0].node.attrs, {name: 'display_name'},
                        "we should only specify the name (in attrs) when adding a field");
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            search: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        // try to add a field in the autocompletion section
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_existing_fields > .ui-draggable:first'), $('.o_web_studio_search_autocompletion_fields .o_web_studio_hook:first'));

        assert.strictEqual(vem.view_type, 'search',
            "view type should be search");
        assert.containsOnce(vem, '.o_web_studio_search_view_editor',
            "there should be a search editor");
        assert.containsN(vem, '.o_web_studio_search_autocompletion_fields.table tbody tr.o_web_studio_hook', 2,
            "there should be two hooks in the autocompletion fields");
        assert.containsN(vem, '.o_web_studio_search_filters.table tbody tr.o_web_studio_hook', 3,
            "there should be three hook in the filters");
        assert.containsN(vem, '.o_web_studio_search_group_by.table tbody tr.o_web_studio_hook', 2,
            "there should be two hooks in the group by");
        assert.containsOnce(vem, '.o_web_studio_search_autocompletion_fields.table [data-node-id]',
            "there should be 1 node in the autocompletion fields");
        assert.containsN(vem, '.o_web_studio_search_filters.table [data-node-id]', 2,
            "there should be 2 nodes in the filters");
        assert.containsOnce(vem, '.o_web_studio_search_group_by.table [data-node-id]',
            "there should be 1 nodes in the group by");
        assert.containsN(vem, '.o_web_studio_search_view_editor [data-node-id]', 4,
            "there should be 4 nodes");

        // edit the autocompletion field
        await testUtils.dom.click($('.o_web_studio_search_view_editor .o_web_studio_search_autocompletion_container [data-node-id]'));


        assert.hasClass(vem.$('.o_web_studio_sidebar').find('.o_web_studio_properties'),'active',
            "the Properties tab should now be active");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should now display the field properties");
        assert.hasClass(vem.$('.o_web_studio_search_view_editor .o_web_studio_search_autocompletion_container [data-node-id]'),'o_web_studio_clicked',
            "the field should have the clicked style");
        assert.strictEqual(vem.$('.o_web_studio_sidebar').find('input[name="string"]').val(), "Display Name",
            "the field should have the label Display Name in the sidebar");

        vem.destroy();
    });

    QUnit.test('delete a field', async function (assert) {
        assert.expect(3);

        var arch = "<search>" +
                "<field name='display_name'/>" +
            "</search>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    assert.deepEqual(args.operations[0], {
                        target: {
                            attrs: {name: 'display_name'},
                            tag: 'field',
                        },
                        type: 'remove',
                    });
                    fieldsView.arch = "<search/>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            search: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsOnce(vem, '[data-node-id]', "there should be one node");
        // edit the autocompletion field
        await testUtils.dom.click(vem.$('.o_web_studio_search_autocompletion_container [data-node-id]'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        await testUtils.dom.click($('.modal .btn-primary'));

        assert.containsNone(vem, '[data-node-id]', "there should be no node anymore");

        vem.destroy();
    });

    QUnit.module('Pivot');

    QUnit.test('empty pivot editor', async function (assert) {
        assert.expect(3);

        this.data.coucou.records = [{
            id: 1,
            display_name: 'coucou',
        }];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<pivot/>",
        });

        assert.strictEqual(vem.view_type, 'pivot',
            "view type should be pivot");
        assert.containsOnce(vem, '.o_web_studio_view_renderer .o_pivot',
            "there should be a pivot renderer");
        assert.containsOnce(vem, '.o_web_studio_view_renderer > .o_pivot > table',
            "the table should be the direct child of pivot");

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar_header [name="view"]'));

        vem.destroy();
    });

    QUnit.module('Graph');

    QUnit.test('empty graph editor', async function (assert) {
        var done = assert.async();
        assert.expect(3);

        this.data.coucou.records = [{
            id: 1,
            display_name: 'coucou',
        }];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<graph/>",
        });

        assert.strictEqual(vem.view_type, 'graph',
            "view type should be graph");
        return concurrency.delay(0).then(function () {
            assert.containsOnce(vem, '.o_web_studio_view_renderer .o_graph_controller');
            assert.containsOnce(vem, '.o_web_studio_view_renderer .o_graph_controller .o_graph_canvas_container canvas',
                "the graph should be a child of its container");
            vem.destroy();
            done();
        });
    });

    QUnit.module('Gantt');

    QUnit.test('empty gantt editor', async function(assert) {
        assert.expect(4);

        this.data.coucou.records = [];

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<gantt date_start='start' date_stop='stop'/>",
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].new_attrs.precision, '{"day":"hour:quarter"}',
                        "should correctly set the precision");
                        return Promise.resolve({
                            fields: fieldsView.fields,
                            fields_views: {
                                gantt: fieldsView,
                            }
                        });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        assert.strictEqual(vem.view_type, 'gantt',
            "view type should be gantt");
        assert.containsOnce(vem, '.o_web_studio_view_renderer .o_gantt_view',
            "there should be a gantt view");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_view select[name="precision_day"]',
            "it should be possible to edit the day precision");

        vem.$('.o_web_studio_sidebar_content.o_display_view select[name="precision_day"] option[value="hour:quarter"]').prop('selected', true).trigger('change');
        await testUtils.nextTick();

        vem.destroy();
    });

    QUnit.module('Others');

    QUnit.test('error during tree rendering: undo', async function (assert) {
        assert.expect(4);

        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='id'/></tree>",
            mockRPC: function (route) {
                if (route === '/web_studio/edit_view') {
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = "<tree><field name='id'/></tree>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        testUtils.mock.intercept(vem, 'studio_error', function (event) {
            assert.strictEqual(event.data.error, 'view_rendering',
                "should have raised an error");
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        // make the rendering crashes only the first time (the operation will
        // be undone and we will re-render with the old arch the second time)
        var oldRenderView = ListRenderer.prototype._renderView;
        var firstExecution = true;
        ListRenderer.prototype._renderView = function () {
            if (firstExecution) {
                firstExecution = false;
                throw "Error during rendering";
            } else {
                return oldRenderView.apply(this, arguments);
            }
        };

        // delete a field to generate a view edition
        await testUtils.dom.click(vem.$('.o_web_studio_list_view_editor [data-node-id]'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        await testUtils.dom.click($('.modal .btn-primary'));

        assert.strictEqual($('.o_web_studio_view_renderer').length, 1,
            "there should only be one renderer");
        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "the view should be back as normal with 1 field");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_view',
            "the sidebar should have reset to its default mode");

        ListRenderer.prototype._renderView = oldRenderView;

        vem.destroy();
    });

    QUnit.test('error in view edition: undo', async function (assert) {
        assert.expect(4);

        var firstExecution = true;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='id'/></tree>",
            mockRPC: function (route) {
                if (route === '/web_studio/edit_view') {
                    if (firstExecution) {
                        firstExecution = false;
                        // simulate a failed route
                        return Promise.reject();
                    } else {
                        // the server sends the arch in string but it's post-processed
                        // by the ViewEditorManager
                        fieldsView.arch = "<tree><field name='id'/></tree>";
                        return Promise.resolve({
                            fields: fieldsView.fields,
                            fields_views: {
                                list: fieldsView,
                            }
                        });
                    }
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        testUtils.mock.intercept(vem, 'studio_error', function (event) {
            assert.strictEqual(event.data.error, 'wrong_xpath',
                "should have raised an error");
        });

        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be one field in the view");

        // delete a field to generate a view edition
        await testUtils.dom.click(vem.$('.o_web_studio_list_view_editor [data-node-id]'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        await testUtils.dom.click($('.modal-dialog .btn-primary'));

        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "the view should be back as normal with 1 field");
        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_view',
            "the sidebar should have reset to its default mode");

        vem.destroy();
    });

    QUnit.test('add a monetary field without currency_id', async function (assert) {
        assert.expect(4);

        this.data.product.fields.monetary_field = {
            string: 'Monetary',
            type: 'monetary',
            searchable: true,
        };
        var arch = "<tree><field name='display_name'/></tree>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0].node.field_description, {
                        field_description: 'Currency',
                        model_name: 'coucou',
                        name: 'x_currency_id',
                        relation: 'res.currency',
                        type: 'many2one',
                    });
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);
        var currencyCreationText = "In order to use a monetary field, you need a currency field on the model. " +
            "Do you want to create a currency field first? You can make this field invisible afterwards.";

        // add a monetary field
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_monetary'), vem.$('th.o_web_studio_hook').first());
        assert.strictEqual($('.modal-body:first').text(), currencyCreationText, "this should trigger an alert");
        await testUtils.dom.click($('.modal-footer .btn:contains(Cancel)'));

        // add a related monetary field
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_related'), vem.$('th.o_web_studio_hook').first());
        assert.strictEqual($('.modal .o_field_selector').length, 1,
            "a modal with a field selector should be opened to selected the related field");
        $('.modal .o_field_selector').focusin(); // open the selector popover
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=m2o]'));
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=monetary_field]'));
        await testUtils.dom.click($('.modal-footer .btn-primary:first'));
        assert.strictEqual($('.modal-body:eq(1)').text(), currencyCreationText, "this should trigger an alert");
        await testUtils.dom.click($('.modal-footer:eq(1) .btn:contains(Ok)'));

        vem.destroy();
    });

    QUnit.test('add a monetary field with currency_id', async function (assert) {
        assert.expect(5);

        this.data.product.fields.monetary_field = {
            string: 'Monetary',
            type: 'monetary',
            searchable: true,
        };

        this.data.coucou.fields.x_currency_id = {
            string: "Currency",
            type: 'many2one',
            relation: "res.currency",
        };

        var arch = "<tree><field name='display_name'/></tree>";
        var fieldsView;
        var nbEdit = 0;

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route) {
                if (route === '/web_studio/edit_view') {
                    nbEdit++;
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        // add a monetary field
        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be one node");
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_monetary'), $('.o_web_studio_hook'));
        assert.strictEqual(nbEdit, 1, "the view should have been updated");
        assert.strictEqual($('.modal').length, 0, "there should be no modal");

        // add a related monetary field
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_related'), vem.$('th.o_web_studio_hook').first());
        assert.strictEqual($('.modal .o_field_selector').length, 1,
            "a modal with a field selector should be opened to selected the related field");
        $('.modal .o_field_selector').focusin(); // open the selector popover
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=m2o]'));
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=monetary_field]'));
        await testUtils.dom.click($('.modal-footer .btn-primary:first'));
        assert.strictEqual(nbEdit, 2, "the view should have been updated");

        vem.destroy();
    });

    QUnit.test('add a related field', async function (assert) {
        assert.expect(13);


        this.data.coucou.fields.related_field = {
            string: "Related",
            type: 'related',
        };

        var nbEdit = 0;
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name'/></tree>",
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    if (nbEdit === 0) {
                        assert.strictEqual(args.operations[0].node.field_description.related,
                            'm2o.display_name', "related arg should be correct");
                        fieldsView.arch = "<tree><field name='display_name'/><field name='related_field'/></tree>";
                    } else if (nbEdit === 1) {
                        assert.strictEqual(args.operations[1].node.field_description.related,
                            'm2o.m2o', "related arg should be correct");
                        assert.strictEqual(args.operations[1].node.field_description.relation,
                            'partner', "relation arg should be correct for m2o");
                    } else if (nbEdit === 2) {
                        assert.strictEqual(args.operations[2].node.field_description.related,
                            'm2o.partner_ids', "related arg should be correct");
                        assert.strictEqual(args.operations[2].node.field_description.relational_model,
                            'product', "relational model arg should be correct for o2m");
                    }
                    nbEdit++;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // listen to 'warning' events bubbling up
        testUtils.mock.intercept(vem, 'warning', assert.step.bind(assert, 'warning'));

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_related'), $('.o_web_studio_hook'));

        assert.strictEqual($('.modal').length, 1, "a modal should be displayed");

        // try to create an empty related field
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.verifySteps(['warning'], "should have triggered a warning");
        assert.strictEqual($('.modal').length, 1, "the modal should still be displayed");

        $('.modal .o_field_selector').focusin(); // open the selector popover
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=m2o]'));
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=display_name]'));
        await testUtils.dom.click($('.modal-footer .btn-primary:first'));

        // create a new many2one related field
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_related'), $('.o_web_studio_hook'));
        assert.strictEqual($('.modal').length, 1, "a modal should be displayed");
        $('.modal .o_field_selector').focusin(); // open the selector popover
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=m2o]'));
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=m2o]'));
        await testUtils.dom.click($('.modal .o_field_selector .o_field_selector_close'));
        await testUtils.dom.click($('.modal-footer .btn-primary:first'));

        // create a new one2many related field
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_related'), $('.o_web_studio_hook'));
        assert.strictEqual($('.modal').length, 1, "a modal should be displayed");
        $('.modal .o_field_selector').focusin(); // open the selector popover
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=m2o]'));
        await testUtils.dom.click($('.o_field_selector_popover li[data-name=partner_ids]'));
        await testUtils.dom.click($('.modal .o_field_selector .o_field_selector_close'));
        await testUtils.dom.click($('.modal-footer .btn-primary:first'));

        assert.strictEqual(nbEdit, 3, "should have edited the view");
        assert.verifySteps([], "should have triggered only one warning");

        vem.destroy();
    });

    QUnit.test('add a one2many field', async function (assert) {
        assert.expect(7);

        var arch = '<form><group>' +
                        '<field name="display_name"/>' +
                    '</group></form>';
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (args.method === 'name_search') {
                    return Promise.resolve([
                        [1, 'Field 1'],
                        [2, 'Field 2'],
                    ]);
                }
                if (route === '/web_studio/edit_view') {
                    assert.step('edit');
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        // listen to 'warning' events bubbling up
        testUtils.mock.intercept(vem, 'warning', assert.step.bind(assert, 'warning'));

        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_one2many'), $('.o_web_studio_hook'));
        assert.strictEqual($('.modal').length, 1, "a modal should be displayed");

        // try to confirm without specifying a related field
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.strictEqual($('.modal').length, 1, "the modal should still be displayed");
        assert.verifySteps(['warning'], "should have triggered a warning");

        // select a related field and confirm
        await testUtils.fields.many2one.clickOpenDropdown('field');
        await testUtils.fields.many2one.clickHighlightedItem('field');
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.strictEqual($('.modal').length, 0, "the modal should be closed");
        assert.verifySteps(['edit'], "should have created the field");

        vem.destroy();
    });

    QUnit.test('add a many2many field', async function (assert) {
        assert.expect(7);

        var arch = '<form><group>' +
                        '<field name="display_name"/>' +
                    '</group></form>';
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (args.method === 'name_search') {
                    return Promise.resolve([
                        [1, 'Model 1'],
                        [2, 'Model 2'],
                    ]);
                }
                if (route === '/web_studio/edit_view') {
                    assert.step('edit');
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        // listen to 'warning' events bubbling up
        testUtils.mock.intercept(vem, 'warning', assert.step.bind(assert, 'warning'));

        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_many2many'), $('.o_web_studio_hook'));
        assert.strictEqual($('.modal').length, 1, "a modal should be displayed");

        // try to confirm without specifying a relation
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.strictEqual($('.modal').length, 1, "the modal should still be displayed");
        assert.verifySteps(['warning'], "should have triggered a warning");

        // select a model and confirm
        await testUtils.fields.many2one.clickOpenDropdown('model');
        await testUtils.fields.many2one.clickHighlightedItem('model');
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.strictEqual($('.modal').length, 0, "the modal should be closed");
        assert.verifySteps(['edit'], "should have created the field");

        vem.destroy();
    });

    QUnit.test('add a many2one field', async function (assert) {
        assert.expect(7);

        var arch = '<form><group>' +
                        '<field name="display_name"/>' +
                    '</group></form>';
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (args.method === 'name_search') {
                    return Promise.resolve([
                        [1, 'Model 1'],
                        [2, 'Model 2'],
                    ]);
                }
                if (route === '/web_studio/edit_view') {
                    assert.step('edit');
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        // listen to 'warning' events bubbling up
        testUtils.mock.intercept(vem, 'warning', assert.step.bind(assert, 'warning'));

        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_many2one'), $('.o_web_studio_hook'));
        assert.strictEqual($('.modal').length, 1, "a modal should be displayed");

        // try to confirm without specifying a relation
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.strictEqual($('.modal').length, 1, "the modal should still be displayed");
        assert.verifySteps(['warning'], "should have triggered a warning");

        // select a model and confirm
        await testUtils.fields.many2one.clickOpenDropdown('model');
        await testUtils.fields.many2one.clickHighlightedItem('model');
        await testUtils.dom.click($('.modal button:contains("Confirm")'));
        assert.strictEqual($('.modal').length, 0, "the modal should be closed");
        assert.verifySteps(['edit'], "should have created the field");

        vem.destroy();
    });

    QUnit.test('switch mode after element removal', async function (assert) {
        assert.expect(5);

        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='id'/><field name='display_name'/></tree>",
            mockRPC: function (route) {
                if (route === '/web_studio/edit_view') {
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    assert.ok(true, "should edit the view to delete the field");
                    fieldsView.arch = "<tree><field name='display_name'/></tree>";
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.containsN(vem, '.o_web_studio_list_view_editor [data-node-id]', 2,
            "there should be two nodes");

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        await testUtils.dom.click(vem.$('.o_web_studio_list_view_editor [data-node-id]:first'));

        assert.containsOnce(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should display the field properties");

        // delete a field
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        await testUtils.dom.click($('.modal .btn-primary'));

        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be one node");
        assert.containsNone(vem, '.o_web_studio_sidebar_content.o_display_field',
            "the sidebar should have switched mode");

        vem.destroy();
    });

    QUnit.test('open XML editor in read-only', async function (assert) {
        assert.expect(5);
        var done = assert.async();

        // the XML editor button is only available in debug mode
        var initialDebugMode = config.debug;
        config.debug = true;

        // the XML editor lazy loads its libs and its templates so its start
        // method is monkey-patched to know when the widget has started
        var XMLEditorDef = testUtils.makeTestPromise();
        testUtils.mock.patch(ace, {
            start: function () {
                return this._super.apply(this, arguments).then(function () {
                    XMLEditorDef.resolve();
                });
            },
        });

        var arch = "<form><sheet><field name='display_name'/></sheet></form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_editor/get_assets_editor_resources') {
                    assert.strictEqual(args.key, 1, "the correct view should be fetched");
                    return Promise.resolve({
                        views: [{
                            active: true,
                            arch: arch,
                            id: 1,
                            inherit_id: false,
                        }],
                        scss: [],
                        js: [],
                    });
                }
                return this._super.apply(this, arguments);
            },
            viewID: 1,
        });

        assert.containsOnce(vem, '.o_web_studio_view_renderer .o_form_readonly.o_web_studio_form_view_editor',
            "the form editor should be displayed");

        // open the XML editor
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar_header [name="view"]'));
        assert.containsOnce(vem, '.o_web_studio_sidebar .o_web_studio_xml_editor',
            "there should be a button to open the XML editor");
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_xml_editor'));

        assert.strictEqual(vem.$('.o_web_studio_view_renderer .o_form_readonly:not(.o_web_studio_form_view_editor)').length, 1,
            "the form should be in read-only");

        XMLEditorDef.then(function () {
            assert.containsOnce(vem, '.o_ace_view_editor', "the XML editor should be opened");

            // restore monkey-patched elements
            config.debug = initialDebugMode;
            testUtils.mock.unpatch(ace);

            vem.destroy();
            done();
        });
    });

    QUnit.test('XML editor: reset operations stack', async function (assert) {
        assert.expect(6);
        var done = assert.async();

        // the XML editor button is only available in debug mode
        var initialDebugMode = config.debug;
        config.debug = true;

        // the XML editor lazy loads its libs and its templates so its start
        // method is monkey-patched to know when the widget has started
        var XMLEditorDef = testUtils.makeTestPromise();
        testUtils.mock.patch(ace, {
            start: function () {
                return this._super.apply(this, arguments).then(function () {
                    XMLEditorDef.resolve();
                });
            },
        });

        var arch = "<form><sheet><field name='display_name'/></sheet></form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        },
                        studio_view_id: 42,
                    });
                } else if (route === '/web_studio/edit_view_arch') {
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                } else if (route === '/web_editor/get_assets_editor_resources') {
                    assert.strictEqual(args.key, 1, "the correct view should be fetched");
                    return Promise.resolve({
                        views: [{
                            active: true,
                            arch: arch,
                            id: 1,
                            inherit_id: false,
                            name: "base view",
                        }, {
                            active: true,
                            arch: "<data/>",
                            id: 42,
                            inherit_id: 1,
                            name: "studio view",
                        }],
                        scss: [],
                        js: [],
                    });
                }
                return this._super.apply(this, arguments);
            },
            viewID: 1,
            studioViewID: 42,
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);
        assert.containsOnce(vem, '.o_web_studio_form_view_editor',
            "the form editor should be displayed");
        // do an operation
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_widget[name="display_name"]'));
        await testUtils.fields.editAndTrigger(vem.$('.o_web_studio_sidebar input[name="string"]'), 'Kikou', 'change');
        assert.strictEqual(vem.operations.length, 1,
            "there should be one operation in the stack (label rename)");

        // open the XML editor
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar_header [name="view"]'));
        assert.containsOnce(vem, '.o_web_studio_sidebar .o_web_studio_xml_editor',
            "there should be a button to open the XML editor");
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_xml_editor'));

        XMLEditorDef.then(async function () {
            assert.containsOnce(vem, '.o_ace_view_editor', "the XML editor should be opened");

            // the ace editor is too complicated to mimick so call the handler directly
            await vem.XMLEditor._saveView({
                id: 42,
                text: "<data></data>",
            });
            assert.strictEqual(vem.operations.length, 0,
                "the operation stack should be reset");

            // restore monkey-patched elements
            config.debug = initialDebugMode;
            testUtils.mock.unpatch(ace);

            vem.destroy();
            done();
        });
    });

    QUnit.test('new button in buttonbox', async function (assert) {
        assert.expect(4);

        var arch = "<form><sheet><field name='display_name'/></sheet></form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
        });

        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_web_studio_button_hook'));

        assert.strictEqual($('.modal:visible').length, 1, "there should be one modal");
        assert.strictEqual($('.o_web_studio_new_button_dialog').length, 1,
            "there should be a modal to create a button in the buttonbox");
        assert.strictEqual($('.o_web_studio_new_button_dialog .o_field_many2one').length, 1,
            "there should be a many2one for the related field");

        $('.o_web_studio_new_button_dialog .o_field_many2one input').focus();
        await testUtils.fields.editAndTrigger($('.o_web_studio_new_button_dialog .o_field_many2one input'), 'test', ['keyup', 'focusout']);

        assert.strictEqual($('.modal:visible').length, 1, "should not display the create modal");

        vem.destroy();
    });

    QUnit.test('element removal', async function (assert) {
        assert.expect(10);

        var editViewCount = 0;
        var arch = "<form><sheet>" +
                "<group>" +
                    "<field name='display_name'/>" +
                    "<field name='m2o'/>" +
                "</group>" +
                "<notebook><page name='page'><field name='id'/></page></notebook>" +
            "</sheet></form>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    editViewCount++;
                    if (editViewCount === 1) {
                        assert.strictEqual(_.has(args.operations[0].target, 'xpath_info'), false,
                            'should not give xpath_info if we have the tag identifier attributes');
                    } else if (editViewCount === 2) {
                        assert.strictEqual(_.has(args.operations[1].target, 'xpath_info'), false,
                            'should not give xpath_info if we have the tag identifier attributes');
                    } else if (editViewCount === 3) {
                        assert.strictEqual(args.operations[2].target.tag, 'group',
                            'should compute correctly the parent node for the group');
                    } else if (editViewCount === 4) {
                        assert.strictEqual(args.operations[3].target.tag, 'notebook',
                            'should delete the notebook because the last page is deleted');
                        assert.strictEqual(_.last(args.operations[3].target.xpath_info).tag, 'notebook',
                            'should have the notebook as xpath last element');
                    }
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        // remove field
        await testUtils.dom.click(vem.$('[name="display_name"]').parent());
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        assert.strictEqual($('.modal-body:first').text(), "Are you sure you want to remove this field from the view?",
            "should display the correct message");
        await testUtils.dom.click($('.modal .btn-primary'));

        // remove other field so group is empty
        await testUtils.dom.click(vem.$('[name="m2o"]').parent());
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        assert.strictEqual($('.modal-body:first').text(), "Are you sure you want to remove this field from the view?",
            "should display the correct message");
        await testUtils.dom.click($('.modal .btn-primary'));

        // remove group
        await testUtils.dom.click(vem.$('.o_group[data-node-id]'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        assert.strictEqual($('.modal-body:first').text(), "Are you sure you want to remove this group from the view?",
            "should display the correct message");
        await testUtils.dom.click($('.modal .btn-primary'));

        // remove page
        await testUtils.dom.click(vem.$('.o_notebook li[data-node-id]'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_remove'));
        assert.strictEqual($('.modal-body:first').text(), "Are you sure you want to remove this page from the view?",
            "should display the correct message");
        await testUtils.dom.click($('.modal .btn-primary'));

        assert.strictEqual(editViewCount, 4,
            "should have edit the view 4 times");
        vem.destroy();
    });

    QUnit.test('update sidebar after edition', async function (assert) {
        assert.expect(4);

        var editViewCount = 0;
        var arch = "<form><sheet>" +
                "<group>" +
                    "<field name='display_name'/>" +
                "</group>" +
                "<notebook><page><field name='id'/></page></notebook>" +
            "</sheet></form>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route) {
                if (route === '/web_studio/edit_view') {
                    editViewCount++;
                    // the server sends the arch in string but it's post-processed
                    // by the ViewEditorManager
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        testUtils.mock.intercept(vem, 'node_clicked', function (event) {
            assert.step(event.data.node.tag);
        }, true);

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        // rename field
        await testUtils.dom.click(vem.$('[name="display_name"]').parent());
        vem.$('.o_web_studio_sidebar [name="string"]').focus();
        await testUtils.fields.editAndTrigger(vem.$('.o_web_studio_sidebar [name="string"]'), 'test', 'change');

        assert.strictEqual(editViewCount, 1,
            "should have edit the view 1 time");
        assert.verifySteps(['field', 'field'],
            "should have clicked again on the node after edition to reload the sidebar");

        vem.destroy();
    });

    QUnit.test('default value in sidebar', async function (assert) {
        assert.expect(2);

        var arch = "<form><sheet>" +
                "<group>" +
                    "<field name='display_name'/>" +
                    "<field name='priority'/>" +
                "</group>" +
            "</sheet></form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/get_default_value') {
                    if (args.field_name === 'display_name') {
                        return Promise.resolve({default_value: 'yolo'});
                    } else if (args.field_name === 'priority') {
                        return Promise.resolve({default_value: '1'});
                    }
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(vem.$('[name="display_name"]').parent());
        assert.strictEqual(vem.$('.o_web_studio_sidebar_content.o_display_field input[data-type="default_value"]').val(), "yolo",
            "the sidebar should now display the field properties");

        await testUtils.dom.click(vem.$('[name="priority"]').parent());
        assert.strictEqual(vem.$('.o_web_studio_sidebar_content.o_display_field select[data-type="default_value"]').val(), "1",
            "the sidebar should now display the field properties");

        vem.destroy();
    });

    QUnit.test('notebook and group not drag and drop in a group', async function (assert) {
        assert.expect(2);
        var editViewCount = 0;
        var arch = "<form><sheet>" +
                "<group>" +
                    "<group>" +
                        "<field name='display_name'/>" +
                    "</group>" +
                    "<group>" +
                    "</group>" +
                "</group>" +
            "</sheet></form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route) {
                if (route === '/web_studio/edit_view') {
                    editViewCount++;
                }
                return this._super.apply(this, arguments);
            },
        });
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_field_type_container .o_web_studio_field_tabs'), $('.o_group .o_web_studio_hook'));
        assert.strictEqual(editViewCount, 0,
            "the notebook cannot be dropped inside a group");
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_field_type_container .o_web_studio_field_columns'), $('.o_group .o_web_studio_hook'));
        assert.strictEqual(editViewCount, 0,
            "the group cannot be dropped inside a group");
        vem.destroy();
    });

    QUnit.test('drop monetary field outside of group', async function (assert) {
        assert.expect(1);

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form><sheet/></form>",
        });

        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_monetary'), $('.o_web_studio_hook'), {disableDrop: true});
        assert.containsNone(vem, '.o_web_studio_nearest_hook', "There should be no highlighted hook");

        vem.destroy();
    });

    QUnit.test('add a selection field', async function (assert) {
        assert.expect(16);

        var fieldsView;
        var arch = "<tree><field name='display_name'/></tree>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].node.field_description.selection,
                        "[[\"Value 2\",\"Value 2\"],[\"Value 1\",\"My Value\"]]",
                        "the selection should be set");
                    assert.ok(true, "should have refreshed the view");
                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_selection'), $('.o_web_studio_hook:first'));
        assert.strictEqual($('.modal .o_web_studio_field_dialog_form').length, 1, "a modal should be opened");
        assert.strictEqual($('.modal .o_web_studio_selection_editor').length, 0, "there should be no selection editor");

        // add a new value (with ENTER)
        $('.modal .o_web_studio_selection_new_value input')
            .val('Value 1')
            .trigger($.Event('keyup', {which: $.ui.keyCode.ENTER}));
        await testUtils.nextTick();
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li').length, 1, "there should be 1 selection value");
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li span:contains(Value 1)').length, 1, "the value should be correctly set");

        // add a new value (with button +)
        $('.modal .o_web_studio_selection_new_value input').val('Value 2');
        await testUtils.dom.click($('.modal .o_web_studio_selection_new_value button'));
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li').length, 2, "there should be 2 selection values");

        // edit the first value
        await testUtils.dom.click($('.modal .o_web_studio_selection_editor li:first .o_web_studio_edit_selection_value'));
        assert.strictEqual($('.modal').length, 2, "a new modal should be opened");
        assert.strictEqual($('.modal:eq(1) input#o_selection_label').val(), "Value 1",
            "the value should be set in the edition modal");
        $('.modal:eq(1) input#o_selection_label').val('My Value');
        await testUtils.dom.click($('.modal:eq(1) button:contains(Confirm)'));
        assert.strictEqual($('.modal').length, 1, "the second modal should be closed");
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li:first span:contains(My Value)').length, 1, "the value should have been updated");

        // add a value and delete it
        $('.modal .o_web_studio_selection_new_value input').val('Value 3');
        await testUtils.dom.click($('.modal .o_web_studio_selection_new_value button'));
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li').length, 3, "there should be 3 selection values");

        await testUtils.dom.click($('.modal .o_web_studio_selection_editor > li:eq(2) .o_web_studio_remove_selection_value'));
        assert.strictEqual($('.modal').length, 2, "a new confirmation modal should be opened");
        await testUtils.dom.click($('.modal:eq(1) button:contains(Ok)'));
        assert.strictEqual($('.modal').length, 1, "the confirmation modal should be closed");
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li').length, 2, "there should be 2 selection values");

        // reorder values
        await testUtils.dom.dragAndDrop(
            $('.modal .ui-sortable-handle').eq(1),
            $('.modal .o_web_studio_selection_editor > li').first(),
            {position: 'top'});
        assert.strictEqual($('.modal .o_web_studio_selection_editor > li:first span:contains(Value 2)').length, 1, "the values should have been reordered");

        await testUtils.dom.click($('.modal button:contains(Confirm)'));
        vem.destroy();
    });

    QUnit.test('add a selection field with widget priority', async function (assert) {
        assert.expect(5);

        var arch = "<tree><field name='display_name'/></tree>";
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.strictEqual(args.operations[0].node.field_description.type, "selection",
                        "the type should be correctly set");
                    assert.deepEqual(args.operations[0].node.field_description.selection, [['0','Normal'], ['1','Low'], ['2','High'], ['3','Very High']],
                        "the selection should be correctly set");
                    assert.strictEqual(args.operations[0].node.attrs.widget, "priority",
                        "the widget should be correctly set");

                    fieldsView.arch = arch;
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            list: fieldsView,
                        }
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);

        assert.containsOnce(vem, '.o_web_studio_list_view_editor [data-node-id]',
            "there should be one node");
        // add a priority field
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_priority'), $('.o_web_studio_hook'));

        assert.strictEqual($('.modal').length, 0, "there should be no modal");

        vem.destroy();
    });

    QUnit.test('blockUI not removed just after rename', async function (assert) {
        assert.expect(13);
        // renaming is only available in debug mode
        var initialDebugMode = config.debug;
        config.debug = true;

        var blockUI = framework.blockUI;
        var unblockUI = framework.unblockUI;
        framework.blockUI = function () {
            assert.step('block UI');
        };
        framework.unblockUI = function () {
            assert.step('unblock UI');
        };

        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<tree><field name='display_name'/></tree>",
            mockRPC: function(route, args) {
                assert.step(route);
                if (route === '/web_studio/edit_view') {
                    var fieldName = args.operations[0].node.field_description.name;
                    fieldsView.arch = `<tree><field name='${fieldName}'/><field name='display_name'/></tree>`;
                    fieldsView.fields[fieldName] = {
                        string: "Coucou",
                        type: "char"
                    };
                    return Promise.resolve({
                        fields_views: {list: fieldsView},
                        fields: fieldsView.fields,
                    });
                } else if (route === '/web_studio/rename_field') {
                    return Promise.resolve();
                }
                return this._super.apply(this, arguments);
            }
        });

        assert.strictEqual(vem.$('thead th[data-node-id]').length, 1, "there should be one field");

        // create a new field before existing one
        fieldsView = $.extend(true, {}, vem.fields_view);
        testUtils.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_char'), vem.$('.o_web_studio_hook:first'));
        await testUtils.nextTick();
        assert.strictEqual(vem.$('thead th[data-node-id]').length, 2, "there should be two fields");

        // rename the field
        await testUtils.dom.click(vem.$('thead th[data-node-id=1]'));
        await testUtils.fields.editAndTrigger(vem.$('.o_web_studio_sidebar input[name="name"]'), 'new', ['change']);

        assert.verifySteps([
            '/web/dataset/search_read',
            '/web_studio/edit_view',
            '/web/dataset/search_read',
            '/web_studio/get_default_value',
            'block UI',
            '/web_studio/rename_field',
            '/web_studio/edit_view',
            '/web/dataset/search_read',
            '/web_studio/get_default_value',
            'unblock UI',
        ]);

        vem.destroy();

        framework.blockUI = blockUI;
        framework.unblockUI = unblockUI;
        config.debug = initialDebugMode;
    });

    QUnit.module('X2Many');

    QUnit.test('display one2many without inline views', async function (assert) {
        assert.expect(1);

        var vem = await studioTestUtils.createViewEditorManager({
            arch: "<form>" +
                "<sheet>" +
                    "<field name='display_name'/>" +
                    "<field name='product_ids'/>" +
                "</sheet>" +
            "</form>",
            model: "coucou",
            data: this.data,
            archs: {
                "product,false,list": '<tree><field name="display_name"/></tree>'
            },
        });
        var $one2many = vem.$('.o_field_one2many.o_field_widget');
        assert.strictEqual($one2many.children().length, 2,
            "The one2many widget should be displayed");

        // TODO: mock loadViews(?) to add a `name` (this is the way Studio
        // detects if the view is inline or not) and check if create_inline_view
        // is correctly called

        vem.destroy();
    });

    QUnit.test('edit one2many list view', async function (assert) {
        assert.expect(9);

        // the 'More' button is only available in debug mode
        var initialDebugMode = config.debug;
        config.debug = true;

        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            arch: "<form>" +
                "<sheet>" +
                    "<field name='display_name'/>" +
                    "<field name='product_ids'>" +
                        "<tree><field name='display_name'/></tree>" +
                    "</field>" +
                "</sheet>" +
            "</form>",
            model: "coucou",
            data: this.data,
            mockRPC: function (route, args) {
                if (route === '/web_studio/get_default_value') {
                    assert.step(args.model_name);
                    return Promise.resolve({});
                }
                if (args.method === 'search_read' && args.model === 'ir.model.fields') {
                    assert.deepEqual(args.kwargs.domain, [['model', '=', 'product'], ['name', '=', 'coucou_id']],
                        "the model should be correctly set when editing field properties");
                    return Promise.resolve([]);
                }
                if (route === '/web_studio/edit_view') {
                    // We need to create the fieldsView here because the fieldsViewGet in studio
                    // has a specific behaviour so cannot use the mock server fieldsViewGet
                    assert.ok(true, "should edit the view to add the one2many field");
                    fieldsView = {};
                    fieldsView.arch = "<form>" +
                    "<sheet>" +
                        "<field name='display_name'/>" +
                        "<field name='product_ids'>" +
                            "<tree><field name='coucou_id'/><field name='display_name'/></tree>" +
                        "</field>" +
                    "</sheet>" +
                    "</form>";
                    fieldsView.model = "coucou";
                    fieldsView.fields = {
                        display_name: {
                            string: "Display Name",
                            type: "char",
                        },
                        product_ids: {
                            string: "product",
                            type: "one2many",
                            relation: "product",
                            views: {
                                list: {
                                    arch: "<tree><field name='coucou_id'/><field name='display_name'/></tree>",
                                    fields: {
                                        coucou_id: {
                                            string: "coucou",
                                            type: "many2one",
                                            relation: "coucou",
                                        },
                                        display_name: {
                                            string: "Display Name",
                                            type: "char",
                                        },
                                    },
                                },
                            },
                        }
                    };
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        await testUtils.dom.click(vem.$('.o_web_studio_view_renderer .o_field_one2many'));
        assert.verifySteps(['coucou']);
        await testUtils.dom.click($(vem.$('.o_web_studio_view_renderer .o_field_one2many .o_web_studio_editX2Many')[0]));
        assert.containsOnce(vem, '.o_web_studio_view_renderer thead tr [data-node-id]',
            "there should be 1 nodes in the x2m editor.");
        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_existing_fields .o_web_studio_field_many2one'), $('.o_web_studio_hook'));
        assert.containsN(vem, '.o_web_studio_view_renderer thead tr [data-node-id]', 2,
            "there should be 2 nodes after the drag and drop.");

        // click on a field in the x2m list view
        await testUtils.dom.click(vem.$('.o_web_studio_view_renderer [data-node-id]:first'));
        assert.verifySteps(['product'], "the model should be the x2m relation");

        // edit field properties
        assert.containsOnce(vem, '.o_web_studio_sidebar .o_web_studio_parameters',
            "there should be button to edit the field properties");
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar .o_web_studio_parameters'));

        config.debug = initialDebugMode;
        vem.destroy();
    });

    QUnit.test('edit one2many form view (2 level) and check chatter allowed', async function (assert) {
        assert.expect(6);
        this.data.coucou.records = [{
            id: 11,
            display_name: 'Coucou 11',
            product_ids: [37],
        }];
        var fieldsView;
        var vem = await studioTestUtils.createViewEditorManager({
            arch: "<form>" +
                "<sheet>" +
                    "<field name='display_name'/>" +
                    "<field name='product_ids'>" +
                        "<form>" +
                            "<sheet>" +
                                "<group>" +
                                    "<field name='partner_ids'>" +
                                        "<form><sheet><group><field name='display_name'/></group></sheet></form>" +
                                    "</field>" +
                                "</group>" +
                            "</sheet>" +
                        "</form>" +
                    "</field>" +
                "</sheet>" +
            "</form>",
            model: "coucou",
            data: this.data,
            res_id: 11,
            archs: {
                "product,false,list": "<tree><field name='display_name'/></tree>",
                "partner,false,list": "<tree><field name='display_name'/></tree>",
            },
            chatter_allowed: true,
            mockRPC: function (route, args) {
                if (args.method === 'name_search' && args.model === 'ir.model.fields') {
                    assert.deepEqual(args.kwargs.args, [['relation', '=', 'partner'], ['ttype', '=', 'many2one'], ['store', '=', true]],
                        "the domain should be correctly set when searching for a related field for new button");
                    return Promise.resolve([]);
                }
                if (route === '/web_studio/edit_view') {
                    // We need to create the fieldsView here because the fieldsViewGet in studio
                    // has a specific behaviour so cannot use the mock server fieldsViewGet
                    assert.ok(true, "should edit the view to add the one2many field");
                    fieldsView.arch = "<form>" +
                        "<sheet>" +
                            "<field name='display_name'/>" +
                            "<field name='product_ids'/>" +
                        "</sheet>" +
                    "</form>";
                    fieldsView.fields.product_ids.views = {
                        form: {
                            arch: "<form><sheet><group><field name='partner_ids'/></group></sheet></form>",
                            fields: {
                                partner_ids: {
                                    string: "partners",
                                    type: "one2many",
                                    relation: "partner",
                                    views: {
                                        form: {
                                            arch: "<form><sheet><group><field name='display_name'/></group></sheet></form>",
                                            fields: {
                                                display_name: {
                                                    string: "Display Name",
                                                    type: "char",
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    };
                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });
        assert.containsOnce(vem, '.o_web_studio_add_chatter',
            "should be possible to add a chatter");
        await testUtils.dom.click(vem.$('.o_web_studio_view_renderer .o_field_one2many'));
        await testUtils.dom.click($(vem.$('.o_web_studio_view_renderer .o_field_one2many .o_web_studio_editX2Many[data-type="form"]')));
        assert.containsNone(vem, '.o_web_studio_add_chatter',
            "should not be possible to add a chatter");
        await testUtils.dom.click(vem.$('.o_web_studio_view_renderer .o_field_one2many'));
        await testUtils.dom.click($(vem.$('.o_web_studio_view_renderer .o_field_one2many .o_web_studio_editX2Many[data-type="form"]')));
        // used to generate the new fields view in mockRPC
        fieldsView = $.extend(true, {}, vem.fields_view);
        assert.strictEqual(vem.$('.o_field_char').eq(0).text(), 'jean',
            "the partner view form should be displayed.");
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_new_fields .o_web_studio_field_char'), vem.$('.o_group .o_web_studio_hook:first'));

        // add a new button
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_web_studio_button_hook'));
        assert.strictEqual($('.modal .o_web_studio_new_button_dialog').length, 1,
            "there should be an opened modal to add a button");
        await testUtils.dom.click($('.modal .o_web_studio_new_button_dialog .js_many2one_field input'));

        vem.destroy();
    });

    QUnit.test('edit one2many list view that uses parent key', async function (assert) {
        assert.expect(3);

        this.data.coucou.records = [{
            id: 11,
            display_name: 'Coucou 11',
            product_ids: [37],
        }];

        var vem = await studioTestUtils.createViewEditorManager({
            arch: "<form>" +
                "<sheet>" +
                    "<field name='display_name'/>" +
                    "<field name='product_ids'>" +
                        "<form>" +
                            "<sheet>" +
                                "<field name='m2o'" +
                                " attrs=\"{'invisible': [('parent.display_name', '=', 'coucou')]}\"" +
                                " domain=\"[('display_name', '=', parent.display_name)]\"/>" +
                            "</sheet>" +
                        "</form>" +
                    "</field>" +
                "</sheet>" +
            "</form>",
            model: "coucou",
            data: this.data,
            res_id: 11,
            archs: {
                "product,false,list": '<tree><field name="display_name"/></tree>'
            },
        });

        // edit the x2m form view
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_one2many'));
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_one2many .o_web_studio_editX2Many[data-type="form"]'));
        assert.strictEqual(vem.$('.o_web_studio_form_view_editor .o_field_widget[name="m2o"]').text(), "jacques",
            "the x2m form view should be correctly rendered");
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_widget[name="m2o"]'));

        // open the domain editor
        assert.strictEqual($('.modal .o_domain_selector').length, 0,
            "the domain selector should not be opened");
        vem.$('.o_web_studio_sidebar_content input[name="domain"]').trigger('focusin');
        await testUtils.nextTick();
        assert.strictEqual($('.modal .o_domain_selector').length, 1,
            "the domain selector should be correctly opened");

        vem.destroy();
    });

    QUnit.test('move a field in one2many list', async function (assert) {
        assert.expect(2);

        this.data.coucou.records = [{
            id: 11,
            display_name: 'Coucou 11',
            product_ids: [37],
        }];

        var arch = "<form>" +
                "<sheet>" +
                    "<field name='display_name'/>" +
                    "<field name='product_ids'>" +
                        "<tree>" +
                            "<field name='m2o'/>" +
                            "<field name='coucou_id'/>" +
                        "</tree>" +
                    "</field>" +
                "</sheet>" +
            "</form>";
        var vem = await studioTestUtils.createViewEditorManager({
            arch: arch,
            data: this.data,
            model: 'coucou',
            res_id: 11,
            mockRPC: function (route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.deepEqual(args.operations[0], {
                        node: {
                            tag: 'field',
                            attrs: {name: 'coucou_id'},
                            subview_xpath: "//field[@name='product_ids']//tree",
                        },
                        position: 'before',
                        target: {
                            tag: 'field',
                            attrs: {name: 'm2o'},
                            subview_xpath: "//field[@name='product_ids']//tree",
                        },
                        type: 'move',
                    }, "the move operation should be correct");

                    // We need to create the fieldsView here because the
                    // fieldsViewGet in studio has a specific behaviour so
                    // cannot use the mock server fieldsViewGet
                    fieldsView.arch = arch;
                    fieldsView.fields.product_ids.views = {
                        list: {
                            arch: "<tree>" +
                                "<field name='m2o'/>" +
                                "<field name='coucou_id'/>" +
                            "</tree>",
                            fields: {
                                m2o: {
                                    type: "many2one",
                                    relation: "coucou",
                                },
                                coucou_id: {
                                    type: "many2one",
                                    relation: "coucou",
                                },
                            },
                        },
                    };

                    return Promise.resolve({
                        fields: fieldsView.fields,
                        fields_views: {
                            form: fieldsView,
                        },
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        // used to generate the new fields view in mockRPC
        var fieldsView = $.extend(true, {}, vem.fields_view);

        // edit the x2m form view
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_one2many'));
        await testUtils.dom.click(vem.$('.o_web_studio_form_view_editor .o_field_one2many .o_web_studio_editX2Many[data-type="list"]'));

        assert.strictEqual(vem.$('.o_web_studio_list_view_editor th').text(), "M2Ocoucou",
            "the columns should be in the correct order");

        // move coucou at index 0
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_list_view_editor th:contains(coucou)'),
            vem.$('th.o_web_studio_hook:first'));

        vem.destroy();
    });

    QUnit.test('notebook and group drag and drop after a group', async function (assert) {
        assert.expect(2);
        var arch = "<form><sheet>" +
                "<group>" +
                    "<field name='display_name'/>" +
                "</group>" +
            "</sheet></form>";
        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: arch,
        });
        var $afterGroupHook = vem.$('.o_form_sheet > .o_web_studio_hook');
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_field_type_container .o_web_studio_field_tabs'),
            $afterGroupHook, {disableDrop: true});
        assert.containsOnce(vem, '.o_web_studio_nearest_hook', "There should be 1 highlighted hook");
        await testUtils.dom.dragAndDrop(vem.$('.o_web_studio_field_type_container .o_web_studio_field_columns'),
            $afterGroupHook, {disableDrop: true});
        assert.containsOnce(vem, '.o_web_studio_nearest_hook', "There should be 1 highlighted hook");
        vem.destroy();
    });

    QUnit.test('One2Many list editor column_invisible in attrs ', async function (assert) {
        assert.expect(2);

        var fieldsView;

        var productArchReturn = '<tree>' +
                                    '<field name="display_name" attrs="{&quot;column_invisible&quot;: [[&quot;parent.id&quot;,&quot;=&quot;,false]]}" readonly="1" modifiers="{&quot;column_invisible&quot;: [[&quot;parent.id&quot;, &quot;=&quot;, false]], &quot;readonly&quot;: true}"/>' +
                                '</tree>';

        var coucouArchReturn = '<form>' +
                                    '<field name="product_ids">' +
                                        productArchReturn +
                                    '</field>' +
                                '</form>';


        var coucouFields = {product_ids: {
                                string: "product",
                                type: "one2many",
                                relation: "product",
                                views: {
                                    list: {
                                        arch: productArchReturn,
                                        fields: {
                                            display_name: {
                                                string: "Display Name",
                                                type: "char",
                                            },
                                        },
                                    },
                                },
                            }
                        };

        var vem = await studioTestUtils.createViewEditorManager({
            data: this.data,
            model: 'coucou',
            arch: "<form>" +
                    "<field name='product_ids'>" +
                        "<tree>" +
                            '<field name="display_name" attrs="{\'column_invisible\': [(\'parent.id\', \'=\',False)]}" />' +
                        "</tree>" +
                    "</field>" +
                  "</form>",
            mockRPC: function(route, args) {
                if (route === '/web_studio/edit_view') {
                    assert.equal(args.operations[0].new_attrs.attrs, '{"column_invisible": [["parent.id","=",False]]}',
                        'we should send "column_invisible" in attrs.attrs');

                    assert.equal(args.operations[0].new_attrs.readonly, '1',
                        'We should send "readonly" in the node attr');

                    fieldsView.arch = coucouArchReturn;
                    $.extend(fieldsView.fields, coucouFields);
                    return Promise.resolve({
                        fields_views: {form: fieldsView},
                        fields: fieldsView.fields,
                    });
                }
                return this._super.apply(this, arguments);
            }
        });
        fieldsView = $.extend(true, {}, vem.fields_view);

        // Enter edit mode of the O2M
        await testUtils.dom.click(vem.$('.o_field_x2many_list[name=product_ids]'));
        await testUtils.dom.click(vem.$('.o_web_studio_editX2Many[data-type="list"]'));

        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('.o_web_studio_view'));
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#show_invisible'));

        // select the first column
        await testUtils.dom.click(vem.$('thead th[data-node-id=1]'));
        // enable readonly
        await testUtils.dom.click(vem.$('.o_web_studio_sidebar').find('input#readonly'));

        vem.destroy();
    });
});

});

});
