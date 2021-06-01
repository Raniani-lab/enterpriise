/** @odoo-module **/

import { registry } from "@web/core/registry";
import { hotkeyService } from "@web/webclient/hotkeys/hotkey_service";
import { registerCleanup } from "@web/../tests/helpers/cleanup";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { makeFakeCompanyService, makeFakeUIService } from "@web/../tests/helpers/mock_services";
import { click, getFixture, patchWithCleanup } from "@web/../tests/helpers/utils";
import { MobileSwitchCompanyMenu } from "@web_enterprise/webclient/burger_menu/mobile_switch_company_menu/mobile_switch_company_menu";

const { mount } = owl;
const serviceRegistry = registry.category("services");

QUnit.module("MobileMobileSwitchCompanyMenu", (hooks) => {
    hooks.beforeEach(() => {
        patchWithCleanup(odoo.session_info.user_companies, {
            allowed_companies: {
                1: { id: 1, name: "Hermit" },
                2: { id: 2, name: "Herman's" },
                3: { id: 3, name: "Heroes TM" },
            },
            current_company: 1,
        });
        serviceRegistry.add("ui", makeFakeUIService());
        serviceRegistry.add("company", makeFakeCompanyService());
        serviceRegistry.add("hotkey", hotkeyService);
    });

    QUnit.test("basic rendering", async (assert) => {
        assert.expect(13);

        const env = await makeTestEnv();
        const target = getFixture();
        const scMenu = await mount(MobileSwitchCompanyMenu, { env, target });
        registerCleanup(() => scMenu.destroy());

        assert.strictEqual(scMenu.el.tagName.toUpperCase(), "DIV");
        assert.hasClass(scMenu.el, "o_burger_menu_companies");

        assert.containsN(scMenu, ".toggle_company", 3);
        assert.containsN(scMenu, ".log_into", 3);
        assert.containsOnce(scMenu.el, ".fa-check-square");
        assert.containsN(scMenu.el, ".fa-square-o", 2);

        assert.strictEqual(
            scMenu.el.querySelectorAll(".menu_companies_item")[0].textContent,
            "Hermit(current)"
        );
        assert.strictEqual(
            scMenu.el.querySelectorAll(".menu_companies_item")[1].textContent,
            "Herman's"
        );
        assert.strictEqual(
            scMenu.el.querySelectorAll(".menu_companies_item")[2].textContent,
            "Heroes TM"
        );

        assert.hasClass(scMenu.el.querySelectorAll(".menu_companies_item i")[0], "fa-check-square");
        assert.hasClass(scMenu.el.querySelectorAll(".menu_companies_item i")[1], "fa-square-o");
        assert.hasClass(scMenu.el.querySelectorAll(".menu_companies_item i")[2], "fa-square-o");

        assert.strictEqual(scMenu.el.textContent, "CompaniesHermit(current)Herman'sHeroes TM");
    });

    QUnit.test("companies can be toggled and logged in", async (assert) => {
        assert.expect(20);

        const env = await makeTestEnv();
        const target = getFixture();
        const scMenu = await mount(MobileSwitchCompanyMenu, { env, target });
        registerCleanup(() => scMenu.destroy());

        /**
         *   [x] **Company 1**
         *   [ ] Company 2
         *   [ ] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [1]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 1);

        await click(scMenu.el.querySelectorAll(".toggle_company")[1]);
        /**
         *   [x] **Company 1**
         *   [x] Company 2      -> toggle
         *   [ ] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [1, 2]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 1);

        await click(scMenu.el.querySelectorAll(".toggle_company")[0]);
        /**
         *   [ ] Company 1       -> toggle
         *   [x] **Company 2**
         *   [ ] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [2]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 2);

        await click(scMenu.el.querySelectorAll(".toggle_company")[1]);
        /**
         *   [ ] Company 1
         *   [x] **Company 2**  -> tried to toggle
         *   [ ] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [2]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 2);

        await click(scMenu.el.querySelectorAll(".toggle_company")[2]);
        /**
         *   [ ] Company 1
         *   [x] **Company 2**
         *   [x] Company 3      -> toggle
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [2, 3]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 2);

        await click(scMenu.el.querySelectorAll(".toggle_company")[0]);
        /**
         *   [x] Company 1      -> toggle
         *   [x] **Company 2**
         *   [x] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [2, 3, 1]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 2);

        await click(scMenu.el.querySelectorAll(".log_into")[0]);
        /**
         *   [x] **Company 1**      -> click label
         *   [x] Company 2
         *   [x] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [1, 2, 3]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 1);

        await click(scMenu.el.querySelectorAll(".log_into")[0]);
        /**
         *   [x] **Company 1**      -> tried to click label
         *   [x] Company 2
         *   [x] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [1, 2, 3]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 1);

        await click(scMenu.el.querySelectorAll(".toggle_company")[0]);
        /**
         *   [ ] Company 1      -> toggle
         *   [x] **Company 2**
         *   [x] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [2, 3]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 2);

        await click(scMenu.el.querySelectorAll(".log_into")[0]);
        /**
         *   [x] **Company 1**      -> click label
         *   [x] Company 2
         *   [x] Company 3
         */
        assert.deepEqual(scMenu.env.services.company.allowedCompanyIds, [1, 2, 3]);
        assert.strictEqual(scMenu.env.services.company.currentCompany.id, 1);
    });
});
