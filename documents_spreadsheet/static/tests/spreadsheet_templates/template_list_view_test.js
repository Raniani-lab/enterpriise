/** @odoo-module */

import { dom, createView } from "web.test_utils";
import TemplateListView from "documents_spreadsheet.TemplateListView";
import { getBasicData } from "@spreadsheet/../tests/utils/data";

QUnit.module("documents_spreadsheet > template list view", {}, () => {
    QUnit.test("Open spreadsheet template from list view", async function (assert) {
        const list = await createView({
            View: TemplateListView,
            model: "spreadsheet.template",
            data: getBasicData(),
            arch: /*xml*/ `
                <tree>
                    <field name="name"/>
                    <button string="Edit" class="float-right" name="edit_template" icon="fa-pencil" />
                </tree>
            `,
            intercepts: {
                do_action: function ({ data }) {
                    assert.step("redirect_to_template");
                    assert.deepEqual(data.action, {
                        type: "ir.actions.client",
                        tag: "action_open_template",
                        params: {
                            spreadsheet_id: 1,
                            showFormulas: true,
                        },
                    });
                },
            },
        });
        await dom.clickFirst(`button[name="edit_template"]`);
        assert.verifySteps(["redirect_to_template"]);
        list.destroy();
    });

    QUnit.test("Copy template from list view", async function (assert) {
        const list = await createView({
            View: TemplateListView,
            model: "spreadsheet.template",
            data: getBasicData(),
            arch: /*xml*/`
                <tree>
                    <field name="name"/>
                    <button string="Make a copy" class="float-right" name="copy" type="object" icon="fa-clone" />
                </tree>
            `,
            intercepts: {
                execute_action: function ({ data }) {
                    assert.strictEqual(
                        data.action_data.name,
                        "copy",
                        "should call the copy method"
                    );
                    assert.equal(data.env.currentID, 1, "template with ID 1 should be copied");
                    assert.step("add_copy_of_template");
                },
            },
        });
        await dom.clickFirst(`button[name="copy"]`);
        assert.verifySteps(["add_copy_of_template"]);
        list.destroy();
    });
});
