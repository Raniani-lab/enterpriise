odoo.define('web_mobile.tests', function (require) {
"use strict";

var FormView = require('web.FormView');
var KanbanView = require('web.KanbanView');
var testUtils = require('web.test_utils');

var mobile = require('web_mobile.rpc');

var createView = testUtils.createView;

QUnit.module('web_mobile', {
    beforeEach: function () {
        this.data = {
            partner: {
                fields: {
                    name: {string: "name", type: "char"},
                    image: {},
                    parent_id: {string: "Parent", type: "many2one", relation: 'partner'},
                    sibling_ids: {string: "Sibling", type: "many2many", relation: 'partner'},
                    phone: {},
                    mobile: {},
                    email: {},
                    street: {},
                    street2: {},
                    city: {},
                    state_id: {},
                    zip: {},
                    country_id: {},
                    website: {},
                    function: {},
                    title: {},
                },
                records: [{
                    id: 1,
                    name: 'coucou1',
                }, {
                    id: 2,
                    name: 'coucou2',
                }, {
                    id: 11,
                    name: 'coucou3',
                    image: 'image',
                    parent_id: 1,
                    phone: 'phone',
                    mobile: 'mobile',
                    email: 'email',
                    street: 'street',
                    street2: 'street2',
                    city: 'city',
                    state_id: 'state_id',
                    zip: 'zip',
                    country_id: 'country_id',
                    website: 'website',
                    function: 'function',
                    title: 'title',
                }],
            },
        };
    },
}, function () {

    QUnit.test("contact sync in a non-mobile environment", async function (assert) {
        assert.expect(2);

        var rpcCount = 0;

        var form = await createView({
            View: FormView,
            arch: '<form>' +
                    '<sheet>' +
                        '<div name="button_box">' +
                            '<contactsync> </contactsync>' +
                        '</div>' +
                        '<field name="name"/>' +
                    '</sheet>' +
                  '</form>',
            data: this.data,
            model: 'partner',
            mockRPC: function () {
                rpcCount++;
                return this._super.apply(this, arguments);
            },
            res_id: 11,
        });

        var $button = form.$('button.oe_stat_button[widget="contact_sync"]');

        assert.strictEqual($button.length, 0, "the tag should not be visible in a non-mobile environment");
        assert.strictEqual(rpcCount, 1, "no extra rpc should be done by the widget (only the one from the view)");

        form.destroy();
    });

    QUnit.test("contact sync in a mobile environment", async function (assert) {
        assert.expect(5);


        var __addContact = mobile.methods.addContact;
        var addContactRecord;
        // override addContact to simulate a mobile environment
        mobile.methods.addContact = function (r) {
            addContactRecord = r;
        };

        var rpcDone;
        var rpcCount = 0;

        var form = await createView({
            View: FormView,
            arch:
                '<form>' +
                    '<sheet>' +
                        '<div name="button_box">' +
                            '<contactsync> </contactsync>' +
                        '</div>' +
                        '<field name="name"/>' +
                    '</sheet>' +
                '</form>',
            data: this.data,
            model: 'partner',
            mockRPC: function (route, args) {
                if (args.method === "read" && args.args[0] === 11 && _.contains(args.args[1], 'phone')) {
                    rpcDone = true;
                }
                rpcCount++;
                return this._super(route, args);
            },
            res_id: 11,
        });

        var $button = form.$('button.oe_stat_button[widget="contact_sync"]');

        assert.strictEqual($button.length, 1, "the tag should be visible in a mobile environment");
        assert.strictEqual(rpcCount, 1, "no extra rpc should be done by the widget (only the one from the view)");

        await testUtils.dom.click($button);

        assert.strictEqual(rpcCount, 2, "an extra rpc should be done on click");
        assert.ok(rpcDone, "a read rpc should have been done");
        assert.deepEqual(addContactRecord, {
            "city": "city",
            "country_id": "country_id",
            "email": "email",
            "function": "function",
            "id": 11,
            "image": "image",
            "mobile": "mobile",
            "name": "coucou3",
            "parent_id":  [
                1,
                "coucou1",
            ],
            "phone": "phone",
            "state_id": "state_id",
            "street": "street",
            "street2": "street2",
            "title": "title",
            "website": "website",
            "zip": "zip"
        }, "all data should be correctly passed");

        mobile.methods.addContact = __addContact;

        form.destroy();
    });

    QUnit.test("many2one in a mobile environment [REQUIRE FOCUS]", async function (assert) {
        assert.expect(4);

        var mobileDialogCall = 0;

        // override addContact to simulate a mobile environment
        var __addContact = mobile.methods.addContact;
        var __many2oneDialog = mobile.methods.many2oneDialog;

        mobile.methods.addContact = true;
        mobile.methods.many2oneDialog = function () {
            mobileDialogCall++;
            return Promise.resolve({data: {}});
        };

        var form = await createView({
            View: FormView,
            arch:
                '<form>' +
                    '<sheet>' +
                        '<field name="parent_id"/>' +
                    '</sheet>' +
                '</form>',
            data: this.data,
            model: 'partner',
            res_id: 2,
            viewOptions: {mode: 'edit'},
        });

        var $input = form.$('.o_field_widget[name="parent_id"] input');

        assert.notStrictEqual($input[0], document.activeElement,
            "autofocus should be disabled");

        assert.strictEqual(mobileDialogCall, 0,
            "the many2one mobile dialog shouldn't be called yet");
        assert.doesNotHaveClass($input, 'ui-autocomplete-input',
            "autocomplete should not be visible in a mobile environment");

        await testUtils.dom.click($input);

        assert.strictEqual(mobileDialogCall, 1,
            "the many2one should call a special dialog in a mobile environment");

        mobile.methods.addContact = __addContact;
        mobile.methods.many2oneDialog = __many2oneDialog;

        form.destroy();
    });

    QUnit.test("many2many_tags in a mobile environment", async function (assert) {
        assert.expect(6);

        var mobileDialogCall = 0;
        var rpcReadCount = 0;

        // override many2oneDialog to simulate a mobile environment
        var __many2oneDialog = mobile.methods.many2oneDialog;

        mobile.methods.many2oneDialog = function (args) {
            mobileDialogCall++;
            if (mobileDialogCall === 1) {
                // mock a search on 'coucou3'
                return Promise.resolve({'data': {'action': 'search', 'term': 'coucou3'}});
            } else if (mobileDialogCall === 2) {
                // then mock selection of first record found
                assert.strictEqual(args.records.length, 2, "there should be 1 record and create action");
                return Promise.resolve({'data': {'action': 'select', 'value': {'id': args.records[0].id}}});
            }
        };

        var form = await createView({
            View: FormView,
            arch:
                '<form>' +
                    '<sheet>' +
                        '<field name="sibling_ids" widget="many2many_tags"/>' +
                    '</sheet>' +
                '</form>',
            data: this.data,
            model: 'partner',
            res_id: 2,
            viewOptions: {mode: 'edit'},
            mockRPC: function (route, args) {
                if (args.method === "read" && args.model === "partner") {
                    if (rpcReadCount === 0) {
                        assert.deepEqual(args.args[0], [2], "form should initially show partner 2");
                    } else if (rpcReadCount === 1) {
                        assert.deepEqual(args.args[0], [11], "partner 11 should have been selected");
                    }
                    rpcReadCount++;
                }
                return this._super.apply(this, arguments);
            },
        });

        var $input = form.$('input');

        assert.strictEqual(mobileDialogCall, 0, "the many2many_tags should be disabled in a mobile environment");

        await testUtils.dom.click($input);

        assert.strictEqual(mobileDialogCall, 2, "the many2many_tags should call mobileDialog with and without search");
        assert.strictEqual(rpcReadCount, 2, "there should be a read for current form record and selected sibling");

        mobile.methods.many2oneDialog = __many2oneDialog;

        form.destroy();
    });

    QUnit.test('autofocus quick create form', async function (assert) {
        assert.expect(2);

        var kanban = await createView({
            View: KanbanView,
            model: 'partner',
            data: this.data,
            arch: '<kanban on_create="quick_create">' +
                    '<templates><t t-name="kanban-box">' +
                        '<div><field name="name"/></div>' +
                    '</t></templates>' +
                '</kanban>',
            groupBy: ['parent_id'],
        });

        // quick create in first column
        await testUtils.dom.click(kanban.$buttons.find('.o-kanban-button-new'));
        assert.ok(kanban.$('.o_kanban_group:nth(0) > div:nth(1)').hasClass('o_kanban_quick_create'),
            "clicking on create should open the quick_create in the first column");
        assert.strictEqual(document.activeElement, kanban.$('.o_kanban_quick_create .o_input:first')[0],
            "the first input field should get the focus when the quick_create is opened");

        kanban.destroy();
    });

    QUnit.test("control panel appears at top on scroll event", async function (assert) {
        assert.expect(11);

        var Q_UNIT_FIXTURE_SELECTOR = '#qunit-fixture';
        var MOBILE_STICK_CLASS = 'o_mobile_sticky';
        var MAX_HEIGHT = 400;
        var MIDLE_HEIGHT = 200;
        var DELTA_TEST = 20;

        function scrollAtHeight(height) {
            window.scrollTo(0, height);
            document.dispatchEvent(scrollEvent);
        }

        var form = await createView({
            View: FormView,
            arch:
                '<form>' +
                    '<sheet>' +
                        '<div style="height: 1000px"></div>' +
                    '</sheet>' +
                '</form>',
            data: this.data,
            model: 'partner',
            res_id: 11,
        });

        var controlPanelElement = document.querySelector('.o_cp_controller');
        var controlPanelHeight = controlPanelElement.clientHeight;
        var scrollEvent = new UIEvent('scroll');

        // Force viewport to have a scrollbar
        document.querySelector(Q_UNIT_FIXTURE_SELECTOR).style.position = 'initial';

        assert.strictEqual(controlPanelElement.style.top, '0px',
            'Top must be 0px (start position)');
        assert.notOk(controlPanelElement.classList.contains(MOBILE_STICK_CLASS),
            'Must not have class o_mobile_sticky (start position)');

        scrollAtHeight(MAX_HEIGHT);

        var valueExpected = -controlPanelHeight;
        assert.strictEqual(controlPanelElement.style.top, valueExpected + 'px',
            'Top must be ' + valueExpected + 'px (after scroll to MAX_HEIGHT)');
        assert.ok(controlPanelElement.classList.contains(MOBILE_STICK_CLASS),
            'Must have class o_mobile_sticky (after scroll to MAX_HEIGHT)');

        scrollAtHeight(MAX_HEIGHT - DELTA_TEST);

        var valueExpectedWithDelta = -(controlPanelHeight - DELTA_TEST);
        assert.strictEqual(controlPanelElement.style.top, valueExpectedWithDelta + 'px',
            'Top must be ' + valueExpectedWithDelta + 'px (after scroll to MAX_HEIGHT - DELTA_TEST)');
        assert.ok(controlPanelElement.classList.contains(MOBILE_STICK_CLASS),
            'Must have class o_mobile_sticky (after scroll to MAX_HEIGHT - DELTA_TEST)');

        scrollAtHeight(MIDLE_HEIGHT);

        assert.strictEqual(controlPanelElement.style.top, '0px',
            'Top must be 0px (after scroll to MIDLE_HEIGHT)');
        assert.ok(controlPanelElement.classList.contains(MOBILE_STICK_CLASS),
            'Must have class o_mobile_sticky (after scroll to MIDLE_HEIGHT)');

        scrollAtHeight(MAX_HEIGHT);

        assert.strictEqual(controlPanelElement.style.top, (-controlPanelHeight) + 'px',
            'Top must be ' + (-controlPanelHeight) + 'px (after scroll to MAX_HEIGHT again)');
        assert.ok(controlPanelElement.classList.contains(MOBILE_STICK_CLASS),
            'Must have class o_mobile_sticky (after scroll to MAX_HEIGHT again)');

        scrollAtHeight(0);

        assert.notOk(controlPanelElement.classList.contains(MOBILE_STICK_CLASS),
            'Must not have class o_mobile_sticky (after return to start position)');

        form.destroy();

        // Reset viewport position attribute
        document.querySelector(Q_UNIT_FIXTURE_SELECTOR).style.position = '';
    });
});
});
