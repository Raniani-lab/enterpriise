/** @odoo-module **/

import {
    click,
    getFixture,
    legacyExtraNextTick,
    nextTick,
    patchWithCleanup,
} from "@web/../tests/helpers/utils";
import { doAction, getActionManagerServerData, loadState } from "@web/../tests/webclient/helpers";
import { registry } from "@web/core/registry";
import { editView } from "@web/views/debug_items";
import { createEnterpriseWebClient } from "@web_enterprise/../tests/helpers";
import { homeMenuService } from "@web_enterprise/webclient/home_menu/home_menu_service";
import testUtils from "web.test_utils";
import { makeFakeEnterpriseService } from "../mocks";
import { registerCleanup } from "@web/../tests/helpers/cleanup";
import { errorService } from "@web/core/errors/error_service";
import { browser } from "@web/core/browser/browser";

const { Component, xml } = owl;

let serverData;
let fixture;
const serviceRegistry = registry.category("services");

// Should test ONLY the webClient and features present in Enterprise
// Those tests rely on hidden view to be in CSS: display: none
QUnit.module("WebClient Enterprise", (hooks) => {
    hooks.beforeEach(() => {
        serverData = getActionManagerServerData();
        fixture = getFixture();
        serviceRegistry.add("home_menu", homeMenuService);
        const fakeEnterpriseService = makeFakeEnterpriseService();
        serviceRegistry.add("enterprise", fakeEnterpriseService);
    });

    QUnit.module("basic flow with home menu", (hooks) => {
        let mockRPC;
        hooks.beforeEach((assert) => {
            serverData.menus[1].actionID = 4;
            serverData.menus.root.children = [1];
            serverData.views["partner,false,form"] = `
                <form>
                    <field name="display_name"/>
                    <field name="m2o"/>'
                </form>`;
            mockRPC = async (route) => {
                assert.step(route);
                if (route === "/web/dataset/call_kw/partner/get_formview_action") {
                    return {
                        type: "ir.actions.act_window",
                        res_model: "partner",
                        view_type: "form",
                        view_mode: "form",
                        views: [[false, "form"]],
                        target: "current",
                        res_id: 2,
                    };
                }
            };
        });

        QUnit.test("1 -- start up", async function (assert) {
            await createEnterpriseWebClient({ fixture, serverData, mockRPC });
            assert.verifySteps(["/web/webclient/load_menus"]);
            assert.ok(document.body.classList.contains("o_home_menu_background"));
            assert.containsOnce(fixture, ".o_home_menu");
            assert.isNotVisible(fixture.querySelector(".o_menu_toggle"));
            assert.containsOnce(fixture, ".o_app.o_menuitem");
        });

        QUnit.test("2 -- navbar updates on displaying an action", async function (assert) {
            await createEnterpriseWebClient({ fixture, serverData, mockRPC });
            assert.verifySteps(["/web/webclient/load_menus"]);
            await click(fixture.querySelector(".o_app.o_menuitem"));
            await nextTick(); // there is another tick to update navar and destroy HomeMenu
            await legacyExtraNextTick();
            assert.verifySteps([
                "/web/action/load",
                "/web/dataset/call_kw/partner/load_views",
                "/web/dataset/search_read",
            ]);
            assert.notOk(document.body.classList.contains("o_home_menu_background"));
            assert.containsNone(fixture, ".o_home_menu");
            assert.containsOnce(fixture, ".o_kanban_view");
            const menuToggle = fixture.querySelector(".o_menu_toggle");
            assert.isVisible(menuToggle);
            assert.notOk(menuToggle.classList.contains("o_menu_toggle_back"));
        });

        QUnit.test("3 -- push another action in the breadcrumb", async function (assert) {
            await createEnterpriseWebClient({ fixture, serverData, mockRPC });
            assert.verifySteps(["/web/webclient/load_menus"]);
            await click(fixture.querySelector(".o_app.o_menuitem"));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps([
                "/web/action/load",
                "/web/dataset/call_kw/partner/load_views",
                "/web/dataset/search_read",
            ]);
            await click(fixture.querySelector(".o_kanban_record"));
            await nextTick(); // there is another tick to update navbar and destroy HomeMenu
            await legacyExtraNextTick();
            assert.verifySteps(["/web/dataset/call_kw/partner/read"]);
            assert.isVisible(fixture.querySelector(".o_menu_toggle"));
            assert.containsOnce(fixture, ".o_form_view");
            assert.strictEqual(
                fixture.querySelector(".breadcrumb-item.active").textContent,
                "First record"
            );
        });

        QUnit.test("4 -- push a third action in the breadcrumb", async function (assert) {
            await createEnterpriseWebClient({ fixture, serverData, mockRPC });
            assert.verifySteps(["/web/webclient/load_menus"]);
            await click(fixture.querySelector(".o_app.o_menuitem"));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps([
                "/web/action/load",
                "/web/dataset/call_kw/partner/load_views",
                "/web/dataset/search_read",
            ]);
            await click(fixture.querySelector(".o_kanban_record"));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps(["/web/dataset/call_kw/partner/read"]);
            await click(fixture.querySelector('.o_field_widget[name="m2o"]'));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps([
                "/web/dataset/call_kw/partner/get_formview_action",
                "/web/dataset/call_kw/partner/load_views",
                "/web/dataset/call_kw/partner/read",
            ]);
            assert.containsOnce(fixture, ".o_form_view");
            assert.strictEqual(
                fixture.querySelector(".breadcrumb-item.active").textContent,
                "Second record"
            );
            assert.containsN(fixture, ".breadcrumb-item", 3);
        });

        QUnit.test(
            "5 -- switch to HomeMenu from an action with 2 breadcrumbs",
            async function (assert) {
                await createEnterpriseWebClient({ fixture, serverData, mockRPC });
                assert.verifySteps(["/web/webclient/load_menus"]);
                await click(fixture.querySelector(".o_app.o_menuitem"));
                await nextTick();
                await legacyExtraNextTick();
                assert.verifySteps([
                    "/web/action/load",
                    "/web/dataset/call_kw/partner/load_views",
                    "/web/dataset/search_read",
                ]);
                await click(fixture.querySelector(".o_kanban_record"));
                await nextTick();
                await legacyExtraNextTick();
                assert.verifySteps(["/web/dataset/call_kw/partner/read"]);
                await click(fixture.querySelector('.o_field_widget[name="m2o"]'));
                await nextTick();
                await legacyExtraNextTick();
                assert.verifySteps([
                    "/web/dataset/call_kw/partner/get_formview_action",
                    "/web/dataset/call_kw/partner/load_views",
                    "/web/dataset/call_kw/partner/read",
                ]);
                const menuToggle = fixture.querySelector(".o_menu_toggle");
                await click(menuToggle);
                await nextTick();
                assert.verifySteps([]);
                assert.ok(menuToggle.classList.contains("o_menu_toggle_back"));
                assert.containsOnce(fixture, ".o_home_menu");
                assert.isNotVisible(fixture.querySelector(".o_form_view"));
            }
        );

        QUnit.test("6 -- back to underlying action with many breadcrumbs", async function (assert) {
            await createEnterpriseWebClient({ fixture, serverData, mockRPC });
            assert.verifySteps(["/web/webclient/load_menus"]);
            await click(fixture.querySelector(".o_app.o_menuitem"));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps([
                "/web/action/load",
                "/web/dataset/call_kw/partner/load_views",
                "/web/dataset/search_read",
            ]);
            await click(fixture.querySelector(".o_kanban_record"));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps(["/web/dataset/call_kw/partner/read"]);
            await click(fixture.querySelector('.o_field_widget[name="m2o"]'));
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps([
                "/web/dataset/call_kw/partner/get_formview_action",
                "/web/dataset/call_kw/partner/load_views",
                "/web/dataset/call_kw/partner/read",
            ]);
            const menuToggle = fixture.querySelector(".o_menu_toggle");
            await click(menuToggle);
            await click(menuToggle);
            // if we don't reload on going back to underlying action
            // assert.verifySteps(
            //   [],
            //   "the underlying view should not reload when toggling the HomeMenu to off"
            // );
            // endif
            // if we reload on going back to underlying action
            await nextTick();
            await legacyExtraNextTick();
            assert.verifySteps(
                ["/web/dataset/call_kw/partner/read"],
                "the underlying view should reload when toggling the HomeMenu to off"
            );
            // endif
            assert.containsNone(fixture, ".o_home_menu");
            assert.containsOnce(fixture, ".o_form_view");
            assert.notOk(menuToggle.classList.contains("o_menu_toggle_back"));
            assert.strictEqual(
                fixture.querySelector(".breadcrumb-item.active").textContent,
                "Second record"
            );
            assert.containsN(fixture, ".breadcrumb-item", 3);
        });

        QUnit.test("restore the newly created record in form view (legacy)", async (assert) => {
            assert.expect(7);
            const action = serverData.actions[6];
            delete action.res_id;
            action.target = "current";
            const webClient = await createEnterpriseWebClient({ fixture, serverData });

            await doAction(webClient, 6);
            let formEl = fixture.querySelector(".o_form_view");
            assert.isVisible(formEl);
            assert.ok(formEl.classList.contains("o_form_editable"));
            const input = fixture.querySelector("input.o_input");
            await testUtils.fields.editInput(input, "red right hand");
            await click(fixture.querySelector(".o_form_button_save"));
            assert.strictEqual(
                fixture.querySelector(".breadcrumb-item.active").textContent,
                "red right hand"
            );
            await click(fixture.querySelector(".o_menu_toggle"));
            assert.isNotVisible(fixture.querySelector(".o_form_view"));

            await click(fixture.querySelector(".o_menu_toggle"));
            await nextTick();
            await legacyExtraNextTick();
            formEl = fixture.querySelector(".o_form_view");
            assert.isVisible(formEl);
            assert.notOk(formEl.classList.contains("o_form_editable"));
            assert.strictEqual(
                fixture.querySelector(".breadcrumb-item.active").textContent,
                "red right hand"
            );
        });
        QUnit.skip("fast clicking on restore (implementation detail)", async (assert) => {
            assert.expect(6);

            let doVeryFastClick = false;

            class DelayedClientAction extends Component {
                setup() {
                    owl.onMounted(() => {
                        if (doVeryFastClick) {
                            doVeryFastClick = false;
                            click(fixture.querySelector(".o_menu_toggle"));
                        }
                    });
                }
            }
            DelayedClientAction.template = xml`<div class='delayed_client_action'>
                <button t-on-click="resolve">RESOLVE</button>
            </div>`;

            registry.category("actions").add("DelayedClientAction", DelayedClientAction);
            const webClient = await createEnterpriseWebClient({ fixture, serverData });
            await doAction(webClient, "DelayedClientAction");
            await nextTick();
            await click(fixture.querySelector(".o_menu_toggle"));
            assert.isVisible(fixture.querySelector(".o_home_menu"));
            assert.isNotVisible(fixture.querySelector(".delayed_client_action"));

            doVeryFastClick = true;
            await click(fixture.querySelector(".o_menu_toggle"));
            await nextTick();
            // off homemenu
            assert.isVisible(fixture.querySelector(".o_home_menu"));
            assert.isNotVisible(fixture.querySelector(".delayed_client_action"));

            await click(fixture.querySelector(".o_menu_toggle"));
            await nextTick();
            assert.containsNone(fixture, ".o_home_menu");
            assert.containsOnce(fixture, ".delayed_client_action");
        });
    });

    QUnit.test("clear unCommittedChanges when toggling home menu", async function (assert) {
        assert.expect(6);
        // Edit a form view, don't save, toggle home menu
        // the autosave feature of the Form view is activated
        // and relied upon by this test

        const mockRPC = (route, args) => {
            if (args.method === "create") {
                assert.strictEqual(args.model, "partner");
                assert.deepEqual(args.args, [
                    {
                        display_name: "red right hand",
                        foo: false,
                    },
                ]);
            }
        };

        const webClient = await createEnterpriseWebClient({ fixture, serverData, mockRPC });
        await doAction(webClient, 3, { viewType: "form" });
        await legacyExtraNextTick();
        assert.containsOnce(fixture, ".o_form_view.o_form_editable");
        const input = fixture.querySelector("input.o_input");
        await testUtils.fields.editInput(input, "red right hand");

        await click(fixture.querySelector(".o_menu_toggle"));
        await nextTick();
        assert.isNotVisible(fixture.querySelector(".o_form_view"));
        assert.containsNone(document.body, ".modal");
        assert.containsOnce(fixture, ".o_home_menu");
    });

    QUnit.test("can have HomeMenu and dialog action", async function (assert) {
        const webClient = await createEnterpriseWebClient({ fixture, serverData });
        await nextTick();
        assert.containsOnce(fixture, ".o_home_menu");
        assert.containsNone(fixture, ".modal .o_form_view");
        await doAction(webClient, 5);
        await legacyExtraNextTick();
        assert.containsOnce(fixture, ".modal .o_form_view");
        assert.isVisible(fixture.querySelector(".modal .o_form_view"));
        assert.containsOnce(fixture, ".o_home_menu");
    });

    QUnit.test("supports attachments of apps deleted", async function (assert) {
        // When doing a pg_restore without the filestore
        // LPE fixme: may not be necessary anymore since menus are not HomeMenu props anymore
        serverData.menus = {
            root: { id: "root", children: [1], name: "root", appID: "root" },
            1: {
                id: 1,
                appID: 1,
                actionID: 1,
                xmlid: "",
                name: "Partners",
                children: [],
                webIconData: "",
                webIcon: "bloop,bloop",
            },
        };
        patchWithCleanup(odoo, { debug: "1" });
        await createEnterpriseWebClient({ fixture, serverData });
        assert.containsOnce(fixture, ".o_home_menu");
    });

    QUnit.test(
        "debug manager resets to global items when home menu is displayed",
        async function (assert) {
            assert.expect(9);
            const debugRegistry = registry.category("debug");
            debugRegistry.category("view").add("editView", editView);
            debugRegistry.category("default").add("item_1", () => {
                return {
                    type: "item",
                    description: "globalItem",
                    callback: () => {},
                    sequence: 10,
                };
            });
            const mockRPC = async (route) => {
                if (route.includes("check_access_rights")) {
                    return true;
                }
            };
            patchWithCleanup(odoo, { debug: "1" });
            const webClient = await createEnterpriseWebClient({ fixture, serverData, mockRPC });
            await click(fixture.querySelector(".o_debug_manager .dropdown-toggle"));
            assert.containsOnce(fixture, ".o_debug_manager .dropdown-item:contains('globalItem')");
            assert.containsNone(
                fixture,
                ".o_debug_manager .dropdown-item:contains('Edit View: Kanban')"
            );
            await click(fixture.querySelector(".o_debug_manager .dropdown-toggle"));
            await doAction(webClient, 1);
            await click(fixture.querySelector(".o_debug_manager .dropdown-toggle"));
            assert.containsOnce(fixture, ".o_debug_manager .dropdown-item:contains('globalItem')");
            assert.containsOnce(
                fixture,
                ".o_debug_manager .dropdown-item:contains('Edit View: Kanban')"
            );
            await click(fixture.querySelector(".o_menu_toggle"));
            await click(fixture.querySelector(".o_debug_manager .dropdown-toggle"));
            assert.containsOnce(fixture, ".o_debug_manager .dropdown-item:contains('globalItem')");
            assert.containsNone(
                fixture,
                ".o_debug_manager .dropdown-item:contains('Edit View: Kanban')"
            );
            await click(fixture.querySelector(".o_debug_manager .dropdown-toggle"));
            await doAction(webClient, 3);
            await click(fixture.querySelector(".o_debug_manager .dropdown-toggle"));
            assert.containsOnce(fixture, ".o_debug_manager .dropdown-item:contains('globalItem')");
            assert.containsOnce(
                fixture,
                ".o_debug_manager .dropdown-item:contains('Edit View: List')"
            );
            assert.containsNone(
                fixture,
                ".o_debug_manager .dropdown-item:contains('Edit View: Kanban')"
            );
        }
    );

    QUnit.test(
        "url state is well handled when going in and out of the HomeMenu",
        async function (assert) {
            assert.expect(4);

            const webClient = await createEnterpriseWebClient({ fixture, serverData });
            await nextTick();
            assert.deepEqual(webClient.env.services.router.current.hash, { action: "menu" });

            await click(fixture.querySelector(".o_app.o_menuitem:nth-child(2)"));
            await legacyExtraNextTick();
            assert.deepEqual(webClient.env.services.router.current.hash, {
                action: 1002,
                menu_id: 2,
            });

            await click(fixture.querySelector(".o_menu_toggle"));
            await nextTick();
            assert.deepEqual(webClient.env.services.router.current.hash, { action: "menu" });

            await click(fixture.querySelector(".o_menu_toggle"));
            // if we reload on going back to underlying action
            await legacyExtraNextTick();
            // end if
            assert.deepEqual(webClient.env.services.router.current.hash, {
                action: 1002,
                menu_id: 2,
            });
        }
    );

    QUnit.test(
        "underlying action's menu items are invisible when HomeMenu is displayed",
        async function (assert) {
            assert.expect(10);
            serverData.menus[1].children = [99];
            serverData.menus[99] = {
                id: 99,
                children: [],
                name: "SubMenu",
                appID: 1,
                actionID: 1002,
                xmlid: "",
                webIconData: undefined,
                webIcon: false,
            };
            await createEnterpriseWebClient({ fixture, serverData });
            assert.containsNone(fixture, "nav .o_menu_sections");
            assert.containsNone(fixture, "nav .o_menu_brand");
            await click(fixture.querySelector(".o_app.o_menuitem:nth-child(1)"));
            await nextTick();
            assert.containsOnce(fixture, "nav .o_menu_sections");
            assert.containsOnce(fixture, "nav .o_menu_brand");
            assert.isVisible(fixture.querySelector(".o_menu_sections"));
            assert.isVisible(fixture.querySelector(".o_menu_brand"));
            await click(fixture.querySelector(".o_menu_toggle"));
            assert.containsOnce(fixture, "nav .o_menu_sections");
            assert.containsOnce(fixture, "nav .o_menu_brand");
            assert.isNotVisible(fixture.querySelector(".o_menu_sections"));
            assert.isNotVisible(fixture.querySelector(".o_menu_brand"));
        }
    );

    QUnit.test("loadState back and forth keeps relevant keys in state", async function (assert) {
        assert.expect(9);

        const webClient = await createEnterpriseWebClient({ fixture, serverData });

        await click(fixture.querySelector(".o_app.o_menuitem:nth-child(2)"));
        await legacyExtraNextTick();
        assert.containsOnce(fixture, ".test_client_action");
        assert.containsNone(fixture, ".o_home_menu");
        const state = webClient.env.services.router.current.hash;
        assert.deepEqual(state, {
            action: 1002,
            menu_id: 2,
        });

        await loadState(webClient, {});
        assert.containsNone(fixture, ".test_client_action");
        assert.containsOnce(fixture, ".o_home_menu");
        assert.deepEqual(webClient.env.services.router.current.hash, {
            action: "menu",
        });

        await loadState(webClient, state);
        assert.containsOnce(fixture, ".test_client_action");
        assert.containsNone(fixture, ".o_home_menu");
        assert.deepEqual(webClient.env.services.router.current.hash, state);
    });

    QUnit.test(
        "go back to home menu using browser back button (i.e. loadState)",
        async function (assert) {
            assert.expect(7);

            const webClient = await createEnterpriseWebClient({ fixture, serverData });
            assert.containsOnce(fixture, ".o_home_menu");
            assert.isNotVisible(fixture.querySelector(".o_main_navbar .o_menu_toggle"));

            await click(fixture.querySelector(".o_app.o_menuitem:nth-child(2)"));
            await legacyExtraNextTick();
            assert.containsOnce(fixture, ".test_client_action");
            assert.containsNone(fixture, ".o_home_menu");

            await loadState(webClient, { action: "menu" }); // FIXME: this might need to be changed
            assert.containsNone(fixture, ".test_client_action");
            assert.containsOnce(fixture, ".o_home_menu");
            assert.isNotVisible(fixture.querySelector(".o_main_navbar .o_menu_toggle"));
        }
    );

    QUnit.test("initial action crashes", async (assert) => {
        assert.expect(6);

        const handler = (ev) => {
            // need to preventDefault to remove error from console (so python test pass)
            ev.preventDefault();
        };
        window.addEventListener("unhandledrejection", handler);
        registerCleanup(() => window.removeEventListener("unhandledrejection", handler));

        patchWithCleanup(QUnit, {
            onUnhandledRejection: () => {},
        });

        browser.location.hash = "#action=__test__client__action__&menu_id=1";
        const ClientAction = registry.category("actions").get("__test__client__action__");
        class Override extends ClientAction {
            setup() {
                super.setup();
                assert.step("clientAction setup");
                throw new Error("my error");
            }
        }
        registry.category("actions").add("__test__client__action__", Override, { force: true });

        registry.category("services").add("error", errorService);

        const webClient = await createEnterpriseWebClient({ fixture, serverData });
        assert.verifySteps(["clientAction setup"]);
        assert.containsOnce(fixture, "nav .o_menu_toggle");
        assert.isVisible(fixture.querySelector("nav .o_menu_toggle"));
        assert.strictEqual(fixture.querySelector(".o_action_manager").innerHTML, "");
        assert.deepEqual(webClient.env.services.router.current.hash, {
            action: "__test__client__action__",
            menu_id: 1,
        });
    });
});
