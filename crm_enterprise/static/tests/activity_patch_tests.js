/* @odoo-module */

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";
import { addModelNamesToFetch } from "@bus/../tests/helpers/model_definitions_helpers";

addModelNamesToFetch(["crm.lead"]);

QUnit.module("activity (patch)");

QUnit.test("click on activity Lead/Opportunity clock should open crm.lead view", async (assert) => {
    const pyEnv = await startServer();
    const leadId = pyEnv["crm.lead"].create({});
    pyEnv["mail.activity"].create({
        res_id: leadId,
        res_model: "crm.lead",
    });
    const views = {
        "crm.lead,false,pivot": ` <pivot string="crm.lead"><field name="name" /></pivot>`,
        "crm.lead,false,cohort": `<cohort date_start="start" date_stop="stop"/>`,
        "crm.lead,false,map": `<map routing="1"><field name="name"/></map>`,
    };
    await start({ serverData: { views } });
    await click(".o_menu_systray i[aria-label='Activities']");
    await click(".o-mail-ActivityGroup button[title='Summary']");
    assert.containsOnce(document.body, ".o_breadcrumb .active:contains(crm.lead)");
});
