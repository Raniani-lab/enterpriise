/** @odoo-module */

import { getBasicServerData } from "../utils/spreadsheet_test_data";
import { click, getFixture } from "@web/../tests/helpers/utils";
import { createSpreadsheet } from "../spreadsheet_test_utils";

let target;

QUnit.module("documents_spreadsheet > global_filters side panel", {
    beforeEach: function () {
        target = getFixture();
    },
}, () => {

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
        let selector = `.o_field_many2one[name="ir.model"] input`;
        await click(target.querySelector(selector));
        let $dropdown = $(selector).autocomplete("widget");
        let $target = $dropdown.find(`li:contains(Product)`).first();
        await click($target[0]);

        let save = target.querySelector(
            ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
        );
        await click(save);
        assert.equal(target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length, 1);
        let globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "Product");
        assert.deepEqual(globalFilter.defaultValue, []);
        assert.deepEqual(globalFilter.pivotFields[1], { field: "product_id", type: "many2one" });
    });

    QUnit.test("Create a new relational global filter with a list snapshot", async function (assert) {
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
        let selector = `.o_field_many2one[name="ir.model"] input`;
        await click(target.querySelector(selector));
        let $dropdown = $(selector).autocomplete("widget");
        let $target = $dropdown.find(`li:contains(Product)`).first();
        await click($target[0]);

        let save = target.querySelector(
            ".o_spreadsheet_filter_editor_side_panel .o_global_filter_save"
        );
        await click(save);
        assert.equal(target.querySelectorAll(".o_spreadsheet_global_filters_side_panel").length, 1);
        let globalFilter = model.getters.getGlobalFilters()[0];
        assert.equal(globalFilter.label, "Product");
        assert.deepEqual(globalFilter.defaultValue, []);
        assert.deepEqual(globalFilter.listFields["1"], { field: "product_id", type: "many2one" });
    });
});
