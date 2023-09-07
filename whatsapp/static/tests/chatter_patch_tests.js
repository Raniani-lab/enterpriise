/* @odoo-module */

import { click, contains, start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("chatter (patch)");

QUnit.test(
    "WhatsApp template message composer dialog should be open after clicking on whatsapp button",
    async (assert) => {
        const pyEnv = await startServer();
        pyEnv["whatsapp.template"].create({
            name: "WhatsApp Template 1",
            model: "res.partner",
        });
        const { openFormView } = await start();
        await openFormView("res.partner", pyEnv.currentPartnerId);
        await click("button:contains(WhatsApp)");
        await contains(".o_dialog");
        assert.containsOnce($, ".o_dialog:contains(Send WhatsApp Message)");
    }
);
