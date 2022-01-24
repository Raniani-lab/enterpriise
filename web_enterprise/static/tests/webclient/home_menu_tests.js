/** @odoo-module **/
import { registerCleanup } from "@web/../tests/helpers/cleanup";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { makeFakeLocalizationService } from "@web/../tests/helpers/mock_services";
import { getFixture, nextTick, triggerHotkey } from "@web/../tests/helpers/utils";
import { commandService } from "@web/core/commands/command_service";
import { hotkeyService } from "@web/core/hotkeys/hotkey_service";
import { ormService } from "@web/core/orm_service";
import { registry } from "@web/core/registry";
import { uiService } from "@web/core/ui/ui_service";
import { HomeMenu } from "@web_enterprise/webclient/home_menu/home_menu";
import testUtils from "web.test_utils";
import { makeFakeEnterpriseService } from "../mocks";

const { Component, EventBus, mount, useRef, xml } = owl;
const patchDate = testUtils.mock.patchDate;
const serviceRegistry = registry.category("services");

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function createHomeMenu(homeMenuProps) {
    class Parent extends Component {
        constructor() {
            super();
            this.homeMenuRef = useRef("home-menu");
            this.homeMenuProps = homeMenuProps;
        }
    }
    Parent.components = { HomeMenu };
    Parent.template = xml`<HomeMenu t-ref="home-menu" t-props="homeMenuProps"/>`;
    const env = await makeTestEnv();
    const target = getFixture();
    const parent = await mount(Parent, { env, target });
    registerCleanup(() => parent.destroy());

    return parent.homeMenuRef.comp;
}

async function walkOn(assert, homeMenu, path) {
    for (const step of path) {
        triggerHotkey(`${step.shiftKey ? "shift+" : ""}${step.key}`);
        await nextTick();
        assert.hasClass(
            homeMenu.el.querySelectorAll(".o_menuitem")[step.index],
            "o_focused",
            `step ${step.number}`
        );
    }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

let homeMenuProps;
let bus;
QUnit.module(
    "web_enterprise",
    {
        beforeEach: function () {
            homeMenuProps = {
                apps: [
                    {
                        actionID: 121,
                        appID: 1,
                        id: 1,
                        label: "Discuss",
                        parents: "",
                        webIcon: false,
                        xmlid: "app.1",
                    },
                    {
                        actionID: 122,
                        appID: 2,
                        id: 2,
                        label: "Calendar",
                        parents: "",
                        webIcon: false,
                        xmlid: "app.2",
                    },
                    {
                        actionID: 123,
                        appID: 3,
                        id: 3,
                        label: "Contacts",
                        parents: "",
                        webIcon: false,
                        xmlid: "app.3",
                    },
                ],
            };

            const fakeEnterpriseService = makeFakeEnterpriseService();
            bus = new EventBus();
            const fakeHomeMenuService = {
                name: "home_menu",
                start() {
                    return {
                        toggle(show) {
                            bus.trigger("toggle", show);
                        },
                    };
                },
            };
            const fakeMenuService = {
                name: "menu",
                start() {
                    return {
                        selectMenu(menu) {
                            bus.trigger("selectMenu", menu.id);
                        },
                        getMenu() {
                            return {};
                        },
                    };
                },
            };
            serviceRegistry.add("ui", uiService);
            serviceRegistry.add("hotkey", hotkeyService);
            serviceRegistry.add("command", commandService);
            serviceRegistry.add("localization", makeFakeLocalizationService());
            serviceRegistry.add(fakeEnterpriseService.name, fakeEnterpriseService);
            serviceRegistry.add(fakeHomeMenuService.name, fakeHomeMenuService);
            serviceRegistry.add(fakeMenuService.name, fakeMenuService);
        },
    },
    function () {
        QUnit.module("HomeMenu");

        QUnit.test("ESC Support", async function (assert) {
            assert.expect(2);

            bus.on("toggle", null, (show) => {
                assert.step(`toggle ${show}`);
            });
            await createHomeMenu(homeMenuProps);
            await testUtils.dom.triggerEvent(window, "keydown", { key: "Escape" });
            assert.verifySteps(["toggle false"]);
        });

        QUnit.test("Click on an app", async function (assert) {
            assert.expect(2);

            bus.on("selectMenu", null, (menuId) => {
                assert.step(`selectMenu ${menuId}`);
            });
            const homeMenu = await createHomeMenu(homeMenuProps);

            await testUtils.dom.click(homeMenu.el.querySelectorAll(".o_menuitem")[0]);
            assert.verifySteps(["selectMenu 1"]);
        });

        QUnit.test("Display Expiration Panel (no module installed)", async function (assert) {
            assert.expect(3);

            const unpatchDate = patchDate(2019, 9, 10, 0, 0, 0);

            const mockedEnterpriseService = {
                name: "enterprise",
                start() {
                    return {
                        expirationDate: "2019-11-01 12:00:00",
                        expirationReason: "",
                        isMailInstalled: false,
                        warning: "admin",
                    };
                },
            };
            let cookie = false;
            const mockedCookieService = {
                name: "cookie",
                start() {
                    return {
                        get current() {
                            return cookie;
                        },
                        setCookie() {
                            cookie = true;
                        },
                    };
                },
            };

            serviceRegistry.add(mockedEnterpriseService.name, mockedEnterpriseService, {
                force: true,
            });
            serviceRegistry.add(mockedCookieService.name, mockedCookieService);
            serviceRegistry.add("orm", ormService);

            const homeMenu = await createHomeMenu(homeMenuProps);

            assert.containsOnce(homeMenu.el, ".database_expiration_panel");
            assert.strictEqual(
                homeMenu.el.querySelector(".database_expiration_panel .oe_instance_register")
                    .innerText,
                "You will be able to register your database once you have installed your first app.",
                "There should be an expiration panel displayed"
            );

            // Close the expiration panel
            await testUtils.dom.click(
                homeMenu.el.querySelector(".database_expiration_panel .oe_instance_hide_panel")
            );
            assert.containsNone(homeMenu.el, ".database_expiration_panel");
            unpatchDate();
        });

        QUnit.test("Navigation (only apps, only one line)", async function (assert) {
            assert.expect(8);

            homeMenuProps = {
                apps: new Array(3).fill().map((x, i) => {
                    return {
                        actionID: 120 + i,
                        appID: i + 1,
                        id: i + 1,
                        label: `0${i}`,
                        parents: "",
                        webIcon: false,
                        xmlid: `app.${i}`,
                    };
                }),
            };
            const homeMenu = await createHomeMenu(homeMenuProps);

            const path = [
                { number: 0, key: "ArrowDown", index: 0 },
                { number: 1, key: "ArrowRight", index: 1 },
                { number: 2, key: "Tab", index: 2 },
                { number: 3, key: "ArrowRight", index: 0 },
                { number: 4, key: "Tab", shiftKey: true, index: 2 },
                { number: 5, key: "ArrowLeft", index: 1 },
                { number: 6, key: "ArrowDown", index: 1 },
                { number: 7, key: "ArrowUp", index: 1 },
            ];

            await walkOn(assert, homeMenu, path);
        });

        QUnit.test("Navigation (only apps, two lines, one incomplete)", async function (assert) {
            assert.expect(19);

            homeMenuProps = {
                apps: new Array(8).fill().map((x, i) => {
                    return {
                        actionID: 121,
                        appID: i + 1,
                        id: i + 1,
                        label: `0${i}`,
                        parents: "",
                        webIcon: false,
                        xmlid: `app.${i}`,
                    };
                }),
            };
            const homeMenu = await createHomeMenu(homeMenuProps);

            const path = [
                { number: 1, key: "ArrowRight", index: 0 },
                { number: 2, key: "ArrowUp", index: 6 },
                { number: 3, key: "ArrowUp", index: 0 },
                { number: 4, key: "ArrowDown", index: 6 },
                { number: 5, key: "ArrowDown", index: 0 },
                { number: 6, key: "ArrowRight", index: 1 },
                { number: 7, key: "ArrowRight", index: 2 },
                { number: 8, key: "ArrowUp", index: 7 },
                { number: 9, key: "ArrowUp", index: 1 },
                { number: 10, key: "ArrowRight", index: 2 },
                { number: 11, key: "ArrowDown", index: 7 },
                { number: 12, key: "ArrowDown", index: 1 },
                { number: 13, key: "ArrowUp", index: 7 },
                { number: 14, key: "ArrowRight", index: 6 },
                { number: 15, key: "ArrowLeft", index: 7 },
                { number: 16, key: "ArrowUp", index: 1 },
                { number: 17, key: "ArrowLeft", index: 0 },
                { number: 18, key: "ArrowLeft", index: 5 },
                { number: 19, key: "ArrowRight", index: 0 },
            ];

            await walkOn(assert, homeMenu, path);
        });

        QUnit.test("Navigation and open an app in the home menu", async function (assert) {
            assert.expect(6);

            bus.on("selectMenu", null, (menuId) => {
                assert.step(`selectMenu ${menuId}`);
            });
            const homeMenu = await createHomeMenu(homeMenuProps);

            const path = [
                { number: 0, key: "ArrowDown", index: 0 },
                { number: 1, key: "ArrowRight", index: 1 },
                { number: 2, key: "Tab", index: 2 },
                { number: 3, key: "shift+Tab", index: 1 },
            ];

            await walkOn(assert, homeMenu, path);

            // open first app (Calendar)
            await testUtils.dom.triggerEvent(window, "keydown", { key: "Enter" });

            assert.verifySteps(["selectMenu 2"]);
        });

        QUnit.test(
            "The HomeMenu input takes the focus when you press a key only if no other element is the activeElement",
            async function (assert) {
                const homeMenu = await createHomeMenu(homeMenuProps);
                const activeElement = document.createElement("div");
                homeMenu.env.services.ui.activateElement(activeElement);
                await testUtils.dom.triggerEvent(window, "keydown", { key: "a" });
                await nextTick();
                const input = homeMenu.el.querySelector(".o_search_hidden");
                assert.notEqual(document.activeElement, input);

                homeMenu.env.services.ui.deactivateElement(activeElement);
                await testUtils.dom.triggerEvent(window, "keydown", { key: "a" });
                await nextTick();
                assert.strictEqual(document.activeElement, input);
            }
        );

        QUnit.test(
            "The HomeMenu input does not take the focus if it is already on another input",
            async function (assert) {
                const homeMenu = await createHomeMenu(homeMenuProps);
                const otherInput = document.createElement("input");
                document.querySelector(".o_home_menu").appendChild(otherInput);
                otherInput.focus();
                await testUtils.dom.triggerEvent(window, "keydown", { key: "a" });
                await nextTick();
                const homeMenuInput = homeMenu.el.querySelector(".o_search_hidden");
                assert.notEqual(document.activeElement, homeMenuInput);

                otherInput.remove();
                await testUtils.dom.triggerEvent(window, "keydown", { key: "a" });
                await nextTick();
                assert.strictEqual(document.activeElement, homeMenuInput);
            }
        );

        QUnit.test(
            "The HomeMenu input does not take the focus if it is already on a textarea",
            async function (assert) {
                const homeMenu = await createHomeMenu(homeMenuProps);
                const textarea = document.createElement("textarea");
                document.querySelector(".o_home_menu").appendChild(textarea);
                textarea.focus();
                await testUtils.dom.triggerEvent(window, "keydown", { key: "a" });
                await nextTick();
                const homeMenuInput = homeMenu.el.querySelector(".o_search_hidden");
                assert.notEqual(document.activeElement, homeMenuInput);

                textarea.remove();
                await testUtils.dom.triggerEvent(window, "keydown", { key: "a" });
                await nextTick();
                assert.strictEqual(document.activeElement, homeMenuInput);
            }
        );
    }
);
