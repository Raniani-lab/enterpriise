odoo.define('web_studio.AppCreator_tests', function (require) {
    "use strict";

    const AppCreator = require('web_studio.AppCreator');
    const IconCreator = require('web_studio.IconCreator');
    const makeTestEnvironment = require("web.test_env");
    const testUtils = require('web.test_utils');

    const { Component, tags } = owl;
    const sampleIconUrl = "/web_enterprise/Parent.src/img/default_icon_app.png";
    const { xml } = tags;

    async function createAppCreator({ debug, env, events, rpc, state }) {
        const testEnv = makeTestEnvironment(env, rpc);
        const appCreatorContainer = new AppCreator(null, {}, { env: testEnv });
        await appCreatorContainer.prependTo(testUtils.prepareTarget(debug));
        Object.keys(events || {}).forEach(eventName => {
            appCreatorContainer.el.addEventListener(eventName, events[eventName]);
        });
        if (state) {
            for (const key in state) {
                appCreatorContainer._component.state[key] = state[key];
            }
            await testUtils.nextTick();
        }
        return {
            container: appCreatorContainer,
            appCreator: appCreatorContainer._component,
        };
    }

    const fadeEmptyFunction = (delay, cb) => cb ? cb() : null;
    const fadeIn = $.fn.fadeIn;
    const fadeOut = $.fn.fadeOut;

    QUnit.module('Studio', {
        before() {
            $.fn.fadeIn = fadeEmptyFunction;
            $.fn.fadeOut = fadeEmptyFunction;
        },
        after() {
            $.fn.fadeIn = fadeIn;
            $.fn.fadeOut = fadeOut;
        }
    }, function () {
        QUnit.module('AppCreator');

        QUnit.test('app creator: standard flow', async function (assert) {
            assert.expect(35);

            const { container, appCreator } = await createAppCreator({
                env: {
                    isDebug: () => false,
                    services: {
                        blockUI: () => assert.step('UI blocked'),
                        httpRequest: (route, params) => {
                            if (route === '/web/binary/upload_attachment') {
                                assert.step(route);
                                return Promise.resolve('[{ "id": 666 }]');
                            }
                        },
                        unblockUI: () => assert.step('UI unblocked'),
                    },
                },
                events: {
                    'new-app-created': ev => {
                        ev.stopPropagation();
                        ev.preventDefault();
                        assert.step('new-app-created');
                    },
                },
                rpc: async (route, params) => {
                    if (route === '/web_studio/create_new_menu') {
                        const { app_name, is_app, menu_name, model_id } = params;
                        assert.strictEqual(app_name, "Kikou",
                            "App name should be correct");
                        assert.ok(is_app,
                            "Created app should be of type app");
                        assert.strictEqual(menu_name, "Petite Perruche",
                            "Menu name should be correct");
                        assert.notOk(model_id,
                            "Should not have a model id");

                        return Promise.resolve();
                    }
                    if (route === '/web/dataset/call_kw/ir.attachment/read') {
                        assert.strictEqual(params.model, 'ir.attachment');
                        return Promise.resolve([{ datas: sampleIconUrl }]);
                    }
                },
            });

            // step: 'welcome'
            assert.strictEqual(appCreator.state.step, 'welcome',
                "Current step should be welcome");
            assert.containsNone(appCreator, '.o_web_studio_app_creator_previous',
                "Previous button should not be rendered at step welcome");
            assert.hasClass(appCreator.el.querySelector('.o_web_studio_app_creator_next'), 'is_ready',
                "Next button should be ready at step welcome");

            // go to step: 'app'
            await testUtils.dom.click(appCreator.el.querySelector('.o_web_studio_app_creator_next'));

            assert.strictEqual(appCreator.state.step, 'app',
                "Current step should be app");
            assert.containsOnce(appCreator, '.o_web_studio_icon_creator .o_web_studio_selectors',
                "Icon creator should be rendered in edit mode");

            // Icon creator interactions
            const icon = appCreator.el.querySelector('.o_app_icon i');

            // Initial state: take default values
            assert.strictEqual(appCreator.el.querySelector('.o_app_icon').style.backgroundColor, 'rgb(52, 73, 94)',
                "default background color: #34495e");
            assert.strictEqual(icon.style.color, 'rgb(241, 196, 15)',
                "default color: #f1c40f");
            assert.hasClass(icon, 'fa fa-diamond',
                "default icon class: diamond");

            await testUtils.dom.click(appCreator.el.getElementsByClassName('o_web_studio_selector')[0]);

            assert.containsOnce(appCreator, '.o_web_studio_palette',
                "the first palette should be open");

            await testUtils.dom.triggerEvent(appCreator.el.querySelector('.o_web_studio_palette'), 'mouseleave');

            assert.containsNone(appCreator, '.o_web_studio_palette',
                "leaving palette with mouse should close it");

            await testUtils.dom.click(appCreator.el.querySelectorAll('.o_web_studio_selectors > .o_web_studio_selector')[0]);
            await testUtils.dom.click(appCreator.el.querySelectorAll('.o_web_studio_selectors > .o_web_studio_selector')[1]);

            assert.containsOnce(appCreator, '.o_web_studio_palette',
                "opening another palette should close the first");

            await testUtils.dom.click(appCreator.el.querySelectorAll('.o_web_studio_palette div')[2]);
            await testUtils.dom.click(appCreator.el.querySelectorAll('.o_web_studio_selectors > .o_web_studio_selector')[2]);
            await testUtils.dom.click(appCreator.el.querySelectorAll('.o_web_studio_icons_library div')[43]);

            await testUtils.dom.triggerEvent(appCreator.el.querySelector('.o_web_studio_icons_library'), 'mouseleave');

            assert.containsNone(appCreator, '.o_web_studio_palette',
                "no palette should be visible anymore");

            assert.strictEqual(appCreator.el.querySelectorAll('.o_web_studio_selector')[1].style.backgroundColor, 'rgb(0, 222, 201)', // translation of #00dec9
                "color selector should have changed");
            assert.strictEqual(icon.style.color, 'rgb(0, 222, 201)',
                "icon color should also have changed");

            assert.hasClass(appCreator.el.querySelector('.o_web_studio_selector i'), 'fa fa-heart',
                "class selector should have changed");
            assert.hasClass(icon, 'fa fa-heart',
                "icon class should also have changed");

            // Click and upload on first link: upload a file
            // mimic the event triggered by the upload (jquery)
            await testUtils.dom.triggerEvent(appCreator.el.querySelector('.o_web_studio_upload input'), 'change');

            assert.strictEqual(appCreator.state.iconData.uploaded_attachment_id, 666,
                "attachment id should have been given by the RPC");
            assert.strictEqual(appCreator.el.querySelector('.o_web_studio_uploaded_image').style.backgroundImage,
                `url("data:image/png;base64,${sampleIconUrl}")`,
                "icon should take the updated attachment data");

            // try to go to step 'model'
            await testUtils.dom.click(appCreator.el.querySelector('.o_web_studio_app_creator_next'));

            const appNameInput = appCreator.el.querySelector('input[name="appName"]').parentNode;

            assert.strictEqual(appCreator.state.step, 'app',
                "Current step should not be update because the input is not filled");
            assert.hasClass(appNameInput, 'o_web_studio_app_creator_field_warning',
                "Input should be in warning mode");

            await testUtils.fields.editInput(appCreator.el.querySelector('input[name="appName"]'), "Kikou");
            assert.doesNotHaveClass(appNameInput, 'o_web_studio_app_creator_field_warning',
                "Input shouldn't be in warning mode anymore");

            // step: 'model'
            await testUtils.dom.click(appCreator.el.querySelector('.o_web_studio_app_creator_next'));

            assert.strictEqual(appCreator.state.step, 'model',
                "Current step should be model");

            assert.containsNone(appCreator, '.o_web_studio_selectors',
                "Icon creator should be rendered in readonly mode");

            // try to go to create app
            await testUtils.dom.click(appCreator.el.querySelector('.o_web_studio_app_creator_next'));

            assert.hasClass(appCreator.el.querySelector('input[name="menuName"]').parentNode, 'o_web_studio_app_creator_field_warning',
                "Input should be in warning mode");

            assert.containsNone(appCreator, 'input[name="modelChoice"]',
                "It shouldn't be possible to select a model in non-debug mode");

            await testUtils.fields.editInput(appCreator.el.querySelector('input[name="menuName"]'), "Petite Perruche");
            await testUtils.dom.click(appCreator.el.querySelector('.o_web_studio_app_creator_next'));

            assert.verifySteps(['/web/binary/upload_attachment', 'UI blocked', 'new-app-created', 'UI unblocked']);

            container.destroy();
        });

        QUnit.test('app creator: standard flow in debug mode', async function (assert) {
            assert.expect(9);

            const { container, appCreator } = await createAppCreator({
                env: {
                    isDebug: () => true,
                },
                state: {
                    menuName: "Kikou",
                    step: 'model',
                },
            });

            const buttonNext = appCreator.el.querySelector('button.o_web_studio_app_creator_next');

            assert.containsOnce(appCreator, 'input[name="modelChoice"]',
                "It should be possible to select a model in debug mode");
            assert.hasClass(buttonNext, 'is_ready');

            // check the model choice box
            await testUtils.dom.click(appCreator.el.querySelector('input[name="modelChoice"]'));

            assert.doesNotHaveClass(appCreator.el.querySelector('.o_web_studio_app_creator_model'),
                'o_web_studio_app_creator_field_warning');
            assert.doesNotHaveClass(buttonNext, 'is_ready');
            assert.containsOnce(appCreator, '.o_field_many2one',
                "There should be a many2one to select a model");

            await testUtils.dom.click(buttonNext);

            assert.hasClass(appCreator.el.querySelector('.o_web_studio_app_creator_model'),
                'o_web_studio_app_creator_field_warning');
            assert.doesNotHaveClass(buttonNext, 'is_ready');

            await testUtils.fields.editAndTrigger(
                appCreator.el.querySelector('.o_field_many2one input'),
                "Floating value",
                ['keyup', 'blur']
            );

            assert.containsOnce(document.body, '.modal',
                "many2one should work as intended (slow create)");

            await testUtils.dom.click(document.querySelector('.modal .btn-primary'));

            // uncheck the model choice box
            await testUtils.dom.click(appCreator.el.querySelector('input[name="modelChoice"]'));

            assert.containsNone(appCreator, '.o_field_many2one',
                "There should not be a many2one anymore");

            container.destroy();
        });

        QUnit.test('app creator: navigate through steps using "ENTER"', async function (assert) {
            assert.expect(13);

            const { container, appCreator } = await createAppCreator({
                env: {
                    isDebug: () => false,
                    services: {
                        blockUI: () => assert.step('UI blocked'),
                        unblockUI: () => assert.step('UI unblocked'),
                    },
                },
                events: {
                    'new-app-created': ev => {
                        ev.stopPropagation();
                        ev.preventDefault();
                        assert.step('new-app-created');
                    },
                },
                rpc: (route, { app_name, is_app, menu_name, model_id }) => {
                    if (route === '/web_studio/create_new_menu') {
                        assert.strictEqual(app_name, "Kikou",
                            "App name should be correct");
                        assert.ok(is_app,
                            "Created app should be of type app");
                        assert.strictEqual(menu_name, "Petite Perruche",
                            "Menu name should be correct");
                        assert.notOk(model_id,
                            "Should not have a model id");

                        return Promise.resolve();
                    }
                },
            });

            // step: 'welcome'
            assert.strictEqual(appCreator.state.step, 'welcome',
                "Current step should be set to 1");

            // go to step 'app'
            await testUtils.dom.triggerEvent(window, 'keydown', { key: 'Enter' });
            assert.strictEqual(appCreator.state.step, 'app',
                "Current step should be set to app");

            // try to go to step 'model'
            await testUtils.dom.triggerEvent(window, 'keydown', { key: 'Enter' });
            assert.strictEqual(appCreator.state.step, 'app',
                "Current step should not be update because the input is not filled");

            await testUtils.fields.editInput(appCreator.el.querySelector('input[name="appName"]'), "Kikou");

            // go to step 'model'
            await testUtils.dom.triggerEvent(window, 'keydown', { key: 'Enter' });
            assert.strictEqual(appCreator.state.step, 'model',
                "Current step should be model");

            // try to create app
            await testUtils.dom.triggerEvent(window, 'keydown', { key: 'Enter' });
            assert.hasClass(appCreator.el.querySelector('input[name="menuName"]').parentNode, 'o_web_studio_app_creator_field_warning',
                "a warning should be displayed on the input");

            await testUtils.fields.editInput(appCreator.el.querySelector('input[name="menuName"]'), "Petite Perruche");
            await testUtils.dom.triggerEvent(window, 'keydown', { key: 'Enter' });

            assert.verifySteps(['UI blocked', 'new-app-created', 'UI unblocked']);

            container.destroy();
        });

        QUnit.module('IconCreator');

        QUnit.test('icon creator: with initial web icon data', async function (assert) {
            assert.expect(4);

            class Parent extends Component {
                constructor() {
                    super(...arguments);
                    this.webIconData = sampleIconUrl;
                }
                _onIconChanged(ev) {
                    // default values
                    assert.step('icon-changed');
                    assert.deepEqual(ev.detail, {
                        backgroundColor: '#34495e',
                        color: '#f1c40f',
                        iconClass: 'fa fa-diamond',
                        type: 'custom_icon',
                    });
                }
            }
            Parent.components = { IconCreator };
            Parent.env = makeTestEnvironment();
            Parent.template = xml`
                <IconCreator
                    editable="true"
                    type="'base64'"
                    webIconData="webIconData"
                    t-on-icon-changed.stop.prevent="_onIconChanged"
                />`;
            const parent = new Parent();
            await parent.mount(testUtils.prepareTarget());

            assert.strictEqual(parent.el.querySelector('.o_web_studio_uploaded_image').style.backgroundImage,
                `url(\"${sampleIconUrl}\")`,
                "displayed image should prioritize web icon data");

            // click on first link: "Design icon"
            await testUtils.dom.click(parent.el.querySelector('.o_web_studio_upload a'));

            assert.verifySteps(['icon-changed']);

            parent.destroy();
        });

        QUnit.test('icon creator: without initial web icon data', async function (assert) {
            assert.expect(3);

            class Parent extends Component {}
            Parent.components = { IconCreator };
            Parent.env = makeTestEnvironment();
            Parent.template = xml`
                <IconCreator
                    backgroundColor="'rgb(255, 0, 128)'"
                    color="'rgb(0, 255, 0)'"
                    editable="false"
                    iconClass="'fa fa-heart'"
                    type="'custom_icon'"
                />`;
            const parent = new Parent();
            await parent.mount(testUtils.prepareTarget());

            // Attributes should be correctly set
            assert.strictEqual(parent.el.querySelector('.o_app_icon').style.backgroundColor, 'rgb(255, 0, 128)');
            assert.strictEqual(parent.el.querySelector('.o_app_icon i').style.color, 'rgb(0, 255, 0)');
            assert.hasClass(parent.el.querySelector('.o_app_icon i'), 'fa fa-heart');

            parent.destroy();
        });
    });
});
