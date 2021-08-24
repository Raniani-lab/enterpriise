/** @odoo-module alias=documents_spreadsheet.PivotGlobalFilterTests */

import testUtils from "web.test_utils";
import CommandResult from "documents_spreadsheet.CommandResult";
import spreadsheet from "documents_spreadsheet.spreadsheet";
import {
    createSpreadsheetFromPivot,
    setCellContent,
    getCellFormula,
    getCellValue,
} from "./spreadsheet_test_utils";

import { getBasicArch, getTestData } from "./spreadsheet_test_data";

const { Model, DispatchResult } = spreadsheet;
const {cellMenuRegistry } = spreadsheet.registries;
const { module, test } = QUnit;

const LAST_YEAR_FILTER = {
    filter: {
        id: "42",
        type: "date",
        label: "Last Year",
        defaultValue: { year: "last_year" },
        fields: { 1: { field: "date", type: "date" } },
    }
};

const THIS_YEAR_FILTER = {
    filter: {
        type: "date",
        label: "This Year",
        defaultValue: { year: "this_year" },
        fields: { 1: { field: "date", type: "date" } },
    }
};

module("documents_spreadsheet > pivot_global_filters", {
    beforeEach() {
        this.data = getTestData();
        this.arch = getBasicArch();
    }
}, () => {
    test("Can add a global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        assert.equal(model.getters.getGlobalFilters().length, 0);
        const [ pivot ] = model.getters.getPivots();
        model.dispatch("ADD_PIVOT_FILTER", LAST_YEAR_FILTER);
        assert.equal(model.getters.getGlobalFilters().length, 1);
        assert.equal(pivot.computedDomain.length, 3);
        assert.equal(pivot.computedDomain[0], "&");
    });

    test("Can delete a global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        assert.deepEqual(model.dispatch("REMOVE_PIVOT_FILTER", { id: 1 }).reasons, [CommandResult.FilterNotFound]);
        model.dispatch("ADD_PIVOT_FILTER", LAST_YEAR_FILTER);
        const gf = model.getters.getGlobalFilters()[0];
        assert.deepEqual(model.dispatch("REMOVE_PIVOT_FILTER", { id: gf.id }), DispatchResult.Success);
        assert.equal(model.getters.getGlobalFilters().length, 0);
        const [ pivot ] = model.getters.getPivots();
        assert.equal(pivot.computedDomain.length, 0);
    });

    test("Can edit a global filter", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        const gfDef = { ...THIS_YEAR_FILTER, id: 1 };
        assert.deepEqual(model.dispatch("EDIT_PIVOT_FILTER", gfDef).reasons, [CommandResult.FilterNotFound]);
        model.dispatch("ADD_PIVOT_FILTER", LAST_YEAR_FILTER);
        const gf = model.getters.getGlobalFilters()[0];
        gfDef.id = gf.id;
        assert.deepEqual(model.dispatch("EDIT_PIVOT_FILTER", gfDef), DispatchResult.Success);
        assert.equal(model.getters.getGlobalFilters().length, 1);
        assert.deepEqual(model.getters.getGlobalFilters()[0].defaultValue.year, "this_year");
    });

    test("Create a new date filter", async function (assert) {
        assert.expect(14);

        const { webClient, model } = await createSpreadsheetFromPivot({
            pivotView: {
                arch: `
                    <pivot string="Partners">
                        <field name="date" interval="month" type="row"/>
                        <field name="id" type="col"/>
                        <field name="probability" type="measure"/>
                    </pivot>
                `,
            },
        });
        await testUtils.nextTick();
        const searchIcon = $(webClient.el).find(".o_topbar_filter_icon")[0];
        await testUtils.dom.click(searchIcon);
        const newDate = $(webClient.el).find(".o_global_filter_new_time")[0];
        await testUtils.dom.click(newDate);
        assert.equal($(webClient.el).find(".o-sidePanel").length, 1);

        const label = $(webClient.el).find(".o_global_filter_label")[0];
        await testUtils.fields.editInput(label, "My Label");

        const range = $(webClient.el).find(".o_input:nth-child(2)")[0];
        await testUtils.fields.editAndTrigger(range, "month", ["change"]);

        const filterValues = $(webClient.el).find(".date_filter_values .o_input")[0];
        await testUtils.dom.click(filterValues);

        assert.equal($(webClient.el).find(".date_filter_values .o_input").length, 2);
        const month = $(webClient.el).find(".date_filter_values .o_input:nth-child(1)")[0];
        assert.equal(month.length, 13);
        const year = $(webClient.el).find(".date_filter_values .o_input:nth-child(2)")[0];
        assert.equal(year.length, 4);

        await testUtils.fields.editAndTrigger(month, "october", ["change"]);
        assert.equal(year.length, 3);

        await testUtils.fields.editAndTrigger(year, "this_year", ["change"]);

        $($(webClient.el).find(".o_field_selector_value")[0]).focusin();
        await testUtils.dom.click($(webClient.el).find(".o_field_selector_select_button")[0]);

        const save = $(webClient.el).find(".o_spreadsheet_filter_editor_side_panel .o_global_filter_save")[0];
        await testUtils.dom.click(save);

        assert.equal($(webClient.el).find(".o_spreadsheet_global_filters_side_panel").length, 1);
        const globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "My Label");
        assert.equal(globalFilter.defaultValue.year, "this_year");
        assert.equal(globalFilter.defaultValue.period, "october");
        assert.equal(globalFilter.rangeType, "month");
        assert.equal(globalFilter.type, "date");
        const currentYear = new Date().getFullYear();
        const computedDomain = model.getters.getPivot(1).computedDomain
        assert.deepEqual(computedDomain[0], "&")
        assert.deepEqual(computedDomain[1], ["date", ">=", currentYear + "-10-01"])
        assert.deepEqual(computedDomain[2], ["date", "<=", currentYear + "-10-31"])
    });

    test("Create a new date filter without specifying the year",  async function (assert) {
        assert.expect(9);
        const { webClient, model } = await createSpreadsheetFromPivot({
            arch: `
                <pivot string="Partners">
                    <field name="date" interval="month" type="row"/>
                    <field name="id" type="col"/>
                    <field name="probability" type="measure"/>
                </pivot>
            `,
        });
        await testUtils.nextTick();
        const searchIcon = $(webClient.el).find(".o_topbar_filter_icon")[0];
        await testUtils.dom.click(searchIcon);
        const newDate = $(webClient.el).find(".o_global_filter_new_time")[0];
        await testUtils.dom.click(newDate);
        assert.equal($(webClient.el).find(".o-sidePanel").length, 1);

        const label = $(webClient.el).find(".o_global_filter_label")[0];
        await testUtils.fields.editInput(label, "My Label");

        const range = $(webClient.el).find(".o_input:nth-child(2)")[0];
        await testUtils.fields.editAndTrigger(range, "month", ["change"]);

        const filterValues = $(webClient.el).find(".date_filter_values .o_input")[0];
        await testUtils.dom.click(filterValues);

        assert.equal($(webClient.el).find(".date_filter_values .o_input").length, 2);
        const month = $(webClient.el).find(".date_filter_values .o_input:nth-child(1)")[0];
        assert.equal(month.length, 13);
        const year = $(webClient.el).find(".date_filter_values .o_input:nth-child(2)")[0];
        assert.equal(year.length, 4);

        await testUtils.fields.editAndTrigger(month, "november", ["change"]);
        // intentionally skip the year input

        $($(webClient.el).find(".o_field_selector_value")[0]).focusin();
        await testUtils.dom.click($(webClient.el).find(".o_field_selector_select_button")[0]);

        const save = $(webClient.el).find(".o_spreadsheet_filter_editor_side_panel .o_global_filter_save")[0];
        await testUtils.dom.click(save);

        const globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "My Label");
        assert.equal(globalFilter.defaultValue.year, "this_year");
        assert.equal(globalFilter.defaultValue.period, "november");
        assert.equal(globalFilter.rangeType, "month");
        assert.equal(globalFilter.type, "date");
    })

    test("Cannot have duplicated names", async function (assert) {
        assert.expect(6);

        const { model } = await createSpreadsheetFromPivot();
        const filter = Object.assign({}, THIS_YEAR_FILTER.filter, { label: "Hello" });
        model.dispatch("ADD_PIVOT_FILTER", { filter });
        assert.equal(model.getters.getGlobalFilters().length, 1);

        // Add filter with same name
        let result = model.dispatch("ADD_PIVOT_FILTER", Object.assign({ id: "456" }, { filter }));
        assert.deepEqual(result.reasons, [CommandResult.DuplicatedFilterLabel]);
        assert.equal(model.getters.getGlobalFilters().length, 1);

        // Edit to set same name as other filter
        model.dispatch("ADD_PIVOT_FILTER", { filter: Object.assign({ id: "789" }, filter, { label: "Other name" }) });
        assert.equal(model.getters.getGlobalFilters().length, 2);
        result = model.dispatch("EDIT_PIVOT_FILTER", {id: "789", filter: Object.assign({}, filter, { label: "Hello" }) });
        assert.deepEqual(result.reasons, [CommandResult.DuplicatedFilterLabel]);

        // Edit to set same name
        result = model.dispatch("EDIT_PIVOT_FILTER", {id: "789", filter: Object.assign({}, filter, { label: "Other name" }) });
        assert.deepEqual(result, DispatchResult.Success);
    });

    test("Can save a value to an existing global filter", async function (assert) {
        assert.expect(7);

        const { model } = await createSpreadsheetFromPivot();
        model.dispatch("ADD_PIVOT_FILTER", LAST_YEAR_FILTER);
        const gf = model.getters.getGlobalFilters()[0];
        assert.deepEqual(model.dispatch("SET_PIVOT_FILTER_VALUE", { id: gf.id, value: { period: "last_month" } }), DispatchResult.Success);
        assert.equal(model.getters.getGlobalFilters().length, 1);
        assert.deepEqual(model.getters.getGlobalFilters()[0].defaultValue.year, "last_year");
        assert.deepEqual(model.getters.getGlobalFilters()[0].value.period, "last_month");
        assert.deepEqual(model.dispatch("SET_PIVOT_FILTER_VALUE", { id: gf.id, value: { period: "this_month" } }), DispatchResult.Success);
        assert.deepEqual(model.getters.getGlobalFilters()[0].value.period, "this_month");
        const [ pivot ] = model.getters.getPivots();
        assert.equal(pivot.computedDomain.length, 3);
    });

    test("Can export/import filters", async function (assert) {
        assert.expect(4);

        const { model } = await createSpreadsheetFromPivot();
        model.dispatch("ADD_PIVOT_FILTER", LAST_YEAR_FILTER);
        const newModel = new Model(model.exportData(), {
            evalContext: {
                env: {
                    services: {
                        rpc: () => [],
                    },
                },
            },
        });
        assert.equal(newModel.getters.getGlobalFilters().length, 1);
        const [filter] = newModel.getters.getGlobalFilters();
        assert.deepEqual(filter.defaultValue.year, "last_year");
        assert.deepEqual(filter.value.year, "last_year", "it should have applied the default value");

        const [ pivot ] = newModel.getters.getPivots();
        assert.equal(pivot.computedDomain.length, 3, "it should have updated the pivot domain");
    });

    test("Relational filter with undefined value", async function (assert) {
        assert.expect(1);

        const { model } = await createSpreadsheetFromPivot();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "relation",
                label: "Relation Filter",
                fields: {
                    1: {
                        field: "foo",
                        type: "char",
                    },
                },
            },
        });
        const [filter] = model.getters.getGlobalFilters();
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: undefined,
        });
        const [ pivot ] = model.getters.getPivots();
        assert.equal(pivot.computedDomain.length, 0, "it should not have updated the pivot domain");
    });

    test("Get active filters with multiple filters", async function (assert) {
        assert.expect(2);

        const model = new Model();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "text",
                label: "Text Filter",
            },
        });
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "43",
                type: "date",
                label: "Date Filter",
                rangeType: "quarter",
            },
        });
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "44",
                type: "relation",
                label: "Relation Filter",
            },
        });
        const [text, date, relation] = model.getters.getGlobalFilters();
        assert.equal(model.getters.getActiveFilterCount(), false);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: text.id,
            value: "Hello",
        });
        assert.equal(model.getters.getActiveFilterCount(), true);
    });

    test("Get active filters with text filter enabled", async function (assert) {
        assert.expect(2);

        const model = new Model();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "text",
                label: "Text Filter",
            },
        });
        const [filter] = model.getters.getGlobalFilters();
        assert.equal(model.getters.getActiveFilterCount(), false);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: "Hello",
        });
        assert.equal(model.getters.getActiveFilterCount(), true);
    });

    test("Get active filters with relation filter enabled", async function (assert) {
        assert.expect(2);

        const model = new Model();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "relation",
                label: "Relation Filter",
            },
        });
        const [filter] = model.getters.getGlobalFilters();
        assert.equal(model.getters.getActiveFilterCount(), false);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: [1],
        });
        assert.equal(model.getters.getActiveFilterCount(), true);
    });

    test("Get active filters with date filter enabled", async function (assert) {
        assert.expect(4);

        const model = new Model();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "date",
                label: "Date Filter",
                rangeType: "quarter",
            },
        });
        const [filter] = model.getters.getGlobalFilters();
        assert.equal(model.getters.getActiveFilterCount(), false);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: {
                year: "this_year",
                period: undefined,
            },
        });
        assert.equal(model.getters.getActiveFilterCount(), true);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: {
                year: undefined,
                period: "first_quarter",
            },
        });
        assert.equal(model.getters.getActiveFilterCount(), true);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: {
                year: "this_year",
                period: "first_quarter",
            },
        });
        assert.equal(model.getters.getActiveFilterCount(), true);
    });

    test("FILTER.VALUE text filter", async function (assert) {
        assert.expect(3);

        const model = new Model();
        setCellContent(model, "A10", `=FILTER.VALUE("Text Filter")`);
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), "#ERROR");
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "text",
                label: "Text Filter",
                fields: {
                    1: {
                        field: "name",
                        type: "char",
                    },
                },
            },
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), "");
        const [filter] = model.getters.getGlobalFilters();
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: "Hello",
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), "Hello");
    });

    test("FILTER.VALUE date filter", async function (assert) {
        assert.expect(2);

        const model = new Model();
        setCellContent(model, "A10", `=FILTER.VALUE("Date Filter")`);
        await testUtils.nextTick();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "date",
                label: "Date Filter",
                fields: {
                    1: {
                        field: "name",
                        type: "char",
                    },
                },
            },
        });
        await testUtils.nextTick();
        const [filter] = model.getters.getGlobalFilters();
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            rangeType: "quarter",
            value: {
                year: "this_year",
                period: "first_quarter",
            },
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), `Q1 ${moment().year()}`);
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            rangeType: "year",
            value: {
                year: "this_year",
            },
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), `${moment().year()}`);
    });

    test("FILTER.VALUE relation filter", async function (assert) {
        assert.expect(6);

        const model = new Model(
            {},
            {
                evalContext: {
                    env: {
                        services: {
                            rpc: async (params) => {
                                const resId = params.args[0][0]
                                assert.step(`name_get_${resId}`)
                                return resId === 1
                                    ? [[1, "Jean-Jacques"]]
                                    : [[2, "Raoul Grosbedon"]]
                            }
                        },
                    },
                },
            }
        );
        setCellContent(model, "A10", `=FILTER.VALUE("Relation Filter")`);
        await testUtils.nextTick();
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "42",
                type: "relation",
                label: "Relation Filter",
                modelName: "partner",
            },
        });
        await testUtils.nextTick();
        const [filter] = model.getters.getGlobalFilters();

        // One record; displayNames not defined => rpc
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: [1],
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), "Jean-Jacques");

        // Two records; displayNames defined => no rpc
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: [1, 2],
            displayNames: ["Jean-Jacques", "Raoul Grosbedon"],
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), "Jean-Jacques, Raoul Grosbedon");

        // another record; displayNames not defined => rpc
        model.dispatch("SET_PIVOT_FILTER_VALUE", {
            id: filter.id,
            value: [2],
        });
        await testUtils.nextTick();
        assert.equal(getCellValue(model, "A10"), "Raoul Grosbedon");
        assert.verifySteps(["name_get_1", "name_get_2"]);
    });

    test(
        "FILTER.VALUE formulas are updated when filter label is changed",
        async function (assert) {
            assert.expect(1);

            const model = new Model();
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "date",
                    label: "Cuillère",
                    fields: {
                        1: {
                            field: "name",
                            type: "char",
                        },
                    },
                },
            });
            setCellContent(model, "A10", `=FILTER.VALUE("Cuillère") & FILTER.VALUE( "Cuillère" )`);
            const [filter] = model.getters.getGlobalFilters();
            const newFilter = {
                type: "date",
                label: "Interprete",
                fields: {
                    1: {
                        field: "name",
                        type: "char",
                    },
                },
            };
            const sheetId = model.getters.getActiveSheetId();
            model.dispatch("EDIT_PIVOT_FILTER", { id: filter.id, filter: newFilter });
            assert.equal(
                model.getters.getCell(sheetId, 0, 9).formula.text,
                `=FILTER.VALUE("Interprete") & FILTER.VALUE("Interprete")`
            );
        }
    );

    test("Exporting data does not remove value from model",
        async function (assert) {
            assert.expect(2);

            const model = new Model();
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Cuillère",
                    fields: {
                        1: {
                            field: "name",
                            type: "char",
                        },
                    },
                },
            });
            model.dispatch("SET_PIVOT_FILTER_VALUE", {
                id: "42",
                value: "Hello export bug",
            });
            const [filter] = model.getters.getGlobalFilters();
            assert.equal(filter.value, "Hello export bug");
            model.exportData();
            assert.equal(filter.value, "Hello export bug");
        }
    );

    test("Re-insert a pivot with a global filter should re-insert the full pivot", async function (assert) {
        assert.expect(1);

        const { model, env } = await createSpreadsheetFromPivot({
            pivotView: {
                model: "partner",
                data: this.data,
                arch: `
                <pivot string="Partners">
                    <field name="product_id" type="col"/>
                    <field name="name" type="row"/>
                    <field name="probability" type="measure"/>
                </pivot>`,
            },
        });
        model.dispatch("ADD_PIVOT_FILTER", {
            filter: {
                id: "41",
                type: "relation",
                label: "41",
                defaultValue: [41],
                fields: { 1: { field: "product_id", type: "many2one" } },
            }
        });
        model.dispatch("SELECT_CELL", { col: 0, row: 5 });
        const root = cellMenuRegistry.getAll().find((item) => item.id === "reinsert_pivot");
        const reinsertPivot = cellMenuRegistry.getChildren(root, env)[0];
        await reinsertPivot.action(env);
        await testUtils.nextTick();
        assert.equal(getCellFormula(model, "B6"), getCellFormula(model, "B1"));
    });

    test("Can undo-redo a add_pivot_filter",
        async function (assert) {
            assert.expect(3);

            const model = new Model();
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Cuillère",
                    fields: {
                        1: {
                            field: "name",
                            type: "char",
                        },
                    },
                },
            });
            assert.equal(model.getters.getGlobalFilters().length, 1);
            model.dispatch("REQUEST_UNDO");
            assert.equal(model.getters.getGlobalFilters().length, 0);
            model.dispatch("REQUEST_REDO");
            assert.equal(model.getters.getGlobalFilters().length, 1);
        }
    );

    test("Can undo-redo a remove_pivot_filter",
        async function (assert) {
            assert.expect(3);

            const model = new Model();
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Cuillère",
                    fields: {
                        1: {
                            field: "name",
                            type: "char",
                        },
                    },
                },
            });
            model.dispatch("REMOVE_PIVOT_FILTER", { id: "42" });
            assert.equal(model.getters.getGlobalFilters().length, 0);
            model.dispatch("REQUEST_UNDO");
            assert.equal(model.getters.getGlobalFilters().length, 1);
            model.dispatch("REQUEST_REDO");
            assert.equal(model.getters.getGlobalFilters().length, 0);
        }
    );

    test("Can undo-redo a edit_pivot_filter", async function (assert) {
            assert.expect(3);

            const model = new Model();
            model.dispatch("ADD_PIVOT_FILTER", {
                filter: {
                    id: "42",
                    type: "text",
                    label: "Cuillère",
                    fields: {
                        1: {
                            field: "name",
                            type: "char",
                        },
                    },
                },
            });
            model.dispatch("EDIT_PIVOT_FILTER", {
                id: "42",
                filter: {
                    id: "42",
                    type: "text",
                    label: "Arthouuuuuur",
                    fields: {
                        1: {
                            field: "name",
                            type: "char",
                        },
                    },
                },
            });
            assert.equal(model.getters.getGlobalFilters()[0].label, "Arthouuuuuur");
            model.dispatch("REQUEST_UNDO");
            assert.equal(model.getters.getGlobalFilters()[0].label, "Cuillère");
            model.dispatch("REQUEST_REDO");
            assert.equal(model.getters.getGlobalFilters()[0].label, "Arthouuuuuur");
        }
    );

    test("Changing the range of a date global filter reset the default value", async function (assert) {
        assert.expect(1);

        const { webClient, model } = await createSpreadsheetFromPivot();
        model.dispatch("ADD_PIVOT_FILTER", { filter: {
            id: "42",
            type: "date",
            rangeType: "month",
            label: "This month",
            fields: {
                1: { field: "create_date", type: "datetime" }
            },
            defaultValue: {
                period: "january"
            }
        }});
        const searchIcon = $(webClient.el).find(".o_topbar_filter_icon")[0];
        await testUtils.dom.click(searchIcon);
        const editFilter = $(webClient.el).find(".o_side_panel_filter_icon");
        await testUtils.dom.click(editFilter);
        const options = $(webClient.el).find(".o_spreadsheet_filter_editor_side_panel .o_side_panel_section")[1];
        options.querySelector("select option[value='year']").setAttribute("selected", "selected");
        await testUtils.dom.triggerEvent(options.querySelector("select"), "change");
        await testUtils.nextTick();
        await testUtils.dom.click($(webClient.el).find(".o_global_filter_save")[0]);
        await testUtils.nextTick();
        assert.deepEqual(model.getters.getGlobalFilters()[0].defaultValue, {});
    });
});
