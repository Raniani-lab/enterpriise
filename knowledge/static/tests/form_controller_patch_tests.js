/** @odoo-module **/

import { getFixture } from "@web/../tests/helpers/utils";
import { click, start, startServer } from "@mail/../tests/helpers/test_utils";


QUnit.module("Knowledge - Form Search Button", (hooks) => {
    let serverData;
    let mockRPC;
    let target;
    hooks.beforeEach((assert) => {
        serverData = {
            views: {
                "res.partner,false,form": `
                    <form string="Partners">
                        <sheet>
                            <field name="name"/>
                        </sheet>
                        <div class="oe_chatter">
                            <field name="message_ids"/>
                        </div>
                    </form>`,
            },
        };
        mockRPC = async (route, { method, model }) => {
            if (model === "knowledge.article") {
                switch (method) {
                    case "get_user_sorted_articles":
                        return [];
                    case "check_access_rights":
                        return true;
                }
            } else if (model === "res.partner" && method === "create") {
                assert.step("save");
            }
        };
        target = getFixture();
    });

    QUnit.test("can search for article on existing record", async (assert) => {
        const pyEnv = await startServer();
        const partnerId = pyEnv["res.partner"].create({ name: "John Doe" });
        const { openFormView } = await start({
            serverData,
            mockRPC,
        });
        await openFormView("res.partner", partnerId);
        assert.containsOnce(target, ".o_control_panel_navigation .o_knowledge_icon_search");
        assert.containsNone(target, ".o_command_palette");

        await click(".o_control_panel_navigation .o_knowledge_icon_search");
        assert.containsOnce(target, ".o_command_palette");
        assert.verifySteps([], "shouldn't call save");
    });

    QUnit.test("can search for article when creating valid record", async (assert) => {
        const { openFormView } = await start({
            serverData,
            mockRPC,
        });
        await openFormView("res.partner");
        assert.containsOnce(target, ".o_control_panel_navigation .o_knowledge_icon_search");
        assert.containsNone(target, ".o_command_palette");

        await click(".o_control_panel_navigation .o_knowledge_icon_search");
        assert.containsOnce(target, ".o_command_palette");
        assert.verifySteps(["save"], "should call save");
    });

    QUnit.test("cannot search for article when creating invalid record", async (assert) => {
        serverData.views["res.partner,false,form"] = `
            <form string="Partners">
                <sheet>
                    <field name="name" required="1"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_ids"/>
                </div>
            </form>`;
        const { openFormView } = await start({
            serverData,
            mockRPC,
        });
        await openFormView("res.partner");
        assert.containsOnce(target, ".o_control_panel_navigation .o_knowledge_icon_search");
        assert.containsNone(target, ".o_command_palette");

        await click(".o_control_panel_navigation .o_knowledge_icon_search");
        assert.containsNone(target, ".o_command_palette");
        assert.verifySteps([], "shouldn't call save");
    });
});
