/** @odoo-module **/

import { click, start } from "@mail/../tests/helpers/test_utils";

import { patchWithCleanup } from "@web/../tests/helpers/utils";

QUnit.module("documents", {}, function () {
    QUnit.module("documents_systray_activity_menu_tests.js");

    QUnit.test("activity menu widget: documents request button", async function (assert) {
        const { env } = await start({
            async mockRPC(route, args) {
                if (args.method === "systray_get_activities") {
                    return [];
                }
            },
        });
        patchWithCleanup(env.services.action, {
            doAction(action) {
                assert.strictEqual(action, "documents.action_request_form");
            },
        });

        await click(".o_menu_systray i[aria-label='Activities']");
        assert.containsOnce(document.body, ".o-mail-ActivityMenu");
        assert.containsOnce(document.body, ".o_sys_documents_request");
        await click(".o_sys_documents_request");
        assert.containsNone(document.body, ".o-mail-ActivityMenu");
    });
});
