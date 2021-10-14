/** @odoo-module **/

import { ActionSwiper } from "@web_enterprise/core/action_swiper/action_swiper";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";

import {
    nextTick,
    triggerEvent,
    getFixture,
    mockTimeout,
} from "@web/../tests/helpers/utils";

const { mount } = owl;

let env;
let target;

QUnit.module("web_enterprise.ActionSwiper", (hooks) => {
    hooks.beforeEach(async () => {
        env = await makeTestEnv();
        target = getFixture();
    });

    //Conditionnaly skip tests based on TouchEvent if the feature is not supported.
    const conditionallyTest = (typeof TouchEvent === 'undefined') ? QUnit.skip : QUnit.test;

    QUnit.module("ActionSwiper");

    QUnit.test("render only it's target if no props is given", async (assert) => {
        class Parent extends owl.Component {};
        Parent.components = { ActionSwiper };
        Parent.template = owl.tags.xml`
            <div class="d-flex">
                <ActionSwiper>
                    <div class="target-component"/>
                </ActionSwiper>
            </div>
        `;
        const parent = await mount(Parent, { env, target });
        assert.containsNone(parent, "div.o_actionswiper");
        assert.containsOnce(parent, "div.target-component");
    });

    QUnit.test("only render the necessary divs", async (assert) => {
        await mount(ActionSwiper, { env, target, props: {
            onRightSwipe: {
                action: () => {},
                icon: 'fa-circle',
                bgColor: 'bg-warning'
            }
        } });
        assert.containsOnce(target, "div.o_actionswiper_right_swipe_area");
        assert.containsNone(target, "div.o_actionswiper_left_swipe_area");
        await mount(ActionSwiper, { env, target, props: {
            onLeftSwipe: {
                action: () => {},
                icon: 'fa-circle',
                bgColor: 'bg-warning'
            }
        } });
        assert.containsOnce(target, "div.o_actionswiper_right_swipe_area");
        assert.containsOnce(target, "div.o_actionswiper_left_swipe_area");
    });

    conditionallyTest(
        "can perform actions by swiping to the right [REQUIRE TOUCHEVENT]", 
        async (assert) => {
            assert.expect(5);
            const execRegisteredTimeouts = mockTimeout();
            class Parent extends owl.Component {
                onRightSwipe() {
                    assert.step("onRightSwipe");
                }
            }
            Parent.components = { ActionSwiper };
            Parent.template = owl.tags.xml`
                <div class="d-flex">
                    <ActionSwiper onRightSwipe = "{
                        action: onRightSwipe,
                        icon: 'fa-circle',
                        bgColor: 'bg-warning'
                    }">
                        <div class="target-component" style="width: 200px; height: 80px">Test</div>
                    </ActionSwiper>
                </div>
            `;
            const parent = await mount(Parent, { env, target });
            const swiper = parent.el.querySelector(".o_actionswiper");
            const targetContainer = parent.el.querySelector(".o_actionswiper_target_container");
            await triggerEvent(parent.el, ".o_actionswiper", "touchstart", {
                touches: [{
                    identifier: 0,
                    clientX: 0,
                    clientY: 0,
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: 3 * swiper.clientWidth / 4,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await nextTick();
            assert.ok(targetContainer.style.transform.includes("translateX"), "target has translateX");
            // Touch ends before the half of the distance has been reached
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: swiper.clientWidth / 2 - 1,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchend", {});
            execRegisteredTimeouts();
            await nextTick();
            assert.ok(!targetContainer.style.transform.includes("translateX"), "target does not have a translate value");
            // Touch ends once the half of the distance has been crossed
            await triggerEvent(parent.el, ".o_actionswiper", "touchstart", {
                touches: [{
                    identifier: 0,
                    clientX: swiper.clientWidth / 2,
                    clientY: 0,
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: swiper.clientWidth + 1,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchend", {});
            execRegisteredTimeouts();
            await nextTick();
            // The action is performed AND the component is reset
            assert.ok(!targetContainer.style.transform.includes("translateX"), "target doesn't have translateX after action is performed");
            assert.verifySteps(["onRightSwipe"]);
    });

    conditionallyTest(
        "can perform actions by swiping in both directions [REQUIRE TOUCHEVENT]", 
        async (assert) => {
            if (typeof TouchEventd === 'undefined') {
                QUnit.skip("test reason")
            }
            assert.expect(7);
            const execRegisteredTimeouts = mockTimeout();
            class Parent extends owl.Component {
                onRightSwipe() {
                    assert.step("onRightSwipe");
                }
                onLeftSwipe() {
                    assert.step("onLeftSwipe");
                }
            }
            Parent.components = { ActionSwiper };
            Parent.template = owl.tags.xml`
                <div class="d-flex">
                    <ActionSwiper 
                        onRightSwipe = "{
                            action: onRightSwipe,
                            icon: 'fa-circle',
                            bgColor: 'bg-warning'
                        }"
                        onLeftSwipe = "{
                            action: onLeftSwipe,
                            icon: 'fa-check',
                            bgColor: 'bg-success'
                        }">
                            <div class="target-component" style="width: 250px; height: 80px">Swipe in both directions</div>
                    </ActionSwiper>
                </div>
            `;
            const parent = await mount(Parent, { env, target });
            const swiper = parent.el.querySelector(".o_actionswiper");
            const targetContainer = parent.el.querySelector(".o_actionswiper_target_container");
            await triggerEvent(parent.el, ".o_actionswiper", "touchstart", {
                touches: [{
                    identifier: 0,
                    clientX: 0,
                    clientY: 0,
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: 3 * swiper.clientWidth / 4,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await nextTick();
            assert.ok(targetContainer.style.transform.includes("translateX"), "target has translateX");
            // Touch ends before the half of the distance has been reached to the left
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: - swiper.clientWidth / 2 + 1,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchend", {});
            execRegisteredTimeouts();
            await nextTick();
            assert.ok(!targetContainer.style.transform.includes("translateX"), "target does not have a translate value");
            // Touch ends once the half of the distance has been crossed to the left
            await triggerEvent(parent.el, ".o_actionswiper", "touchstart", {
                touches: [{
                    identifier: 0,
                    clientX: swiper.clientWidth / 2,
                    clientY: 0,
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: - swiper.clientWidth - 1,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchend", {});
            execRegisteredTimeouts();
            await nextTick();
            // The left action is performed AND the component is reset
            assert.verifySteps(["onLeftSwipe"]);
            // Touch ends once the half of the distance has been crossed to the right
            await triggerEvent(parent.el, ".o_actionswiper", "touchstart", {
                touches: [{
                    identifier: 0,
                    clientX: swiper.clientWidth / 2,
                    clientY: 0,
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchmove", { 
                touches: [{
                    identifier: 0, 
                    clientX: swiper.clientWidth + 1,
                    clientY: 0, 
                    target: parent.el,
                }],
            });
            await triggerEvent(parent.el, ".o_actionswiper", "touchend", {});
            execRegisteredTimeouts();
            await nextTick();
            // The right action is performed AND the component is reset
            assert.ok(!targetContainer.style.transform.includes("translateX"), "target doesn't have translateX after all actions are performed");
            assert.verifySteps(["onRightSwipe"]);
    });
});
