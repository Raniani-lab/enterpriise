/** @odoo-module */
import {
    click,
    dragAndDrop,
    editInput,
    getFixture,
    makeDeferred,
    nextTick,
    patchWithCleanup,
    selectDropdownItem,
} from "@web/../tests/helpers/utils";
import {
    createViewEditor,
    disableHookAnimation,
    makeArchChanger,
    registerViewEditorDependencies,
    selectorContains,
} from "@web_studio/../tests/client_action/view_editors/view_editor_tests_utils";
import { browser } from "@web/core/browser/browser";
import { fieldService } from "@web/core/field_service";
import { CodeEditor } from "@web/core/code_editor/code_editor";
import { registry } from "@web/core/registry";

/* global ace */

QUnit.module("View Editors", () => {
    QUnit.module("Interactive Editor", (hooks) => {
        let target, serverData;
        hooks.beforeEach(() => {
            target = getFixture();
            serverData = {
                models: {
                    coucou: {
                        fields: {
                            product_id: {
                                type: "many2one",
                                relation: "product",
                                store: true,
                                string: "Product",
                            },
                        },
                        records: [],
                    },
                    product: {
                        fields: {
                            display_name: { type: "char", string: "display name" },
                            m2o: { type: "many2one", string: "m2o", relation: "partner" },
                            partner_ids: {
                                type: "one2many",
                                string: "Partners",
                                relation: "partner",
                            },
                            m2m: { type: "many2many", relation: "prices", string: "Prices" },
                        },
                        records: [],
                    },
                    partner: {
                        fields: {},
                        records: [],
                    },
                    prices: {
                        fields: {},
                        records: [],
                    },
                },
            };

            registerViewEditorDependencies();
            registry.category("services").add("field", fieldService);
            patchWithCleanup(browser, {
                setTimeout: (fn) => fn(),
            });
        });

        QUnit.test("add a monetary field without currency_id", async function (assert) {
            assert.expect(4);

            serverData.models.product.fields.monetary_field = {
                string: "Monetary",
                type: "monetary",
                store: true,
            };
            const arch = "<tree><field name='display_name'/></tree>";
            await createViewEditor({
                type: "list",
                serverData,
                resModel: "coucou",
                arch,
                mockRPC: function (route, args) {
                    if (route === "/web_studio/edit_view") {
                        assert.deepEqual(args.operations[0].node.field_description, {
                            field_description: "Currency",
                            model_name: "coucou",
                            name: "x_currency_id",
                            relation: "res.currency",
                            type: "many2one",
                        });
                    }
                },
            });

            const currencyCreationText =
                "In order to use a monetary field, you need a currency field on the model. Do you want to create a currency field first? You can make this field invisible afterwards.";

            // add a monetary field
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_monetary"),
                target.querySelector("th.o_web_studio_hook")
            );
            assert.strictEqual(
                target.querySelector(".modal-body").textContent,
                currencyCreationText,
                "this should trigger an alert"
            );
            await click(selectorContains(target, ".modal-footer .btn", "Cancel"));

            // add a related monetary field
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_related"),
                target.querySelector("th.o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal .o_model_field_selector");
            await click(target.querySelector(".modal .o_model_field_selector")); // open the selector popover
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=product_id] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=monetary_field] button"
                )
            );
            await click(target.querySelector(".modal-footer .btn-primary"));
            assert.strictEqual(
                target.querySelector(".o_dialog:not(.o_inactive_modal) .modal-body").textContent,
                currencyCreationText,
                "this should trigger an alert"
            );
            await click(
                target.querySelector(".o_dialog:not(.o_inactive_modal) .modal-footer .btn-primary")
            );
        });

        QUnit.test("add a monetary field with currency_id", async function (assert) {
            assert.expect(5);

            serverData.models.product.fields.monetary_field = {
                string: "Monetary",
                type: "monetary",
                store: true,
            };

            serverData.models.coucou.fields.x_currency_id = {
                string: "Currency",
                type: "many2one",
                relation: "res.currency",
                store: true,
            };

            const arch = "<tree><field name='display_name'/></tree>";
            let nbEdit = 0;

            await createViewEditor({
                serverData,
                type: "list",
                resModel: "coucou",
                arch,
                mockRPC: function (route) {
                    if (route === "/web_studio/edit_view") {
                        nbEdit++;
                    }
                },
            });

            // add a monetary field
            assert.containsOnce(
                target,
                ".o_web_studio_list_view_editor [data-studio-xpath]",
                "there should be one node"
            );
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_monetary"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.strictEqual(nbEdit, 1, "the view should have been updated");
            assert.containsNone(target, ".modal");

            // add a related monetary field
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_related"),
                target.querySelector("th.o_web_studio_hook")
            );
            assert.containsOnce(target, ".o_model_field_selector");
            await click(target.querySelector(".modal .o_model_field_selector"));
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=product_id] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=monetary_field] button"
                )
            );
            await click(target.querySelector(".modal-footer .btn-primary"));
            assert.strictEqual(nbEdit, 2, "the view should have been updated");
        });

        QUnit.test("add a related field", async function (assert) {
            serverData.models.coucou.fields.related_field = {
                string: "Related",
                type: "related",
            };
            serverData.models.product.fields.display_name.store = false;
            serverData.models.product.fields.m2o.store = true;

            const changeArch = makeArchChanger();
            let nbEdit = 0;
            const arch = "<tree><field name='display_name'/></tree>";
            await createViewEditor({
                type: "list",
                serverData,
                resModel: "coucou",
                arch,
                mockRPC: function (route, args) {
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");
                        let newArch = arch;
                        if (nbEdit === 0) {
                            assert.strictEqual(
                                args.operations[0].node.field_description.related,
                                "product_id.display_name",
                                "related arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.copy,
                                false,
                                "copy arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.readonly,
                                true,
                                "readonly arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.store,
                                false,
                                "store arg should be correct"
                            );
                            newArch =
                                "<tree><field name='display_name'/><field name='related_field'/></tree>";
                        } else if (nbEdit === 1) {
                            assert.strictEqual(
                                args.operations[1].node.field_description.related,
                                "product_id.m2o",
                                "related arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[1].node.field_description.relation,
                                "partner",
                                "relation arg should be correct for m2o"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.copy,
                                false,
                                "copy arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.readonly,
                                true,
                                "readonly arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[1].node.field_description.store,
                                true,
                                "store arg should be correct"
                            );
                        } else if (nbEdit === 2) {
                            assert.strictEqual(
                                args.operations[2].node.field_description.related,
                                "product_id.partner_ids",
                                "related arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[2].node.field_description.relational_model,
                                "product",
                                "relational model arg should be correct for o2m"
                            );
                            assert.strictEqual(
                                args.operations[2].node.field_description.store,
                                false,
                                "store arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.copy,
                                false,
                                "copy arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[0].node.field_description.readonly,
                                true,
                                "readonly arg should be correct"
                            );
                        } else if (nbEdit === 3) {
                            assert.strictEqual(
                                args.operations[3].node.field_description.related,
                                "product_id.m2m",
                                "related arg should be correct"
                            );
                            assert.strictEqual(
                                args.operations[3].node.field_description.relation,
                                "prices",
                                "relational model arg should be correct for m2m"
                            );
                            assert.strictEqual(
                                args.operations[3].node.field_description.store,
                                false,
                                "store arg should be correct"
                            );
                        }
                        nbEdit++;
                        changeArch(args.view_id, newArch);
                    }
                },
            });

            disableHookAnimation(target);
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_related"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal");

            // try to create an empty related field
            const confirmBtn = selectorContains(target, ".modal button", "Confirm");
            assert.hasClass(confirmBtn, "disabled");
            await click(confirmBtn);
            assert.verifySteps([]);

            assert.containsOnce(target, ".modal");

            await click(target.querySelector(".modal .o_model_field_selector"));

            assert.containsOnce(
                target,
                ".o_model_field_selector_popover li",
                "there should only be one available field (the many2one)"
            );

            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=product_id] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=display_name] button"
                )
            );
            await click(target.querySelector(".modal-footer .btn-primary"));
            assert.verifySteps(["edit_view"]);

            await click(selectorContains(target, ".o_web_studio_sidebar .nav-link", "Add"));
            // create a new many2one related field
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_related"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal");

            await click(target.querySelector(".modal .o_model_field_selector"));
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=product_id] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=m2o] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover .o_model_field_selector_popover_close"
                )
            );
            await click(target.querySelector(".modal-footer .btn-primary"));
            assert.verifySteps(["edit_view"]);

            await click(selectorContains(target, ".o_web_studio_sidebar .nav-link", "Add"));
            // create a new one2many related field
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_related"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal");
            await click(target.querySelector(".modal .o_model_field_selector"));
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=product_id] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=partner_ids] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover .o_model_field_selector_popover_close"
                )
            );
            await click(target.querySelector(".modal-footer .btn-primary"));
            assert.verifySteps(["edit_view"]);

            // create a new many2many related field
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_related"),
                target.querySelector(".o_web_studio_hook")
            );

            assert.containsOnce(target, ".modal");
            await click(target.querySelector(".modal .o_model_field_selector"));
            await click(
                target.querySelector(
                    ".o_model_field_selector_popover li[data-name=product_id] button.o_model_field_selector_popover_item_relation"
                )
            );
            await click(
                target.querySelector(".o_model_field_selector_popover li[data-name=m2m] button")
            );
            await click(target.querySelector(".modal-footer .btn-primary")); // confirm
            assert.verifySteps(["edit_view"]);
        });

        QUnit.test("add a one2many field", async function (assert) {
            const arch = `<form><group>
                <field name="display_name"/>
            </group></form>`;
            await createViewEditor({
                type: "form",
                serverData,
                resModel: "coucou",
                arch,
                mockRPC: function (route, args) {
                    if (args.method === "name_search") {
                        return Promise.resolve([
                            [1, "Field 1"],
                            [2, "Field 2"],
                        ]);
                    }
                    if (args.method === "search_count" && args.model === "ir.model.fields") {
                        assert.step("search_count ir.model.fields");
                        assert.deepEqual(
                            args.args,
                            [
                                [
                                    ["relation", "=", "coucou"],
                                    ["ttype", "=", "many2one"],
                                ],
                            ],
                            "the domain should be correctly set when checking if the m2o for o2m exists or not"
                        );
                        return 2;
                    }
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");
                    }
                },
            });

            disableHookAnimation(target);
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_one2many"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal");
            assert.verifySteps(["search_count ir.model.fields"]);

            // try to confirm without specifying a related field
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsOnce(target, ".modal");

            await selectDropdownItem(target.querySelector(".modal"), "relation_id", "Field 1");
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsNone(target, ".modal");
            assert.verifySteps(["edit_view"], "should have created the field");
        });

        QUnit.test("add a one2many field without many2one", async function (assert) {
            assert.expect(3);

            const arch = `<form><group>
                <field name="display_name"/>
            </group></form>`;
            await createViewEditor({
                serverData,
                type: "form",
                resModel: "partner",
                arch: arch,
                mockRPC: function (route, args) {
                    if (args.method === "search_count" && args.model === "ir.model.fields") {
                        assert.deepEqual(
                            args.args,
                            [
                                [
                                    ["relation", "=", "partner"],
                                    ["ttype", "=", "many2one"],
                                ],
                            ],
                            "the domain should be correctly set when checking if the m2o for o2m exists or not"
                        );
                        return 0;
                    }
                },
            });
            disableHookAnimation(target);

            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_one2many"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.strictEqual(
                target.querySelector(".modal .modal-title").textContent,
                "No related many2one fields found"
            );
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsNone(target, ".modal", "the modal should be closed");
        });

        QUnit.test("add a one2many lines field", async function (assert) {
            const arch = `
                <form>
                    <group>
                        <field name="display_name"/>
                    </group>
                </form>`;
            await createViewEditor({
                serverData,
                type: "form",
                resModel: "partner",
                arch: arch,
                mockRPC: function (route, args) {
                    if (args.method === "search_count") {
                        throw new Error("should not do a search_count");
                    }
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");
                        assert.strictEqual(
                            args.operations[0].node.field_description.special,
                            "lines"
                        );
                    }
                },
            });
            disableHookAnimation(target);
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_lines"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.verifySteps(["edit_view"]);
        });

        QUnit.test("add a many2many field", async function (assert) {
            const arch = `<form><group>
                <field name="display_name"/>
            </group></form>`;
            await createViewEditor({
                serverData,
                type: "form",
                resModel: "coucou",
                arch: arch,
                mockRPC: function (route, args) {
                    if (args.method === "name_search") {
                        return Promise.resolve([
                            [1, "Model 1"],
                            [2, "Model 2"],
                        ]);
                    }
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");

                        const fieldDescr = args.operations[0].node.field_description;
                        assert.ok(fieldDescr.name.startsWith("x_studio_many2many"));
                        delete fieldDescr.name;
                        assert.deepEqual(fieldDescr, {
                            field_description: "New Many2Many",
                            model_name: "coucou",
                            relation_id: 1,
                            type: "many2many",
                        });
                    }
                },
            });

            disableHookAnimation(target);
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_many2many"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal");

            // try to confirm without specifying a relation
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsOnce(target, ".modal");

            await selectDropdownItem(target.querySelector(".modal"), "relation_id", "Model 1");
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsNone(target, ".modal");
            assert.verifySteps(["edit_view"], "should have created the field");
        });

        QUnit.test("add a many2one field", async function (assert) {
            assert.expect(7);

            const arch = `<form><group>
                <field name="display_name"/>
            </group></form>`;
            await createViewEditor({
                serverData,
                type: "form",
                resModel: "coucou",
                arch: arch,
                mockRPC: function (route, args) {
                    if (args.method === "name_search") {
                        return Promise.resolve([
                            [1, "Model 1"],
                            [2, "Model 2"],
                        ]);
                    }
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");

                        const fieldDescr = args.operations[0].node.field_description;
                        assert.ok(fieldDescr.name.startsWith("x_studio_many2one"));
                        delete fieldDescr.name;
                        assert.deepEqual(fieldDescr, {
                            field_description: "New Many2One",
                            model_name: "coucou",
                            relation_id: 1,
                            type: "many2one",
                        });
                    }
                },
            });

            disableHookAnimation(target);
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_many2one"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.containsOnce(target, ".modal");

            // try to confirm without specifying a relation
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsOnce(target, ".modal");

            await selectDropdownItem(target.querySelector(".modal"), "relation_id", "Model 1");
            await click(target.querySelector(".modal button.btn-primary"));
            assert.containsNone(target, ".modal");
            assert.verifySteps(["edit_view"], "should have created the field");
        });

        QUnit.test("switch mode after element removal", async function (assert) {
            const changeArch = makeArchChanger();
            await createViewEditor({
                serverData,
                type: "list",
                resModel: "coucou",
                arch: "<tree><field name='id'/><field name='display_name'/></tree>",
                mockRPC: function (route, args) {
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");
                        // the server sends the arch in string but it's post-processed
                        // by the ViewEditorManager
                        const newArch = "<tree><field name='display_name'/></tree>";
                        changeArch(args.view_id, newArch);
                    }
                },
            });

            assert.containsN(
                target,
                ".o_web_studio_list_view_editor [data-studio-xpath]",
                2,
                "there should be two nodes"
            );

            await click(target.querySelector(".o_web_studio_list_view_editor [data-studio-xpath]"));

            assert.strictEqual(
                target.querySelector('.o_web_studio_sidebar input[name="string"]').value,
                "ID"
            );

            // delete a field
            await click(target.querySelector(".o_web_studio_sidebar .o_web_studio_remove"));
            await click(target.querySelector(".modal .btn-primary"));
            assert.verifySteps(["edit_view"]);
            assert.containsOnce(
                target,
                ".o_web_studio_list_view_editor [data-studio-xpath]",
                "there should be one node"
            );
            assert.strictEqual(
                target.querySelector(".o_web_studio_sidebar .nav-link.active").textContent,
                "Add"
            );
        });

        QUnit.test("open XML editor in read-only", async function (assert) {
            patchWithCleanup(odoo, {
                debug: true,
            });

            const def = makeDeferred();
            patchWithCleanup(CodeEditor.prototype, {
                setup() {
                    this._super();
                    owl.onMounted(() => def.resolve());
                },
                get aceTheme() {
                    return false;
                },
            });

            const arch = "<form><sheet><field name='display_name'/></sheet></form>";
            await createViewEditor({
                serverData,
                type: "form",
                resModel: "coucou",
                arch: arch,
                mockRPC: function (route, args) {
                    if (route === "/web_editor/get_assets_editor_resources") {
                        assert.step("editor_resources");
                        assert.strictEqual(
                            args.key,
                            99999999,
                            "the correct view should be fetched"
                        );
                        return Promise.resolve({
                            views: [
                                {
                                    active: true,
                                    arch: arch,
                                    id: 99999999,
                                    inherit_id: false,
                                },
                            ],
                            scss: [],
                            js: [],
                        });
                    }

                    if (route === "/web/static/lib/ace/ace.js") {
                        return undefined;
                    }
                    if (route.startsWith("/web/static/lib/ace/")) {
                        return true;
                    }
                },
            });

            assert.containsOnce(
                target,
                ".o_web_studio_view_renderer .o_form_readonly.o_web_studio_form_view_editor",
                "the form editor should be displayed"
            );

            // open the XML editor
            await click(selectorContains(target, ".o_web_studio_sidebar .nav-link", "View"));
            assert.containsOnce(
                target,
                ".o_web_studio_sidebar .o_web_studio_open_xml_editor",
                "there should be a button to open the XML editor"
            );
            await click(
                target.querySelector(".o_web_studio_sidebar .o_web_studio_open_xml_editor")
            );
            await def;
            await nextTick();
            assert.verifySteps(["editor_resources"]);
            assert.containsOnce(
                target,
                ".o_web_studio_view_renderer .o_form_readonly:not(.o_web_studio_form_view_editor)"
            );
            assert.containsOnce(target, ".o_web_studio_xml_editor .ace_editor");
        });

        QUnit.test("XML editor: reset operations stack", async function (assert) {
            patchWithCleanup(odoo, {
                debug: true,
            });

            const def = makeDeferred();
            patchWithCleanup(CodeEditor.prototype, {
                setup() {
                    this._super();
                    owl.onMounted(() => def.resolve());
                },
                get aceTheme() {
                    return false;
                },
            });

            const arch = "<form><sheet><field name='display_name'/></sheet></form>";
            await createViewEditor({
                serverData,
                type: "form",
                resModel: "coucou",
                arch: arch,
                mockRPC: function (route, args) {
                    if (route === "/web_studio/edit_view") {
                        assert.step("edit_view");
                        assert.strictEqual(args.operations.length, 1);
                    } else if (route === "/web_studio/edit_view_arch") {
                        assert.step("edit_view_arch");
                    } else if (route === "/web_editor/get_assets_editor_resources") {
                        assert.strictEqual(
                            args.key,
                            99999999,
                            "the correct view should be fetched"
                        );
                        return Promise.resolve({
                            views: [
                                {
                                    active: true,
                                    arch: arch,
                                    id: 1,
                                    inherit_id: false,
                                    name: "base view",
                                },
                                {
                                    active: true,
                                    arch: "<data/>",
                                    id: "__test_studio_view_arch__",
                                    inherit_id: 1,
                                    name: "studio view",
                                },
                            ],
                            scss: [],
                            js: [],
                        });
                    }
                },
            });
            assert.containsOnce(
                target,
                ".o_web_studio_form_view_editor",
                "the form editor should be displayed"
            );
            // do an operation
            await click(
                target.querySelector(
                    '.o_web_studio_form_view_editor .o_field_widget[name="display_name"]'
                )
            );
            await editInput(
                target.querySelector('.o_web_studio_sidebar input[name="string"]'),
                null,
                "Kikou"
            );
            assert.verifySteps(["edit_view"]);

            // open the XML editor
            await click(selectorContains(target, ".o_web_studio_sidebar .nav-link", "View"));
            assert.containsOnce(
                target,
                ".o_web_studio_sidebar .o_web_studio_open_xml_editor",
                "there should be a button to open the XML editor"
            );
            await click(
                target.querySelector(".o_web_studio_sidebar .o_web_studio_open_xml_editor")
            );
            await def;

            await click(
                target.querySelector(
                    ".o_web_studio_xml_resource_select_menu .o_select_menu_toggler"
                )
            );
            const studioView = selectorContains(
                target,
                ".o_web_studio_xml_resource_select_menu .o_select_menu_menu .o_select_menu_item",
                "studio view"
            );
            await click(studioView);

            ace.edit(target.querySelector(".o_web_studio_xml_editor .ace_editor")).setValue(
                "<data/>"
            );
            await click(target.querySelector(".o_web_studio_xml_editor button.btn-primary"));
            assert.verifySteps(["edit_view_arch"]);
            // close XML editor
            await click(
                selectorContains(target, ".o_web_studio_xml_editor button.btn-secondary", "Close")
            );

            await click(
                target.querySelector(
                    '.o_web_studio_form_view_editor .o_field_widget[name="display_name"]'
                )
            );
            await editInput(
                target.querySelector('.o_web_studio_sidebar input[name="string"]'),
                null,
                "Kikou"
            );
            assert.verifySteps(["edit_view"]);
        });

        QUnit.test("blockUI not removed just after rename", async function (assert) {
            patchWithCleanup(odoo, {
                debug: true,
            });

            const blockUIServ = {
                start(env) {
                    Object.defineProperty(env, "isSmall", {
                        get() {
                            return false;
                        },
                    });
                    return {
                        block: () => assert.step("block"),
                        unblock: () => assert.step("unblock"),
                    };
                },
            };
            registry.category("services").add("ui", blockUIServ);

            const changeArch = makeArchChanger();
            await createViewEditor({
                serverData,
                type: "list",
                resModel: "coucou",
                arch: "<tree><field name='display_name'/></tree>",
                mockRPC: function (route, args) {
                    assert.step(route);
                    if (route === "/web_studio/edit_view") {
                        const fieldName = args.operations[0].node.field_description.name;
                        const newArch = `<tree><field name='${fieldName}'/><field name='display_name'/></tree>`;
                        serverData.models.coucou.fields[fieldName] = {
                            string: "Coucou",
                            type: "char",
                        };
                        changeArch(args.view_id, newArch);
                    } else if (route === "/web_studio/rename_field") {
                        // random value returned in order for the mock server to know that this route is implemented.
                        return true;
                    }
                },
            });
            disableHookAnimation(target);
            assert.verifySteps([
                "/web/dataset/call_kw/coucou/get_views",
                "/web_studio/get_studio_view_arch",
                "/web/dataset/call_kw/coucou/web_search_read",
                "/web/dataset/call_kw/res.users/has_group",
            ]);

            assert.containsOnce(target, "thead th[data-studio-xpath]");
            // create a new field before existing one
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_char"),
                target.querySelector(".o_web_studio_hook")
            );
            assert.verifySteps([
                "block",
                "/web_studio/edit_view",
                "/web/dataset/call_kw/coucou/web_search_read",
                "unblock",
                "/web_studio/get_default_value",
            ]);
            await nextTick();
            assert.containsN(target, "thead th[data-studio-xpath]", 2);

            // rename the field
            await editInput(
                target.querySelector('.o_web_studio_sidebar input[name="string"]'),
                null,
                "new"
            );

            assert.verifySteps([
                "block",
                "/web_studio/rename_field",
                "/web_studio/edit_view",
                "/web/dataset/call_kw/coucou/web_search_read",
                "/web_studio/get_default_value",
                "unblock",
            ]);
        });

        QUnit.test("blockUI not removed just after field dropped", async function (assert) {
            assert.expect(6);

            const blockUIServ = {
                start(env) {
                    Object.defineProperty(env, "isSmall", {
                        get() {
                            return false;
                        },
                    });
                    return {
                        block: () => assert.step("block"),
                        unblock: () => assert.step("unblock"),
                    };
                },
            };
            registry.category("services").add("ui", blockUIServ);

            const changeArch = makeArchChanger();
            const arch = "<tree><field name='display_name'/></tree>";
            await createViewEditor({
                type: "list",
                serverData,
                resModel: "coucou",
                arch,
                mockRPC: function (route, args) {
                    if (route === "/web_studio/edit_view") {
                        assert.step(route);
                        const fieldName = args.operations[0].node.field_description.name;
                        const newArch = `<tree><field name='${fieldName}'/><field name='display_name'/></tree>`;
                        serverData.models.coucou.fields[fieldName] = {
                            string: "Coucou",
                            type: "char",
                        };
                        changeArch(args.view_id, newArch);
                    }
                },
            });
            disableHookAnimation(target);
            assert.containsOnce(target, "thead th[data-studio-xpath]");

            // create a new field before existing one
            await dragAndDrop(
                target.querySelector(".o_web_studio_new_fields .o_web_studio_field_char"),
                target.querySelector(".o_web_studio_hook")
            );
            await nextTick();
            assert.containsN(target, "thead th[data-studio-xpath]", 2);

            assert.verifySteps(["block", "/web_studio/edit_view", "unblock"]);
        });

        QUnit.test("arch classes are reflected in the DOM", async (assert) => {
            await createViewEditor({
                type: "kanban",
                resModel: "coucou",
                serverData,
                arch: `<kanban class="my_custom_class my_custom_class2">
                    <templates>
                        <t t-name='kanban-box'>
                            <div class='oe_kanban_card'>
                                <field name='display_name'/>
                            </div>
                        </t>
                    </templates>
                </kanban>`,
            });
            assert.hasClass(
                target.querySelector(".o_web_studio_view_renderer .o_view_controller"),
                "o_kanban_view my_custom_class my_custom_class2"
            );
        });
    });
});