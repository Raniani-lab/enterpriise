odoo.define("web_mobile.tests", function (require) {
    "use strict";

    const Dialog = require("web.Dialog");
    const dom = require("web.dom");
    const FormView = require("web.FormView");
    const OwlDialog = require("web.OwlDialog");
    const Popover = require("web.Popover");
    const session = require("web.session");
    const makeTestEnvironment = require("web.test_env");
    const testUtils = require("web.test_utils");
    const Widget = require("web.Widget");

    const { useBackButton } = require("web_mobile.hooks");
    const {
        BackButtonEventMixin,
        UpdateDeviceAccountControllerMixin,
    } = require("web_mobile.mixins");
    const mobile = require("web_mobile.core");
    const UserPreferencesFormView = require("web_mobile.UserPreferencesFormView");
    const { base64ToBlob } = require("web_mobile.testUtils");

    const { createWebClient, doAction } = require('@web/../tests/webclient/helpers');
    const { makeTestEnv } = require("@web/../tests/helpers/mock_env");
    const {
        mount,
        getFixture,
        destroy,
    } = require("@web/../tests/helpers/utils");
    const { Component, useState, xml } = owl;

    const { createParent, createView, mock } = testUtils;

    const MY_IMAGE =
        "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";

    QUnit.module(
        "web_mobile",
        {
            beforeEach: function () {
                this.data = {
                    partner: {
                        fields: {
                            name: { string: "name", type: "char" },
                            avatar_1920: {},
                            parent_id: { string: "Parent", type: "many2one", relation: "partner" },
                            sibling_ids: {
                                string: "Sibling",
                                type: "many2many",
                                relation: "partner",
                            },
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
                            date: { string: "A date", type: "date" },
                            datetime: { string: "A datetime", type: "datetime" },
                        },
                        records: [
                            {
                                id: 1,
                                name: "coucou1",
                            },
                            {
                                id: 2,
                                name: "coucou2",
                            },
                            {
                                id: 11,
                                name: "coucou3",
                                avatar_1920: "image",
                                parent_id: 1,
                                phone: "phone",
                                mobile: "mobile",
                                email: "email",
                                street: "street",
                                street2: "street2",
                                city: "city",
                                state_id: "state_id",
                                zip: "zip",
                                country_id: "country_id",
                                website: "website",
                                function: "function",
                                title: "title",
                            },
                        ],
                    },
                    users: {
                        fields: {
                            name: { string: "name", type: "char" },
                        },
                        records: [],
                    },
                };
            },
        },
        function () {
            QUnit.module("core", function () {
                QUnit.test("BackButtonManager", async function (assert) {
                    assert.expect(13);

                    mock.patch(mobile.methods, {
                        overrideBackButton({ enabled }) {
                            assert.step(`overrideBackButton: ${enabled}`);
                        },
                    });

                    const { BackButtonManager, BackButtonListenerError } = mobile;
                    const manager = new BackButtonManager();
                    const DummyWidget = Widget.extend({
                        _onBackButton(ev) {
                            assert.step(`${ev.type} event`);
                        },
                    });
                    const dummy = new DummyWidget();

                    manager.addListener(dummy, dummy._onBackButton);
                    assert.verifySteps(["overrideBackButton: true"]);

                    // simulate 'backbutton' event triggered by the app
                    await testUtils.dom.triggerEvent(document, "backbutton");
                    assert.verifySteps(["backbutton event"]);

                    manager.removeListener(dummy);
                    assert.verifySteps(["overrideBackButton: false"]);
                    await testUtils.dom.triggerEvent(document, "backbutton");
                    assert.verifySteps([], "shouldn't trigger any handler");

                    manager.addListener(dummy, dummy._onBackButton);
                    assert.throws(
                        () => {
                            manager.addListener(dummy, dummy._onBackButton);
                        },
                        BackButtonListenerError,
                        "should raise an error if adding a listener twice"
                    );
                    assert.verifySteps(["overrideBackButton: true"]);

                    manager.removeListener(dummy);
                    assert.throws(
                        () => {
                            manager.removeListener(dummy);
                        },
                        BackButtonListenerError,
                        "should raise an error if removing a non-registered listener"
                    );
                    assert.verifySteps(["overrideBackButton: false"]);

                    dummy.destroy();
                    mock.unpatch(mobile.methods);
                });
            });

            QUnit.module("BackButtonEventMixin");

            QUnit.test("widget should receive a backbutton event", async function (assert) {
                assert.expect(5);

                const __overrideBackButton = mobile.methods.overrideBackButton;
                mobile.methods.overrideBackButton = function ({ enabled }) {
                    assert.step(`overrideBackButton: ${enabled}`);
                };

                const DummyWidget = Widget.extend(BackButtonEventMixin, {
                    _onBackButton(ev) {
                        assert.step(`${ev.type} event`);
                    },
                });
                const backButtonEvent = new Event("backbutton");
                const dummy = new DummyWidget();
                dummy.appendTo($("<div>"));

                // simulate 'backbutton' event triggered by the app
                document.dispatchEvent(backButtonEvent);
                // waiting nextTick to match testUtils.dom.triggerEvents() behavior
                await testUtils.nextTick();

                assert.verifySteps([], "shouldn't have register handle before attached to the DOM");

                dom.append($("qunit-fixture"), dummy.$el, {
                    in_DOM: true,
                    callbacks: [{ widget: dummy }],
                });

                // simulate 'backbutton' event triggered by the app
                document.dispatchEvent(backButtonEvent);
                await testUtils.nextTick();

                dom.detach([{ widget: dummy }]);

                assert.verifySteps(
                    ["overrideBackButton: true", "backbutton event", "overrideBackButton: false"],
                    "should have enabled/disabled the back-button override"
                );

                dummy.destroy();
                mobile.methods.overrideBackButton = __overrideBackButton;
            });

            QUnit.test(
                "multiple widgets should receive backbutton events in the right order",
                async function (assert) {
                    assert.expect(6);

                    const __overrideBackButton = mobile.methods.overrideBackButton;
                    mobile.methods.overrideBackButton = function ({ enabled }) {
                        assert.step(`overrideBackButton: ${enabled}`);
                    };

                    const DummyWidget = Widget.extend(BackButtonEventMixin, {
                        init(parent, { name }) {
                            this._super.apply(this, arguments);
                            this.name = name;
                        },
                        _onBackButton(ev) {
                            assert.step(`${this.name}: ${ev.type} event`);
                            dom.detach([{ widget: this }]);
                        },
                    });
                    const backButtonEvent = new Event("backbutton");
                    const dummy1 = new DummyWidget(null, { name: "dummy1" });
                    dom.append($("qunit-fixture"), dummy1.$el, {
                        in_DOM: true,
                        callbacks: [{ widget: dummy1 }],
                    });

                    const dummy2 = new DummyWidget(null, { name: "dummy2" });
                    dom.append($("qunit-fixture"), dummy2.$el, {
                        in_DOM: true,
                        callbacks: [{ widget: dummy2 }],
                    });

                    const dummy3 = new DummyWidget(null, { name: "dummy3" });
                    dom.append($("qunit-fixture"), dummy3.$el, {
                        in_DOM: true,
                        callbacks: [{ widget: dummy3 }],
                    });

                    // simulate 'backbutton' events triggered by the app
                    document.dispatchEvent(backButtonEvent);
                    // waiting nextTick to match testUtils.dom.triggerEvents() behavior
                    await testUtils.nextTick();
                    document.dispatchEvent(backButtonEvent);
                    await testUtils.nextTick();
                    document.dispatchEvent(backButtonEvent);
                    await testUtils.nextTick();

                    assert.verifySteps([
                        "overrideBackButton: true",
                        "dummy3: backbutton event",
                        "dummy2: backbutton event",
                        "dummy1: backbutton event",
                        "overrideBackButton: false",
                    ]);

                    dummy1.destroy();
                    dummy2.destroy();
                    dummy3.destroy();
                    mobile.methods.overrideBackButton = __overrideBackButton;
                }
            );

            QUnit.module("useBackButton");

            QUnit.test("component should receive a backbutton event", async function (assert) {
                assert.expect(5);

                mock.patch(mobile.methods, {
                    overrideBackButton({ enabled }) {
                        assert.step(`overrideBackButton: ${enabled}`);
                    },
                });

                class DummyComponent extends Component {
                    setup() {
                        this._backButtonHandler = useBackButton(this._onBackButton);
                    }

                    _onBackButton(ev) {
                        assert.step(`${ev.type} event`);
                    }
                }
                DummyComponent.template = xml`<div/>`;
                
                const target = getFixture();
                const env = makeTestEnv();

                const dummy = await mount(DummyComponent, target, { env });

                // simulate 'backbutton' event triggered by the app
                await testUtils.dom.triggerEvent(document, "backbutton");
                assert.verifySteps(
                    ["overrideBackButton: true", "backbutton event"],
                    "should have enabled/disabled the back-button override"
                );

                destroy(dummy);
                assert.verifySteps(["overrideBackButton: false"]);
                mock.unpatch(mobile.methods);
            });

            QUnit.test(
                "multiple components should receive backbutton events in the right order",
                async function (assert) {
                    assert.expect(6);

                    mock.patch(mobile.methods, {
                        overrideBackButton({ enabled }) {
                            assert.step(`overrideBackButton: ${enabled}`);
                        },
                    });

                    class DummyComponent extends Component {
                        setup() {
                            this._backButtonHandler = useBackButton(this._onBackButton);
                        }

                        _onBackButton(ev) {
                            assert.step(`${this.props.name}: ${ev.type} event`);
                            // unmounting is not supported anymore
                            // A real business case equivalent to this is to have a Parent component
                            // doing a foreach on some reactive object which contains the list of dummy components
                            // and calling a callback props.onBackButton right here that removes the element from the list
                            destroy(this);
                        }
                    }
                    DummyComponent.template = xml`<div/>`;

                    const props1 = { name: "dummy1" };
                    const props2 = { name: "dummy2" };
                    const props3 = { name: "dummy3" };
                    const target = getFixture();
                    const env = makeTestEnv();

                    await mount(DummyComponent, target, { props: props1, env });
                    await mount(DummyComponent, target, { props: props2, env });
                    await mount(DummyComponent, target, { props: props3, env });

                    // simulate 'backbutton' events triggered by the app
                    await testUtils.dom.triggerEvent(document, "backbutton");
                    await testUtils.dom.triggerEvent(document, "backbutton");
                    await testUtils.dom.triggerEvent(document, "backbutton");

                    assert.verifySteps([
                        "overrideBackButton: true",
                        "dummy3: backbutton event",
                        "dummy2: backbutton event",
                        "dummy1: backbutton event",
                        "overrideBackButton: false",
                    ]);

                    mock.unpatch(mobile.methods);
                }
            );

            QUnit.test(
                "component should receive a backbutton event: custom activation",
                async function (assert) {
                    assert.expect(10);

                    mock.patch(mobile.methods, {
                        overrideBackButton({ enabled }) {
                            assert.step(`overrideBackButton: ${enabled}`);
                        },
                    });

                    class DummyComponent extends Component {
                        setup() {
                            this._backButtonHandler = useBackButton(
                                this._onBackButton,
                                this.shouldActivateBackButton.bind(this)
                            );
                            this.state = useState({
                                show: this.props.show,
                            });
                        }

                        toggle() {
                            this.state.show = !this.state.show;
                        }

                        shouldActivateBackButton() {
                            return this.state.show;
                        }

                        _onBackButton(ev) {
                            assert.step(`${ev.type} event`);
                        }
                    }
                    DummyComponent.template = xml`<button class="dummy" t-esc="state.show" t-on-click="toggle"/>`;

                    const target = getFixture();
                    const env = makeTestEnv();

                    const dummy = await mount(DummyComponent, target, { props: { show: false }, env });

                    assert.verifySteps([], "shouldn't have enabled backbutton mount");
                    await testUtils.dom.click(target.querySelector(".dummy"));
                    // simulate 'backbutton' event triggered by the app
                    await testUtils.dom.triggerEvent(document, "backbutton");
                    await testUtils.dom.click(target.querySelector(".dummy"));
                    assert.verifySteps(
                        [
                            "overrideBackButton: true",
                            "backbutton event",
                            "overrideBackButton: false",
                        ],
                        "should have enabled/disabled the back-button override"
                    );
                    destroy(dummy);

                    // enabled at mount
                    const dummy2 = await mount(DummyComponent, target, { props: { show: true }, env });
                    assert.verifySteps(
                        ["overrideBackButton: true"],
                        "shouldn have enabled backbutton at mount"
                    );
                    // simulate 'backbutton' event triggered by the app
                    await testUtils.dom.triggerEvent(document, "backbutton");
                    destroy(dummy2);

                    assert.verifySteps(
                        ["backbutton event", "overrideBackButton: false"],
                        "should have disabled the back-button override during unmount"
                    );

                    mock.unpatch(mobile.methods);
                }
            );

            QUnit.module("Dialog");

            QUnit.test("dialog is closable with backbutton event", async function (assert) {
                assert.expect(7);

                const __overrideBackButton = mobile.methods.overrideBackButton;
                mobile.methods.overrideBackButton = function ({ enabled }) {
                    assert.step(`overrideBackButton: ${enabled}`);
                };

                testUtils.mock.patch(Dialog, {
                    close: function () {
                        assert.step("close");
                        return this._super.apply(this, arguments);
                    },
                });

                const parent = await createParent({
                    data: this.data,
                    archs: {
                        "partner,false,form": `
                    <form>
                        <sheet>
                            <field name="name"/>
                        </sheet>
                   </form>
                `,
                    },
                });

                const backButtonEvent = new Event("backbutton");
                const dialog = new Dialog(parent, {
                    res_model: "partner",
                    res_id: 1,
                }).open();
                await dialog.opened().then(() => {
                    assert.step("opened");
                });
                assert.containsOnce(document.body, ".modal", "should have a modal");

                // simulate 'backbutton' event triggered by the app waiting
                document.dispatchEvent(backButtonEvent);
                // nextTick to match testUtils.dom.triggerEvents() behavior
                await testUtils.nextTick();

                // The goal of this assert is to check that our event called the
                // opened/close methods on Dialog.
                assert.verifySteps(
                    ["overrideBackButton: true", "opened", "close", "overrideBackButton: false"],
                    "should have open/close dialog"
                );
                assert.containsNone(document.body, ".modal", "modal should be closed");

                parent.destroy();
                testUtils.mock.unpatch(Dialog);
                mobile.methods.overrideBackButton = __overrideBackButton;
            });

            QUnit.module("OwlDialog");

            QUnit.test("dialog is closable with backbutton event", async function (assert) {
                assert.expect(7);

                mock.patch(mobile.methods, {
                    overrideBackButton({ enabled }) {
                        assert.step(`overrideBackButton: ${enabled}`);
                    },
                });

                class Parent extends Component {
                    setup() {
                        this.state = useState({ display: true });
                    }
                    _onDialogClosed() {
                        this.state.display = false;
                        assert.step("dialog_closed");
                    }
                }

                Parent.components = { OwlDialog };
                Parent.template = xml`
            <div>
                <OwlDialog
                    t-if="state.display"
                    onClosed="() => this._onDialogClosed()">
                    Some content
                </OwlDialog>
            </div>`;

                const target = getFixture();
                const env = await makeTestEnvironment();

                await mount(Parent, target, { env });

                assert.containsOnce(document.body, ".o_dialog");
                assert.verifySteps(["overrideBackButton: true"]);
                // simulate 'backbutton' event triggered by the app
                await testUtils.dom.triggerEvent(document, "backbutton");
                assert.verifySteps(["dialog_closed", "overrideBackButton: false"]);
                assert.containsNone(document.body, ".o_dialog", "should have been closed");

                mock.unpatch(mobile.methods);
            });

            QUnit.module("Popover");

            QUnit.test("popover is closable with backbutton event", async function (assert) {
                assert.expect(7);

                mock.patch(mobile.methods, {
                    overrideBackButton({ enabled }) {
                        assert.step(`overrideBackButton: ${enabled}`);
                    },
                });

                class Parent extends Component {}

                Parent.components = { Popover };
                Parent.template = xml`
            <div>
                <Popover>
                    <t t-set="opened">
                        Some content
                    </t>
                    <button id="target">
                        Show me
                    </button>
                </Popover>
            </div>`;

                const target = getFixture();
                const env = makeTestEnv();

                await mount(Parent, target, { env });

                assert.containsNone(document.body, ".o_popover");
                await testUtils.dom.click(document.querySelector("#target"));
                assert.containsOnce(document.body, ".o_popover");
                assert.verifySteps(["overrideBackButton: true"]);
                // simulate 'backbutton' event triggered by the app
                await testUtils.dom.triggerEvent(document, "backbutton");
                assert.verifySteps(["overrideBackButton: false"]);
                assert.containsNone(document.body, ".o_popover", "should have been closed");

                mock.unpatch(mobile.methods);
            });

            QUnit.module("ControlPanel");

            QUnit.test("mobile search: close with backbutton event", async function (assert) {
                assert.expect(7);

                const target = getFixture();
                mock.patch(mobile.methods, {
                    overrideBackButton({ enabled }) {
                        assert.step(`overrideBackButton: ${enabled}`);
                    },
                });

                const actions = {
                    1: {
                        id: 1,
                        name: "Yes",
                        res_model: "partner",
                        type: "ir.actions.act_window",
                        views: [[false, "list"]],
                    },
                };

                const views = {
                    "partner,false,list": '<tree><field name="foo"/></tree>',
                    "partner,false,search": `
                <search>
                    <filter string="Active" name="my_projects" domain="[('boolean_field', '=', True)]"/>
                    <field name="foo" string="Foo"/>
                </search>`,
                };

                const models = {
                    partner: {
                        fields: {
                            foo: { string: "Foo", type: "char" },
                            boolean_field: { string: "I am a boolean", type: "boolean" },
                        },
                        records: [{ id: 1, display_name: "First record", foo: "yop" }],
                    },
                };
                const serverData = {actions, models, views};

                const webClient = await createWebClient({ serverData });

                await doAction(webClient, 1);

                // the mobile search is portaled in body, not in the fixture
                assert.containsNone(document.body, ".o_mobile_search");

                // open the search view
                await testUtils.dom.click(
                    target.querySelector("button.o_enable_searchview")
                );
                // open it in full screen
                await testUtils.dom.click(
                    target.querySelector(".o_toggle_searchview_full")
                );

                assert.containsOnce(document.body, ".o_mobile_search");
                assert.verifySteps(["overrideBackButton: true"]);

                // simulate 'backbutton' event triggered by the app
                await testUtils.dom.triggerEvent(target, "backbutton");
                assert.containsNone(target, ".o_mobile_search");
                assert.verifySteps(["overrideBackButton: false"]);

                mock.unpatch(mobile.methods);
            });

            QUnit.module("UpdateDeviceAccountControllerMixin");

            QUnit.test(
                "controller should call native updateAccount method when saving record",
                async function (assert) {
                    assert.expect(4);

                    const __updateAccount = mobile.methods.updateAccount;
                    mobile.methods.updateAccount = function (options) {
                        const { avatar, name, username } = options;
                        assert.ok("should call updateAccount");
                        assert.strictEqual(avatar, MY_IMAGE, "should have a base64 encoded avatar");
                        assert.strictEqual(name, "Marc Demo");
                        assert.strictEqual(username, "demo");
                        return Promise.resolve();
                    };

                    testUtils.mock.patch(session, {
                        fetchAvatar() {
                            return Promise.resolve(base64ToBlob(MY_IMAGE, "image/png"));
                        },
                    });

                    const DummyView = FormView.extend({
                        config: Object.assign({}, FormView.prototype.config, {
                            Controller: FormView.prototype.config.Controller.extend(
                                UpdateDeviceAccountControllerMixin
                            ),
                        }),
                    });

                    const dummy = await createView({
                        View: DummyView,
                        model: "partner",
                        data: this.data,
                        arch: `
                <form>
                    <sheet>
                        <field name="name"/>
                    </sheet>
                </form>`,
                        viewOptions: {
                            mode: "edit",
                        },
                        session: {
                            username: "demo",
                            name: "Marc Demo",
                        },
                    });

                    await testUtils.form.clickSave(dummy);
                    await dummy.savingDef;

                    dummy.destroy();
                    testUtils.mock.unpatch(session);
                    mobile.methods.updateAccount = __updateAccount;
                }
            );

            QUnit.test(
                "UserPreferencesFormView should call native updateAccount method when saving record",
                async function (assert) {
                    assert.expect(4);

                    const __updateAccount = mobile.methods.updateAccount;
                    mobile.methods.updateAccount = function (options) {
                        const { avatar, name, username } = options;
                        assert.ok("should call updateAccount");
                        assert.strictEqual(avatar, MY_IMAGE, "should have a base64 encoded avatar");
                        assert.strictEqual(name, "Marc Demo");
                        assert.strictEqual(username, "demo");
                        return Promise.resolve();
                    };

                    testUtils.mock.patch(session, {
                        fetchAvatar() {
                            return Promise.resolve(base64ToBlob(MY_IMAGE, "image/png"));
                        },
                    });

                    const view = await createView({
                        View: UserPreferencesFormView,
                        model: "users",
                        data: this.data,
                        arch: `
                <form>
                    <sheet>
                        <field name="name"/>
                    </sheet>
                </form>`,
                        viewOptions: {
                            mode: "edit",
                        },
                        session: {
                            username: "demo",
                            name: "Marc Demo",
                        },
                    });

                    await testUtils.form.clickSave(view);
                    await view.savingDef;

                    view.destroy();
                    testUtils.mock.unpatch(session);
                    mobile.methods.updateAccount = __updateAccount;
                }
            );

            QUnit.module("FieldDate");

            QUnit.test("date field: toggle datepicker", async function (assert) {
                assert.expect(8);

                mock.patch(mobile.methods, {
                    requestDateTimePicker({ value, type }) {
                        assert.step("requestDateTimePicker");
                        assert.strictEqual(false, value, "field shouldn't have an initial value");
                        assert.strictEqual("date", type, "datepicker's mode should be 'date'");
                        return Promise.resolve({ data: "2020-01-12" });
                    },
                });

                const form = await createView({
                    View: FormView,
                    model: "partner",
                    data: this.data,
                    arch: '<form><field name="date"/><field name="name"/></form>',
                    translateParameters: {
                        // Avoid issues due to localization formats
                        date_format: "%m/%d/%Y",
                    },
                });

                assert.containsNone(
                    document.body,
                    ".bootstrap-datetimepicker-widget",
                    "datepicker shouldn't be present initially"
                );

                await testUtils.dom.openDatepicker(form.$(".o_datepicker"));

                assert.containsNone(
                    document.body,
                    ".bootstrap-datetimepicker-widget",
                    "datepicker shouldn't be opened"
                );
                assert.verifySteps(
                    ["requestDateTimePicker"],
                    "native datepicker should have been called"
                );
                // ensure focus has been restored to the date field
                form.$(".o_datepicker_input").focus();
                assert.strictEqual(
                    form.$(".o_datepicker_input").val(),
                    "01/12/2020",
                    "should be properly formatted"
                );

                // focus another field
                await testUtils.dom.click(form.$(".o_field_widget[name=name]").focus());
                assert.strictEqual(
                    form.$(".o_datepicker_input").val(),
                    "01/12/2020",
                    "shouldn't have changed after loosing focus"
                );

                form.destroy();
                mock.unpatch(mobile.methods);
            });

            QUnit.module("FieldDateTime");

            QUnit.test("datetime field: toggle datepicker", async function (assert) {
                assert.expect(8);

                mock.patch(mobile.methods, {
                    requestDateTimePicker({ value, type }) {
                        assert.step("requestDateTimePicker");
                        assert.strictEqual(false, value, "field shouldn't have an initial value");
                        assert.strictEqual(
                            "datetime",
                            type,
                            "datepicker's mode should be 'datetime'"
                        );
                        return Promise.resolve({ data: "2020-01-12 12:00:00" });
                    },
                });

                const form = await createView({
                    View: FormView,
                    model: "partner",
                    data: this.data,
                    arch: '<form><field name="datetime"/><field name="name"/></form>',
                    translateParameters: {
                        // Avoid issues due to localization formats
                        date_format: "%m/%d/%Y",
                        time_format: "%H:%M:%S",
                    },
                });

                assert.containsNone(
                    document.body,
                    ".bootstrap-datetimepicker-widget",
                    "datepicker shouldn't be present initially"
                );

                await testUtils.dom.openDatepicker(form.$(".o_datepicker"));

                assert.containsNone(
                    document.body,
                    ".bootstrap-datetimepicker-widget",
                    "datepicker shouldn't be opened"
                );
                assert.verifySteps(
                    ["requestDateTimePicker"],
                    "native datepicker should have been called"
                );
                // ensure focus has been restored to the datetime field
                form.$(".o_datepicker_input").focus();
                assert.strictEqual(
                    form.$(".o_datepicker_input").val(),
                    "01/12/2020 12:00:00",
                    "should be properly formatted"
                );

                // focus another field
                await testUtils.dom.click(form.$(".o_field_widget[name=name]").focus());
                assert.strictEqual(
                    form.$(".o_datepicker_input").val(),
                    "01/12/2020 12:00:00",
                    "shouldn't have changed after loosing focus"
                );

                form.destroy();
                mock.unpatch(mobile.methods);
            });
        }
    );
});
