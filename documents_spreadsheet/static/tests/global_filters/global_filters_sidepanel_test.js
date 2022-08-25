/** @odoo-module */
import testUtils from "web.test_utils";

import {
    getBasicData,
    getBasicPivotArch,
    getBasicServerData,
} from "@spreadsheet/../tests/utils/data";
import { click, getFixture, nextTick, patchDate } from "@web/../tests/helpers/utils";
import { createSpreadsheet } from "../spreadsheet_test_utils";
import { createSpreadsheetFromPivotView } from "../utils/pivot_helpers";
import { makeFakeNotificationService } from "@web/../tests/helpers/mock_services";
import { registry } from "@web/core/registry";
import { addGlobalFilter } from "@spreadsheet/../tests/utils/commands";
import { insertPivotInSpreadsheet } from "@spreadsheet/../tests/utils/pivot";
import { insertListInSpreadsheet } from "@spreadsheet/../tests/utils/list";
import { insertGraphInSpreadsheet } from "@spreadsheet/../tests/utils/chart";
import { assertDateDomainEqual } from "@spreadsheet/../tests/utils/date_domain";
import { getCellValue } from "@spreadsheet/../tests/utils/getters";
import { createSpreadsheetFromListView } from "../utils/list_helpers";

let target;

const THIS_YEAR_FILTER = {
    filter: {
        type: "date",
        label: "This Year",
        rangeType: "year",
        defaultValue: { yearOffset: 0 },
        pivotFields: { 1: { field: "date", type: "date" } },
        // duplicate key to support its introduction as data, not just dispatch
        fields: { 1: { field: "date", type: "date" } },
        listFields: { 1: { field: "date", type: "date" } },
    },
};

async function selectYear(yearString) {
    const input = target.querySelector("input.o_datepicker_input.o_input.datetimepicker-input");
    // open the YearPicker
    await click(input);
    // Change input value
    await testUtils.fields.editAndTrigger(input, yearString, ["change"]);
    await nextTick();
}

QUnit.module(
    "documents_spreadsheet > global_filters side panel",
    {
        beforeEach: function () {
            target = getFixture();
        },
    },
    () => {
        QUnit.test("Simple display", async function (assert) {
            assert.expect(6);

            await createSpreadsheetFromPivotView();
            assert.notOk($(target).find(".o_spreadsheet_global_filters_side_panel")[0]);
            const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
            await testUtils.dom.click(searchIcon);
            assert.ok($(target).find(".o_spreadsheet_global_filters_side_panel")[0]);
            const items = $(target).find(
                ".o_spreadsheet_global_filters_side_panel .o-sidePanelButton"
            );
            assert.equal(items.length, 3);
            assert.ok(items[0].classList.contains("o_global_filter_new_time"));
            assert.ok(items[1].classList.contains("o_global_filter_new_relation"));
            assert.ok(items[2].classList.contains("o_global_filter_new_text"));
        });

        QUnit.test("Display with an existing 'Date' global filter", async function (assert) {
            assert.expect(4);

            const { model } = await createSpreadsheetFromPivotView();
            const label = "This year";
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "date",
                    rangeType: "year",
                    label,
                    pivotFields: {},
                    defaultValue: {},
                },
            });
            const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
            await testUtils.dom.click(searchIcon);
            const items = $(target).find(
                ".o_spreadsheet_global_filters_side_panel .o_side_panel_section"
            );
            assert.equal(items.length, 2);
            const labelElement = items[0].querySelector(".o_side_panel_filter_label");
            assert.equal(labelElement.innerText, label);
            await testUtils.dom.click(items[0].querySelector(".o_side_panel_filter_icon.fa-cog"));
            assert.ok($(target).find(".o_spreadsheet_filter_editor_side_panel"));
            assert.equal($(target).find(".o_global_filter_label")[0].value, label);
        });

        QUnit.test("Pivot display name is displayed in field matching", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            const [pivotId] = model.getters.getPivotIds();
            model.dispatch("RENAME_ODOO_PIVOT", { pivotId, name: "Hello" });
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "date",
                    rangeType: "year",
                    label: "This year",
                    pivotFields: {},
                    defaultValue: {},
                },
            });

            await click(target, ".o_topbar_filter_icon");
            await click(target, ".o_side_panel_filter_icon.fa-cog");
            const name = target.querySelector(".o_pivot_field_matching .fw-medium").innerText;
            assert.strictEqual(name, "Hello");
        });

        QUnit.test("List display name is displayed in field matching", async function (assert) {
            const { model } = await createSpreadsheetFromListView();
            const [listId] = model.getters.getListIds();
            model.dispatch("RENAME_ODOO_LIST", { listId, name: "Hello" });
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "date",
                    rangeType: "year",
                    label: "This year",
                    listFields: {},
                    defaultValue: {},
                },
            });

            await click(target, ".o_topbar_filter_icon");
            await click(target, ".o_side_panel_filter_icon.fa-cog");
            const name = target.querySelector(".o_pivot_field_matching .fw-medium").innerText;
            assert.strictEqual(name, "Hello");
        });

        QUnit.test("Create a new global filter", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
            await testUtils.dom.click(searchIcon);
            const newText = $(target).find(".o_global_filter_new_text")[0];
            await testUtils.dom.click(newText);
            assert.equal($(target).find(".o-sidePanel").length, 1);
            const input = $(target).find(".o_global_filter_label")[0];
            await testUtils.fields.editInput(input, "My Label");
            const value = $(target).find(".o_global_filter_default_value")[0];
            await testUtils.fields.editInput(value, "Default Value");
            // Can't make it work with the DOM API :(
            // await testUtils.dom.triggerEvent($(target).find(".o_field_selector_value"), "focusin");
            $($(target).find(".o_field_selector_value")).focusin();
            await testUtils.dom.click(
                $(target).find(".o_field_selector_select_button[data-name='display_name']")
            );
            assert.containsNone(target, ".o_filter_field_offset", "No offset for text filter");
            const save = $(target).find(
                ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
            )[0];
            await testUtils.dom.click(save);
            assert.equal($(target).find(".o_spreadsheet_global_filters_side_panel").length, 1);
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "My Label");
            assert.equal(globalFilter.defaultValue, "Default Value");
        });

        QUnit.test("Create a new relational global filter", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView({
                serverData: {
                    models: getBasicData(),
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
            await testUtils.dom.click(searchIcon);
            const newRelation = $(target).find(".o_global_filter_new_relation")[0];
            await testUtils.dom.click(newRelation);
            const selector = `.o_side_panel_related_model input`;
            await testUtils.dom.click($(target).find(selector)[0]);
            const item = target.querySelector(".o_model_selector_product");
            await click(item);
            assert.containsNone(
                target,
                ".o_filter_field_offset",
                "No offset for relational filter"
            );
            const save = $(target).find(
                ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
            )[0];
            await testUtils.dom.click(save);
            assert.equal($(target).find(".o_spreadsheet_global_filters_side_panel").length, 1);
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "Product");
            assert.deepEqual(globalFilter.defaultValue, []);
            assert.deepEqual(globalFilter.pivotFields[1], {
                field: "product_id",
                type: "many2one",
            });
        });

        QUnit.test("Create a new many2many relational global filter", async function (assert) {
            const serverData = getBasicServerData();
            serverData.models["vehicle"] = {
                fields: {},
                records: [],
            };
            serverData.models["partner"].fields.vehicle_ids = {
                relation: "vehicle",
                string: "Vehicle",
                type: "many2many",
            };
            serverData.models["ir.model"].records.push({
                id: 34,
                name: "Vehicle",
                model: "vehicle",
            });
            const { model } = await createSpreadsheetFromPivotView({ serverData });
            await click(target, ".o_topbar_filter_icon");
            await click(target, ".o_global_filter_new_relation");
            await click(target, ".o_side_panel_related_model input");
            await click(target, ".o_model_selector_vehicle");
            assert.strictEqual(
                target.querySelector(".o_field_selector_value").innerText,
                "Vehicle"
            );
            await click(target, ".o_global_filter_save");
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.strictEqual(globalFilter.label, "Vehicle");
            assert.deepEqual(globalFilter.defaultValue, []);
            assert.deepEqual(globalFilter.pivotFields[1], {
                field: "vehicle_ids",
                type: "many2many",
            });
        });

        QUnit.test("Filter component is visible even without data source", async function (assert) {
            await createSpreadsheet();
            assert.containsOnce(target, ".o_topbar_filter_icon");
        });

        QUnit.test("Cannot create a relation filter without data source", async function (assert) {
            await createSpreadsheet();
            await click(target, ".o_topbar_filter_icon");
            assert.containsOnce(target, ".o_global_filter_new_time");
            assert.containsNone(target, ".o_global_filter_new_relation");
            assert.containsOnce(target, ".o_global_filter_new_text");
        });

        QUnit.test(
            "Can create a relation filter with at least a data source",
            async function (assert) {
                await createSpreadsheetFromPivotView();
                await click(target, ".o_topbar_filter_icon");
                assert.containsOnce(target, ".o_global_filter_new_time");
                assert.containsOnce(target, ".o_global_filter_new_relation");
                assert.containsOnce(target, ".o_global_filter_new_text");
            }
        );

        QUnit.test(
            "Creating a date filter without a data source does not display Field Matching",
            async function (assert) {
                await createSpreadsheet();
                await click(target, ".o_topbar_filter_icon");
                await click(target, ".o_global_filter_new_time");
                assert.containsNone(target, ".o_field_matching_title");
            }
        );

        QUnit.test(
            "open relational global filter panel then go to pivot on sheet 2",
            async function (assert) {
                const spreadsheetData = {
                    sheets: [
                        {
                            id: "sheet1",
                        },
                        {
                            id: "sheet2",
                            cells: {
                                A1: { content: `=ODOO.PIVOT("1", "probability")` },
                            },
                        },
                    ],
                    pivots: {
                        1: {
                            id: 1,
                            colGroupBys: ["foo"],
                            domain: [],
                            measures: [{ field: "probability", operator: "avg" }],
                            model: "partner",
                            rowGroupBys: ["bar"],
                            context: {},
                        },
                    },
                };
                const serverData = getBasicServerData();
                serverData.models["documents.document"].records.push({
                    id: 45,
                    raw: JSON.stringify(spreadsheetData),
                    name: "Spreadsheet",
                    handler: "spreadsheet",
                });
                const { model } = await createSpreadsheet({
                    serverData,
                    spreadsheetId: 45,
                });
                const searchIcon = target.querySelector(".o_topbar_filter_icon");
                await click(searchIcon);
                const newRelation = target.querySelector(".o_global_filter_new_relation");
                await click(newRelation);
                const selector = `.o_side_panel_related_model input`;
                await testUtils.dom.click($(target).find(selector)[0]);
                const item = target.querySelector(".o_model_selector_product");
                await click(item);
                const fieldMatching = target.querySelector(".o_pivot_field_matching div");
                assert.equal(
                    fieldMatching.innerText,
                    "partner (Pivot #1)",
                    "model display name is loaded"
                );
                const save = target.querySelector(
                    ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
                );
                await click(save);
                model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: "sheet1", sheetIdTo: "sheet2" });
                await nextTick();
                assert.equal(getCellValue(model, "A1"), 131);
            }
        );

        QUnit.test(
            "Prevent selection of a Field Matching before the Related model",
            async function (assert) {
                assert.expect(2);
                await createSpreadsheetFromPivotView({
                    serverData: {
                        models: getBasicData(),
                        views: {
                            "partner,false,pivot": `
                                <pivot string="Partners">
                                    <field name="foo" type="col"/>
                                    <field name="product_id" type="row"/>
                                    <field name="probability" type="measure"/>
                                </pivot>`,
                            "partner,false,search": `<search/>`,
                        },
                    },
                    mockRPC: async function (route, args) {
                        if (args.method === "search_read" && args.model === "ir.model") {
                            return [{ name: "Product", model: "product" }];
                        }
                    },
                });
                await testUtils.dom.click(".o_topbar_filter_icon");
                await testUtils.dom.click(".o_global_filter_new_relation");
                const relatedModelSelector = `.o_side_panel_related_model input`;
                const fieldMatchingSelector = `.o_pivot_field_matching`;
                assert.containsNone(target, fieldMatchingSelector);
                await testUtils.dom.click(target.querySelector(relatedModelSelector));
                const item = target.querySelector(".o_model_selector_product");
                await click(item);
                assert.containsOnce(target, fieldMatchingSelector);
            }
        );

        QUnit.test("Display with an existing 'Relation' global filter", async function (assert) {
            assert.expect(8);

            const { model } = await createSpreadsheetFromPivotView();
            await insertPivotInSpreadsheet(model, { arch: getBasicPivotArch() });
            const label = "MyFoo";
            const filter = {
                id: "42",
                type: "relation",
                modelName: "product",
                label,
                pivotFields: {
                    1: { type: "many2one", field: "product_id" }, // first pivotId
                    2: { type: "many2one", field: "product_id" }, // second pivotId
                },
                defaultValue: [],
            };
            await addGlobalFilter(model, { filter });
            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await testUtils.dom.click(searchIcon);
            const items = target.querySelectorAll(
                ".o_spreadsheet_global_filters_side_panel .o_side_panel_section"
            );
            assert.equal(items.length, 2);
            const labelElement = items[0].querySelector(".o_side_panel_filter_label");
            assert.equal(labelElement.innerText, label);
            await testUtils.dom.click(items[0].querySelector(".o_side_panel_filter_icon.fa-cog"));
            assert.ok(target.querySelectorAll(".o_spreadsheet_filter_editor_side_panel"));
            assert.equal(target.querySelector(".o_global_filter_label").value, label);
            assert.equal(
                target.querySelector(`.o_side_panel_related_model input`).value,
                "Product"
            );
            const fieldsMatchingElements = target.querySelectorAll(
                "span.o_field_selector_chain_part"
            );
            assert.equal(fieldsMatchingElements.length, 2);
            assert.equal(fieldsMatchingElements[0].innerText, "Product");
            assert.equal(fieldsMatchingElements[1].innerText, "Product");
        });

        QUnit.test("Only related models can be selected", async function (assert) {
            const data = getBasicData();
            data["ir.model"].records.push(
                {
                    id: 36,
                    name: "Apple",
                    model: "apple",
                },
                {
                    id: 35,
                    name: "Document",
                    model: "documents.document",
                },
                {
                    id: 34,
                    name: "Vehicle",
                    model: "vehicle",
                },
                {
                    id: 33,
                    name: "Computer",
                    model: "computer",
                }
            );
            data["partner"].fields.document = {
                relation: "documents.document",
                string: "Document",
                type: "many2one",
            };
            data["partner"].fields.vehicle_ids = {
                relation: "vehicle",
                string: "Vehicle",
                type: "many2many",
            };
            data["partner"].fields.computer_ids = {
                relation: "computer",
                string: "Computer",
                type: "one2many",
            };
            await createSpreadsheetFromPivotView({
                serverData: {
                    models: data,
                    views: {
                        "partner,false,pivot": `
                            <pivot string="Partners">
                                <field name="foo" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                        "partner,false,search": `<search/>`,
                    },
                },
            });
            const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
            await testUtils.dom.click(searchIcon);
            const newRelation = $(target).find(".o_global_filter_new_relation")[0];
            await testUtils.dom.click(newRelation);
            const selector = `.o_side_panel_related_model input`;
            await testUtils.dom.click($(target).find(selector)[0]);
            const [model1, model2, model3, model4] = target.querySelectorAll(
                ".o-autocomplete--dropdown-item a"
            );
            assert.equal(model1.innerText, "Product");
            assert.equal(model2.innerText, "Document");
            assert.equal(model3.innerText, "Vehicle");
            assert.equal(model4.innerText, "Computer");
        });

        QUnit.test("Edit an existing global filter", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            const label = "This year";
            const defaultValue = "value";
            await addGlobalFilter(model, {
                filter: { id: "42", type: "text", label, defaultValue, pivotFields: {} },
            });
            const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
            await testUtils.dom.click(searchIcon);
            const editFilter = $(target).find(".o_side_panel_filter_icon.fa-cog");
            await testUtils.dom.click(editFilter);
            assert.equal($(target).find(".o-sidePanel").length, 1);
            const input = $(target).find(".o_global_filter_label")[0];
            assert.equal(input.value, label);
            const value = $(target).find(".o_global_filter_default_value")[0];
            assert.equal(value.value, defaultValue);
            await testUtils.fields.editInput(input, "New Label");
            $($(target).find(".o_field_selector_value")).focusin();
            await testUtils.dom.click(
                $(target).find(".o_field_selector_select_button[data-name='display_name']")
            );
            const save = $(target).find(
                ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
            )[0];
            await testUtils.dom.click(save);
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "New Label");
        });

        QUnit.test(
            "Trying to duplicate a filter label will trigger a toaster",
            async function (assert) {
                assert.expect(4);
                const mock = (message) => {
                    assert.step(`create (${message})`);
                    return () => {};
                };
                const uniqueFilterName = "UNIQUE_FILTER";
                registry
                    .category("services")
                    .add("notification", makeFakeNotificationService(mock), {
                        force: true,
                    });
                const { model } = await createSpreadsheetFromPivotView({
                    serverData: {
                        models: getBasicData(),
                        views: {
                            "partner,false,pivot": `
                            <pivot>
                                <field name="bar" type="col"/>
                                <field name="product_id" type="row"/>
                                <field name="probability" type="measure"/>
                            </pivot>`,
                            "partner,false,search": `<search/>`,
                        },
                    },
                });
                model.dispatch("ADD_GLOBAL_FILTER", {
                    filter: {
                        id: "42",
                        type: "relation",
                        label: uniqueFilterName,
                        modelName: "product",
                        pivotFields: {
                            1: {
                                field: "product",
                                type: "many2one",
                            },
                        },
                    },
                });
                const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
                await testUtils.dom.click(searchIcon);
                const newText = $(target).find(".o_global_filter_new_text")[0];
                await testUtils.dom.click(newText);
                assert.equal($(target).find(".o-sidePanel").length, 1);
                const input = $(target).find(".o_global_filter_label")[0];
                await testUtils.fields.editInput(input, uniqueFilterName);
                const value = $(target).find(".o_global_filter_default_value")[0];
                await testUtils.fields.editInput(value, "Default Value");
                // Can't make it work with the DOM API :(
                // await testUtils.dom.triggerEvent($(target).find(".o_field_selector_value"), "focusin");
                $($(target).find(".o_field_selector_value")).focusin();
                await testUtils.dom.click($(target).find(".o_field_selector_select_button")[0]);
                const save = $(target).find(
                    ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
                )[0];
                await testUtils.dom.click(save);
                assert.verifySteps([
                    "create (New spreadsheet created in Documents)",
                    "create (Duplicated Label)",
                ]);
            }
        );

        QUnit.test("Create a new relational global filter with a pivot", async function (assert) {
            const spreadsheetData = {
                pivots: {
                    1: {
                        id: 1,
                        colGroupBys: ["foo"],
                        domain: [],
                        measures: [{ field: "probability", operator: "avg" }],
                        model: "partner",
                        rowGroupBys: ["bar"],
                        context: {},
                    },
                },
            };
            const serverData = getBasicServerData();
            serverData.models["documents.document"].records.push({
                id: 45,
                raw: JSON.stringify(spreadsheetData),
                name: "Spreadsheet",
                handler: "spreadsheet",
            });
            const { model } = await createSpreadsheet({
                serverData,
                spreadsheetId: 45,
            });
            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await click(searchIcon);
            const newRelation = target.querySelector(".o_global_filter_new_relation");
            await click(newRelation);
            const selector = `.o_side_panel_related_model input`;
            await testUtils.dom.click($(target).find(selector)[0]);
            const item = target.querySelector(".o_model_selector_product");
            await click(item);

            const save = target.querySelector(
                ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
            );
            await click(save);
            assert.equal(
                target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length,
                1
            );
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "Product");
            assert.deepEqual(globalFilter.defaultValue, []);
            assert.deepEqual(globalFilter.pivotFields[1], {
                field: "product_id",
                type: "many2one",
            });
        });

        QUnit.test("Create a new relational global filter with a graph", async function (assert) {
            const { model } = await createSpreadsheet();
            insertGraphInSpreadsheet(model);
            await nextTick();
            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await click(searchIcon);
            const newRelation = target.querySelector(".o_global_filter_new_relation");
            await click(newRelation);
            const selector = `.o_side_panel_related_model input`;
            await testUtils.dom.click($(target).find(selector)[0]);
            const item = target.querySelector(".o_model_selector_product");
            await click(item);

            const save = target.querySelector(
                ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
            );
            await click(save);
            assert.equal(
                target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length,
                1
            );
            const [graphId] = model.getters.getOdooChartIds();
            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "Product");
            assert.deepEqual(globalFilter.defaultValue, []);
            assert.deepEqual(globalFilter.graphFields[graphId], {
                field: "product_id",
                type: "many2one",
            });
        });

        QUnit.test(
            "Create a new relational global filter with a list snapshot",
            async function (assert) {
                const spreadsheetData = {
                    lists: {
                        1: {
                            id: 1,
                            columns: ["foo", "contact_name"],
                            domain: [],
                            model: "partner",
                            orderBy: [],
                            context: {},
                        },
                    },
                };
                const serverData = getBasicServerData();
                serverData.models["documents.document"].records.push({
                    id: 45,
                    raw: JSON.stringify(spreadsheetData),
                    name: "Spreadsheet",
                    handler: "spreadsheet",
                });
                const { model } = await createSpreadsheet({
                    serverData,
                    spreadsheetId: 45,
                });
                const searchIcon = target.querySelector(".o_topbar_filter_icon");
                await click(searchIcon);
                const newRelation = target.querySelector(".o_global_filter_new_relation");
                await click(newRelation);
                const selector = `.o_side_panel_related_model input`;
                await testUtils.dom.click($(target).find(selector)[0]);
                const item = target.querySelector(".o_model_selector_product");
                await click(item);

                const save = target.querySelector(
                    ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
                );
                await click(save);
                assert.equal(
                    target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length,
                    1
                );
                const globalFilter = model.getters.getGlobalFilters()[0];
                assert.equal(globalFilter.label, "Product");
                assert.deepEqual(globalFilter.defaultValue, []);
                assert.deepEqual(globalFilter.listFields["1"], {
                    field: "product_id",
                    type: "many2one",
                });
            }
        );

        QUnit.test("Create a new date filter", async function (assert) {
            patchDate(2022, 6, 10, 0, 0, 0);
            const { model } = await createSpreadsheetFromPivotView();
            insertListInSpreadsheet(model, {
                model: "partner",
                columns: ["foo", "bar", "date", "product_id"],
            });
            insertGraphInSpreadsheet(model);
            await nextTick();
            await click(target.querySelector(".o_topbar_filter_icon"));
            await click(target.querySelector(".o_global_filter_new_time"));
            assert.equal(target.querySelectorAll(".o-sidePanel").length, 1);

            const label = $(target).find(".o_global_filter_label")[0];
            await testUtils.fields.editInput(label, "My Label");

            const range = $(target).find(".o_input:nth-child(2)")[0];
            await testUtils.fields.editAndTrigger(range, "month", ["change"]);

            await click(target.querySelector("input#date_automatic_filter"));

            // pivot
            $($(target).find(".o_field_selector_value")[0]).focusin();
            await click(target.querySelector(".o_field_selector_select_button[data-name='date']"));

            //list
            $($(target).find(".o_field_selector_value")[1]).focusin();
            await click(
                target.querySelector(
                    ".o_field_selector_popover:not(.d-none) .o_field_selector_select_button[data-name='date']"
                )
            );

            // graph
            const graphField = target.querySelectorAll(".o_pivot_field_matching ")[2];
            $($(graphField).find(".o_field_selector_value")).focusin();
            await click(graphField, ".o_field_selector_select_button[data-name='date']");

            await click(
                target.querySelector(
                    ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
                )
            );
            assert.equal(
                target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length,
                1
            );

            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "My Label");
            assert.equal(globalFilter.rangeType, "month");
            assert.equal(globalFilter.type, "date");
            const pivotDomain = model.getters.getPivotComputedDomain("1");
            assertDateDomainEqual(assert, "date", "2022-07-01", "2022-07-31", pivotDomain);
            assert.strictEqual(globalFilter.pivotFields["1"].offset, 0);
            const listDomain = model.getters.getListComputedDomain("1");
            assertDateDomainEqual(assert, "date", "2022-07-01", "2022-07-31", listDomain);
            assert.strictEqual(globalFilter.listFields["1"].offset, 0);
            const chartId = model.getters.getOdooChartIds()[0];
            const graphDomain = model.getters.getGraphDataSource(chartId).getComputedDomain();
            assertDateDomainEqual(assert, "date", "2022-07-01", "2022-07-31", graphDomain);
            assert.equal(globalFilter.graphFields[chartId].offset, 0);
        });

        QUnit.test("Create a new date filter with period offsets", async function (assert) {
            patchDate(2022, 6, 14, 0, 0, 0);
            const { model } = await createSpreadsheetFromPivotView();
            insertListInSpreadsheet(model, {
                model: "partner",
                columns: ["foo", "bar", "date", "product_id"],
            });
            insertGraphInSpreadsheet(model);
            await nextTick();
            await click(target.querySelector(".o_topbar_filter_icon"));
            await click(target.querySelector(".o_global_filter_new_time"));
            assert.equal(target.querySelectorAll(".o-sidePanel").length, 1);

            const label = $(target).find(".o_global_filter_label")[0];
            await testUtils.fields.editInput(label, "My Label");

            const range = $(target).find(".o_input:nth-child(2)")[0];
            await testUtils.fields.editAndTrigger(range, "month", ["change"]);

            await click(target.querySelector("input#date_automatic_filter"));

            // pivot
            const pivotField = target.querySelectorAll(".o_pivot_field_matching ")[0];
            $($(pivotField).find(".o_field_selector_value")).focusin();
            await click(target.querySelector(".o_field_selector_select_button[data-name='date']"));
            await testUtils.fields.editAndTrigger(pivotField.querySelector("select"), "-1", [
                "change",
            ]);

            //list
            $($(target).find(".o_field_selector_value")[1]).focusin();
            await click(
                target.querySelector(
                    ".o_field_selector_popover:not(.d-none) .o_field_selector_select_button[data-name='date']"
                )
            );

            // graph
            const graphField = target.querySelectorAll(".o_pivot_field_matching ")[2];
            $($(graphField).find(".o_field_selector_value")).focusin();
            await click(graphField, ".o_field_selector_select_button[data-name='date']");
            await testUtils.fields.editAndTrigger(graphField.querySelector("select"), "-2", [
                "change",
            ]);

            await click(
                target.querySelector(
                    ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
                )
            );
            assert.equal(
                target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length,
                1
            );

            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "My Label");
            assert.equal(globalFilter.rangeType, "month");
            assert.equal(globalFilter.type, "date");
            const pivotDomain = model.getters.getPivotComputedDomain("1");
            assert.equal(globalFilter.pivotFields["1"].offset, -1);
            assertDateDomainEqual(assert, "date", "2022-06-01", "2022-06-30", pivotDomain);
            const listDomain = model.getters.getListComputedDomain("1");
            assert.notOk(globalFilter.listFields["1"].offset);
            assertDateDomainEqual(assert, "date", "2022-07-01", "2022-07-31", listDomain);
            const chartId = model.getters.getOdooChartIds()[0];
            const graphDomain = model.getters.getGraphDataSource(chartId).getComputedDomain();
            assert.equal(globalFilter.graphFields[chartId].offset, -2);
            assertDateDomainEqual(assert, "date", "2022-05-01", "2022-05-31", graphDomain);
        });

        QUnit.test("Create a new relative date filter", async function (assert) {
            patchDate(2022, 6, 14, 0, 0, 0);
            const { model } = await createSpreadsheetFromPivotView();
            insertListInSpreadsheet(model, {
                model: "partner",
                columns: ["foo", "bar", "date", "product_id"],
            });
            insertGraphInSpreadsheet(model);
            await nextTick();
            await click(target, ".o_topbar_filter_icon");
            await click(target, ".o_global_filter_new_time");

            const label = target.querySelector(".o_global_filter_label");
            await testUtils.fields.editInput(label, "My Label");

            const range = target.querySelector(".o_input:nth-child(2)");
            await testUtils.fields.editAndTrigger(range, "relative", ["change"]);

            const relativeSelection = target.querySelector("select.o_relative_date_selection");
            const values = relativeSelection.querySelectorAll("option");
            assert.deepEqual(
                [...values].map((val) => val.value),
                ["", "last_week", "last_month", "last_year", "last_three_years"]
            );
            await testUtils.fields.editAndTrigger(relativeSelection, "last_month", ["change"]);

            // pivot
            $($(target).find(".o_field_selector_value")[0]).focusin();
            await click(target.querySelector(".o_field_selector_select_button[data-name='date']"));

            //list
            $($(target).find(".o_field_selector_value")[1]).focusin();
            await click(
                target,
                ".o_field_selector_popover:not(.d-none) .o_field_selector_select_button[data-name='date']"
            );

            // graph
            const graphField = target.querySelectorAll(".o_pivot_field_matching ")[2];
            $($(graphField).find(".o_field_selector_value")).focusin();
            await click(graphField, ".o_field_selector_select_button[data-name='date']");
            await testUtils.fields.editAndTrigger(graphField.querySelector("select"), "-2", [
                "change",
            ]);

            await click(target, ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save");

            const globalFilter = model.getters.getGlobalFilters()[0];
            assert.equal(globalFilter.label, "My Label");
            assert.equal(globalFilter.defaultValue, "last_month");
            assert.equal(globalFilter.rangeType, "relative");
            assert.equal(globalFilter.type, "date");
            const pivotDomain = model.getters.getPivotComputedDomain("1");
            assertDateDomainEqual(assert, "date", "2022-06-14", "2022-07-13", pivotDomain);
            const listDomain = model.getters.getListComputedDomain("1");
            assertDateDomainEqual(assert, "date", "2022-06-14", "2022-07-13", listDomain);
        });

        QUnit.test("Edit the value of a relative date filter", async function (assert) {
            patchDate(2022, 6, 14, 0, 0, 0);
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "date",
                    label: "label",
                    defaultValue: "last_week",
                    pivotFields: { 1: { field: "date", type: "date" } },
                    rangeType: "relative",
                },
            });
            await nextTick();
            await click(target, ".o_topbar_filter_icon");
            await nextTick();
            const select = target.querySelector(".o-sidePanel select");
            assert.deepEqual(
                [...select.querySelectorAll("option")].map((val) => val.value),
                ["", "last_week", "last_month", "last_year", "last_three_years"]
            );
            await testUtils.fields.editAndTrigger(select, "last_year", ["change"]);
            await nextTick();

            assert.equal(model.getters.getGlobalFilterValue("42"), "last_year");
            const pivotDomain = model.getters.getPivotComputedDomain("1");
            assertDateDomainEqual(assert, "date", "2021-07-14", "2022-07-13", pivotDomain);
        });

        QUnit.test("Choose any year in a year picker", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, THIS_YEAR_FILTER);

            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await testUtils.dom.click(searchIcon);
            await nextTick();

            const pivots = target.querySelectorAll(".pivot_filter_section");
            assert.containsOnce(target, ".pivot_filter_section");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-cog");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(
                pivots[0].querySelector(".o_side_panel_filter_label").textContent,
                THIS_YEAR_FILTER.filter.label
            );

            assert.containsOnce(pivots[0], ".pivot_filter_input input.o_datepicker_input");
            const year = pivots[0].querySelector(".pivot_filter_input input.o_datepicker_input");

            const this_year = luxon.DateTime.utc().year;
            assert.equal(year.value, String(this_year));

            await selectYear(String(this_year - 127));
            assert.equal(year.value, String(this_year - 127));
            assert.deepEqual(model.getters.getGlobalFilterValue(THIS_YEAR_FILTER.filter.id), {
                period: undefined,
                yearOffset: -127,
            });

            await selectYear(String(this_year + 32));
            assert.equal(year.value, String(this_year + 32));
            assert.deepEqual(model.getters.getGlobalFilterValue(THIS_YEAR_FILTER.filter.id), {
                period: undefined,
                yearOffset: 32,
            });
        });

        QUnit.test("Readonly user can update text filter values", async function (assert) {
            assert.expect(6);
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Text Filter",
                    defaultValue: "abc",
                    pivotFields: {},
                    listFields: {},
                },
            });
            model.updateMode("readonly");
            await nextTick();

            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await testUtils.dom.click(searchIcon);

            const pivots = target.querySelectorAll(".pivot_filter_section");
            assert.containsOnce(target, ".pivot_filter_section");
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-cog");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(
                pivots[0].querySelector(".o_side_panel_filter_label").textContent,
                "Text Filter"
            );

            const input = pivots[0].querySelector(".pivot_filter_input input");
            assert.equal(input.value, "abc");

            await testUtils.fields.editAndTrigger(input, "something", ["change"]);

            assert.equal(model.getters.getGlobalFilterValue("42"), "something");
        });

        QUnit.test("Readonly user can update date filter values", async function (assert) {
            assert.expect(11);
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "43",
                    type: "date",
                    label: "Date Filter",
                    rangeType: "quarter",
                    defaultValue: { yearOffset: 0, period: "fourth_quarter" },
                    pivotFields: { 1: { field: "date", type: "date" } },
                    listFields: {},
                },
            });
            model.updateMode("readonly");
            await nextTick();

            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await testUtils.dom.click(searchIcon);
            await nextTick();

            const pivots = target.querySelectorAll(".pivot_filter_section");
            assert.containsOnce(target, ".pivot_filter_section");
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-cog");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(
                pivots[0].querySelector(".o_side_panel_filter_label").textContent,
                "Date Filter"
            );

            assert.containsOnce(pivots[0], ".pivot_filter_input div.date_filter_values select");
            const quarter = pivots[0].querySelector(
                ".pivot_filter_input div.date_filter_values select"
            );
            assert.containsOnce(pivots[0], ".pivot_filter_input input.o_datepicker_input");
            const year = pivots[0].querySelector(".pivot_filter_input input.o_datepicker_input");

            const this_year = luxon.DateTime.utc().year;
            assert.equal(quarter.value, "fourth_quarter");
            assert.equal(year.value, String(this_year));
            await testUtils.fields.editSelect(quarter, "second_quarter");
            await nextTick();
            await selectYear(String(this_year - 1));
            await nextTick();

            assert.equal(quarter.value, "second_quarter");
            assert.equal(year.value, String(this_year - 1));

            assert.deepEqual(model.getters.getGlobalFilterValue("43"), {
                period: "second_quarter",
                yearOffset: -1,
            });
        });

        QUnit.test("Readonly user can update relation filter values", async function (assert) {
            const tagSelector = ".o_field_many2manytags .badge";
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "relation",
                    label: "Relation Filter",
                    modelName: "product",
                    defaultValue: [41],
                    pivotFields: { 1: { field: "product_id", type: "many2one" } },
                    listFields: {},
                },
            });
            assert.equal(model.getters.getGlobalFilters().length, 1);
            model.updateMode("readonly");
            await nextTick();

            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await testUtils.dom.click(searchIcon);

            const pivot = target.querySelector(".pivot_filter_section");
            assert.containsOnce(target, ".pivot_filter_section");
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-cog");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(
                pivot.querySelector(".o_side_panel_filter_label").textContent,
                "Relation Filter"
            );
            assert.containsOnce(pivot, tagSelector);
            assert.deepEqual(
                [...pivot.querySelectorAll(tagSelector)].map((el) => el.textContent.trim()),
                ["xpad"]
            );

            await testUtils.dom.click(
                pivot.querySelector(".pivot_filter_input input.ui-autocomplete-input")
            );
            await testUtils.dom.click(document.querySelector("ul.ui-autocomplete li:first-child"));

            assert.containsN(pivot, tagSelector, 2);
            assert.deepEqual(
                [...pivot.querySelectorAll(tagSelector)].map((el) => el.textContent.trim()),
                ["xpad", "xphone"]
            );
            assert.deepEqual(model.getters.getGlobalFilterValue("42"), [41, 37]);
        });

        QUnit.test("Can clear a text filter values", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Text Filter",
                    defaultValue: "",
                    pivotFields: {},
                    listFields: {},
                },
            });
            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await click(searchIcon);

            const pivots = target.querySelectorAll(".pivot_filter_section");
            const input = pivots[0].querySelector(".pivot_filter_input input");
            assert.equal(input.value, "");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-cog");
            // no default value
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-times");

            await testUtils.fields.editAndTrigger(input, "something", ["change"]);
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");

            await click(target.querySelector("i.o_side_panel_filter_icon.fa-times"));
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(input.value, "");
        });

        QUnit.test("Can clear a date filter values", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "43",
                    type: "date",
                    label: "Date Filter",
                    rangeType: "quarter",
                    defaultValue: { yearOffset: undefined, period: undefined },
                    pivotFields: { 1: { field: "date", type: "date" } },
                    listFields: {},
                },
            });
            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await click(searchIcon);
            const pivots = target.querySelectorAll(".pivot_filter_section");
            const quarter = pivots[0].querySelector(
                ".pivot_filter_input div.date_filter_values select"
            );
            const year = pivots[0].querySelector(".pivot_filter_input input.o_datepicker_input");
            const this_year = luxon.DateTime.local().year;
            assert.equal(quarter.value, "empty");
            assert.equal(year.value, "");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-cog");
            // no default value
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-times");

            await testUtils.fields.editSelect(quarter, "second_quarter");
            await selectYear(String(this_year - 1));

            assert.equal(quarter.value, "second_quarter");
            assert.equal(year.value, String(this_year - 1));

            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");

            await click(target.querySelector("i.o_side_panel_filter_icon.fa-times"));
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(quarter.value, "empty");
            assert.equal(year.value, "");
        });

        QUnit.test("Can clear a relation filter values", async function (assert) {
            const tagSelector = ".o_field_many2manytags .badge";
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "relation",
                    label: "Relation Filter",
                    modelName: "product",
                    defaultValue: [],
                    pivotFields: { 1: { field: "product_id", type: "many2one" } },
                    listFields: {},
                },
            });
            assert.equal(model.getters.getGlobalFilters().length, 1);

            const searchIcon = target.querySelector(".o_topbar_filter_icon");
            await testUtils.dom.click(searchIcon);

            const pivot = target.querySelector(".pivot_filter_section");
            assert.containsOnce(target, ".pivot_filter_section");
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-cog");
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-times");
            assert.equal(
                pivot.querySelector(".o_side_panel_filter_label").textContent,
                "Relation Filter"
            );
            assert.containsNone(pivot, tagSelector);
            assert.deepEqual(
                [...pivot.querySelectorAll(tagSelector)].map((el) => el.textContent.trim()),
                []
            );

            await testUtils.dom.click(
                pivot.querySelector(".pivot_filter_input input.ui-autocomplete-input")
            );
            await testUtils.dom.click(document.querySelector("ul.ui-autocomplete li:first-child"));

            assert.containsOnce(pivot, tagSelector);
            assert.deepEqual(
                [...pivot.querySelectorAll(tagSelector)].map((el) => el.textContent.trim()),
                ["xphone"]
            );
            assert.containsOnce(target, "i.o_side_panel_filter_icon.fa-times");

            // clear filter
            await click(target.querySelector("i.o_side_panel_filter_icon.fa-times"));
            assert.containsNone(target, "i.o_side_panel_filter_icon.fa-times");
            assert.containsNone(pivot, tagSelector);
            assert.deepEqual(
                [...pivot.querySelectorAll(tagSelector)].map((el) => el.textContent.trim()),
                []
            );
        });

        QUnit.test(
            "Changing the range of a date global filter reset the default value",
            async function (assert) {
                assert.expect(1);

                const { model } = await createSpreadsheetFromPivotView();
                await addGlobalFilter(model, {
                    filter: {
                        id: "42",
                        type: "date",
                        rangeType: "month",
                        label: "This month",
                        pivotFields: {
                            1: { field: "date", type: "date" },
                        },
                        defaultValue: {
                            period: "january",
                        },
                    },
                });
                const searchIcon = $(target).find(".o_topbar_filter_icon")[0];
                await testUtils.dom.click(searchIcon);
                const editFilter = $(target).find(".o_side_panel_filter_icon.fa-cog");
                await testUtils.dom.click(editFilter);
                const options = $(target).find(
                    ".o_spreadsheet_filter_editor_side_panel .o_side_panel_section"
                )[1];
                await testUtils.fields.editSelect(options.querySelector("select"), "year");
                await testUtils.dom.click($(target).find(".o_global_filter_save")[0]);
                await nextTick();
                assert.deepEqual(model.getters.getGlobalFilters()[0].defaultValue, {});
            }
        );

        QUnit.test(
            "Changing the range of a date global filter reset the current value",
            async function (assert) {
                patchDate(2022, 6, 10, 0, 0, 0);
                const { model } = await createSpreadsheetFromPivotView();
                await addGlobalFilter(model, {
                    filter: {
                        id: "42",
                        type: "date",
                        rangeType: "month",
                        label: "This month",
                        pivotFields: {
                            1: { field: "date", type: "date" },
                        },
                    },
                });
                const searchIcon = target.querySelector(".o_topbar_filter_icon");
                await click(searchIcon);

                // Edit filter value in filters list
                const optionInFilterList = target.querySelector(".pivot_filter select");
                await testUtils.fields.editSelect(optionInFilterList, "february");
                const editFilter = target.querySelector(".o_side_panel_filter_icon.fa-cog");
                assert.deepEqual(model.getters.getGlobalFilterValue(42), {
                    period: "february",
                    yearOffset: 0,
                });

                // Edit filter range and save
                await click(editFilter);
                const timeRangeOption = target.querySelectorAll(
                    ".o_spreadsheet_filter_editor_side_panel .o_side_panel_section"
                )[1];
                const selectField = timeRangeOption.querySelector("select");
                await testUtils.fields.editSelect(selectField, "quarter");
                await click(target, "input#date_automatic_filter");
                await click(target.querySelector(".o_global_filter_save"));
                await nextTick();

                assert.deepEqual(model.getters.getGlobalFilterValue(42), {
                    period: "third_quarter",
                    yearOffset: 0,
                });
            }
        );

        QUnit.test(
            "Date filter automatic filter value checkbox is working",
            async function (assert) {
                patchDate(2022, 6, 10, 0, 0, 0);
                const { model } = await createSpreadsheetFromPivotView();
                await addGlobalFilter(model, {
                    filter: {
                        id: "42",
                        type: "date",
                        rangeType: "quarter",
                        label: "This quarter",
                        pivotFields: {
                            1: { field: "date", type: "date" },
                        },
                    },
                });
                await click(target, ".o_topbar_filter_icon");
                await click(target, ".o_side_panel_filter_icon.fa-cog");
                await click(target, "input#date_automatic_filter");
                await click(target, ".o_global_filter_save");
                await nextTick();
                assert.ok(model.getters.getGlobalFilter("42").defaultsToCurrentPeriod);
                assert.deepEqual(model.getters.getGlobalFilterValue("42"), {
                    yearOffset: 0,
                    period: "third_quarter",
                });
                await click(target, ".o_side_panel_filter_icon.fa-cog");
                await click(target, "input#date_automatic_filter");
                await click(target, ".o_global_filter_save");
                await nextTick();
                assert.notOk(model.getters.getGlobalFilter("42").defaultsToCurrentPeriod);
                assert.equal(model.getters.getGlobalFilterValue("42"), undefined);
            }
        );

        QUnit.test(
            "Filter edit side panel is initialized with the correct values",
            async function (assert) {
                const { model } = await createSpreadsheetFromPivotView();
                insertListInSpreadsheet(model, {
                    model: "partner",
                    columns: ["foo", "bar", "date", "product_id"],
                });
                await addGlobalFilter(model, {
                    filter: {
                        id: "42",
                        type: "date",
                        rangeType: "month",
                        label: "This month",
                        pivotFields: {
                            1: { field: "date", type: "date", offset: 0 },
                        },
                        listFields: {
                            1: { field: "date", type: "date", offset: 1 },
                        },
                        defaultValue: {
                            period: "january",
                        },
                    },
                });
                await click(target, ".o_topbar_filter_icon");
                await click(target, ".o-sidePanel .fa-cog");

                const panel = target.querySelector(".o-sidePanel");
                assert.equal(panel.querySelectorAll(".o_input")[0].value, "This month");
                assert.equal(panel.querySelectorAll(".o_input")[1].value, "month");

                const pivotField = panel.querySelectorAll(".o_pivot_field_matching ")[0];
                const pivotFieldValue = pivotField.querySelector(".o_field_selector_value span");
                assert.equal(pivotFieldValue.textContent.trim(), "Date");
                assert.equal(pivotField.querySelector("select").value, "0");

                const listField = panel.querySelectorAll(".o_pivot_field_matching ")[1];
                const listFieldValue = listField.querySelector(".o_field_selector_value span");
                assert.equal(listFieldValue.textContent.trim(), "Date");
                assert.equal(listField.querySelector("select").value, "1");
            }
        );

        QUnit.test("Empty field is marked as warning", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Text Filter",
                    defaultValue: "",
                    pivotFields: {},
                },
            });
            await click(target, ".o_topbar_filter_icon");
            await click(target, "i.o_side_panel_filter_icon.fa-cog");
            assert.hasClass(target.querySelector(".o_pivot_field_matching"), "o_missing_field");
        });

        QUnit.test("Can save with an empty field", async function (assert) {
            const { model } = await createSpreadsheetFromPivotView();
            await addGlobalFilter(model, {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Text Filter",
                    defaultValue: "",
                    pivotFields: {},
                },
            });
            await click(target, ".o_topbar_filter_icon");
            await click(target, "i.o_side_panel_filter_icon.fa-cog");
            await click(target, ".o_global_filter_save");
            assert.equal(model.getters.getGlobalFilters()[0].pivotFields[1], undefined);
        });
    }
);
