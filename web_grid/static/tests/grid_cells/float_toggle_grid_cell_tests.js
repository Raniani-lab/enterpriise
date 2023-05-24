/** @odoo-module */

import { click, getFixture, patchDate, nextTick } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";

import { hoverGridCell } from "../helpers";

let serverData, target;

async function mockRPC(route, args) {
    if (args.method === "grid_unavailability") {
        return {};
    }
}

QUnit.module("Grid Cells", (hook) => {
    hook.beforeEach(() => {
        target = getFixture();
        serverData = {
            models: {
                grid: {
                    fields: {
                        foo_id: { string: "Foo", type: "many2one", relation: "foo" },
                        date: { string: "Date", type: "date" },
                        time: {
                            string: "Float time field",
                            type: "float",
                            digits: [2, 1],
                            group_operator: "sum",
                        },
                    },
                    records: [{ id: 1, date: "2023-03-20", foo_id: 1, time: 0.0 }],
                },
                foo: {
                    fields: {
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ name: "Foo" }],
                },
            },
            views: {
                "grid,false,grid": `<grid editable="1">
                    <field name="foo_id" type="row"/>
                    <field name="date" type="col">
                        <range name="day" string="Day" span="day" step="day"/>
                    </field>
                    <field name="time" type="measure" widget="float_toggle"/>
                </grid>`,
            },
        };
        setupViewRegistries();
        patchDate(2023, 2, 20, 0, 0, 0);
    });

    QUnit.module("FloatToggleGridCell");

    QUnit.test("FloatToggleGridCell in grid view", async function (assert) {
        await makeView({
            type: "grid",
            resModel: "grid",
            serverData,
            mockRPC,
            viewId: false,
        });

        const cell = target.querySelector(
            ".o_grid_row:not(.o_grid_row_total,.o_grid_row_title,.o_grid_column_total)"
        );
        assert.strictEqual(cell.textContent, "0.00", "Initial cell content should be 0.00");
        await hoverGridCell(cell);
        await nextTick();
        await click(target, ".o_grid_search_btn");
        assert.strictEqual(
            cell.textContent,
            "0.00",
            "Clicking on the magnifying glass shouldn't alter the content of the cell"
        );
    });
});
