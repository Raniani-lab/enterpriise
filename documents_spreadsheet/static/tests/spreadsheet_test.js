odoo.define("web.spreadsheet_tests", function (require) {
    "use strict";

    const testUtils = require("web.test_utils");

    const { createActionManager, fields, nextTick, dom } = testUtils;


    QUnit.module("Spreadsheet Client Action", {
        beforeEach: function () {
            this.data = {
                "documents.document": {
                    fields: {
                        name: { string: "Name", type: "char" },
                        spreadsheet_data: { string: "Data", type: "text" },
                        favorited_ids: { string: "Name", type: "many2many" },
                        is_favorited: { string: "Name", type: "boolean" },
                    },
                    records: [
                        { id: 1, name: "My spreadsheet", spreadsheet_data: "{}", is_favorited: false },
                        { id: 2, name: "", spreadsheet_data: "{}", is_favorited: true },
                    ],
                },
            };
        },
    }, function () {
        QUnit.module("Spreadsheet control panel");

        QUnit.test("breadcrumb is rendered in control panel", async function (assert) {
            assert.expect(3);
            const actionManager = await createActionManager({
                actions: [{
                    id: 1,
                    name: "Documents",
                    res_model: "documents.document",
                    type: "ir.actions.act_window",
                    views: [[false, "list"]],
                }],
                archs: {
                    "documents.document,false,list": '<tree><field name="name"/></tree>',
                    "documents.document,false,search": "<search></search>",
                },
                data: this.data,
            });
            await actionManager.doAction(1);
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 1,
              },
            })
            const breadcrumbItems = actionManager.el.querySelectorAll(".breadcrumb-item");
            assert.equal(breadcrumbItems[0].querySelector("a").innerText, "Documents",
                "It should display the breadcrumb");
            assert.equal(breadcrumbItems[1].querySelector("input").value, "My spreadsheet",
                "It should display the spreadsheet title");
            assert.ok(breadcrumbItems[1].querySelector(".o_spreadsheet_favorite"),
                "It should display the favorite toggle button");
            actionManager.destroy();
        });

        QUnit.test("untitled speadsheet", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            assert.equal(input.value, "", "It should be empty");
            assert.equal(input.placeholder, "Untitled spreadsheet", "It should display a placeholder");
            await nextTick();
            actionManager.destroy();
        });

        QUnit.test("input width changes when content changes", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "My");
            let width = input.offsetWidth;
            await fields.editInput(input, "My title");
            assert.ok(width < input.offsetWidth, "It should have grown to fit content");
            width = input.offsetWidth;
            await fields.editInput(input, "");
            assert.ok(width < input.offsetWidth, "It should have the size of the placeholder text");
            actionManager.destroy();
        });

        QUnit.test("changing the input saves the name", async function (assert) {
            assert.expect(4);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "write" && args.model === "documents.document") {
                        assert.step("spreadsheet_name_saved");
                        assert.deepEqual(args.args[0], [2], "It should write the correct document");
                        assert.deepEqual(args.args[1], { name: "My spreadsheet" }, "It should write the name");
                        return true;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editAndTrigger(input, "My spreadsheet",  ["change"]);
            assert.verifySteps(["spreadsheet_name_saved"]);
            actionManager.destroy();
        });

        QUnit.test("trailing white spaces are trimed", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "My spreadsheet  ");
            const width = input.offsetWidth;
            await dom.triggerEvent(input, "change");
            assert.equal(input.value, "My spreadsheet", "It should not have trailing white spaces");
            assert.ok(width > input.offsetWidth, "It should have resized");
            actionManager.destroy();
        });

        QUnit.test("focus sets the placeholder as value and select it", async function (assert) {
            assert.expect(4);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            assert.equal(input.value, "", "It should be empty");
            await dom.triggerEvent(input, "focus");
            assert.equal(input.value, "Untitled spreadsheet", "Placeholder should have become the input value");
            assert.equal(input.selectionStart, 0, "It should have selected the value");
            assert.equal(input.selectionEnd, input.value.length, "It should have selected the value");
            actionManager.destroy();
        });

        QUnit.test("only white spaces show the placeholder", async function (assert) {
            assert.expect(2);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
              type: "ir.actions.client",
              tag: "action_open_spreadsheet",
              params: {
                active_id: 2,
              },
            });
            const input = actionManager.el.querySelector(".breadcrumb-item input");
            await fields.editInput(input, "  ");
            const width = input.offsetWidth;
            await dom.triggerEvent(input, "change");
            assert.equal(input.value, "", "It should be empty");
            assert.ok(width < input.offsetWidth, "It should have the placeholder size");
            actionManager.destroy();
        });

        QUnit.test("toggle favorite", async function (assert) {
            assert.expect(5);
            const actionManager = await createActionManager({
                data: this.data,
                mockRPC: async function (route, args) {
                    if (args.method === "toggle_favorited" && args.model === "documents.document") {
                        assert.step("favorite_toggled");
                        assert.deepEqual(args.args[0], [1], "It should write the correct document");
                        return;
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: 1,
                },
            });
            assert.containsNone(actionManager, ".favorite_button_enabled");
            const favorite = actionManager.el.querySelector(".o_spreadsheet_favorite");
            await dom.click(favorite);
            assert.containsOnce(actionManager, ".favorite_button_enabled");
            assert.verifySteps(["favorite_toggled"]);
            actionManager.destroy();
        });

        QUnit.test("already favorited", async function (assert) {
            assert.expect(1);
            const actionManager = await createActionManager({
                data: this.data,
            });
            await actionManager.doAction({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: {
                    active_id: 2,
                },
            });
            assert.containsOnce(actionManager, ".favorite_button_enabled", "It should already be favorited");
            actionManager.destroy();
        });

    });
});
