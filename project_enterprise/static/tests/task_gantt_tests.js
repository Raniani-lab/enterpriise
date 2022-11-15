/** @odoo-module */

import { getFixture, patchDate } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { registry } from "@web/core/registry";
import { hoverGridCell, SELECTORS } from "@web_gantt/../tests/helpers";

const serviceRegistry = registry.category("services");

const ganttViewParams = {
    arch: '<gantt js_class="task_gantt" date_start="start" date_stop="stop"/>',
    resModel: "task",
    type: "gantt",
    groupBy: [],
    async mockRPC(_, args) {
        if (args.method === "search_milestone_from_task") {
            return [];
        }
    },
};

let target;
QUnit.module("Views > TaskGanttView", {
    beforeEach() {
        patchDate(2021, 5, 22, 8, 0, 0);

        setupViewRegistries();

        target = getFixture();

        serviceRegistry.add("mail.thread", { start() {} });

        ganttViewParams.serverData = {
            models: {
                task: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                        start: { string: "Start Date", type: "datetime" },
                        stop: { string: "Start Date", type: "datetime" },
                        time: { string: "Time", type: "float" },
                        user_ids: {
                            string: "Assigned to",
                            type: "many2one",
                            relation: "res.users",
                        },
                        stuff_id: {
                            string: "Stuff",
                            type: "many2one",
                            relation: "stuff",
                        },
                        active: { string: "active", type: "boolean", default: true },
                        project_id: {
                            string: "Project",
                            type: "many2one",
                            relation: "project",
                        },
                    },
                    records: [
                        {
                            id: 1,
                            name: "Blop",
                            start: "2021-06-14 08:00:00",
                            stop: "2021-06-24 08:00:00",
                            user_ids: 100,
                            project_id: 1,
                        },
                        {
                            id: 2,
                            name: "Yop",
                            start: "2021-06-02 08:00:00",
                            stop: "2021-06-12 08:00:00",
                            user_ids: 101,
                            stuff_id: 1,
                            project_id: 1,
                        },
                    ],
                },
                "res.users": {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [
                        { id: 100, name: "Jane Doe" },
                        { id: 101, name: "John Doe" },
                    ],
                },
                stuff: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ id: 1, name: "Bruce Willis" }],
                },
                project: {
                    fields: {
                        id: { string: "ID", type: "integer" },
                        name: { string: "Name", type: "char" },
                    },
                    records: [{ id: 1, name: "My Project" }],
                },
            },
        };
    },
});

QUnit.test(
    "not user_ids grouped: empty groups are displayed first and user avatar is not displayed",
    async (assert) => {
        await makeView({ ...ganttViewParams, groupBy: ["stuff_id"] });
        assert.deepEqual(
            [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map(
                (el) => el.innerText
            ),
            ["Undefined Stuff", "Bruce Willis"],
            "'Undefined Stuff' should be the first group"
        );
        assert.containsNone(target, ".o_gantt_row_headers .o-mail-Avatar");
    }
);

QUnit.test("not user_ids grouped: no empty group if no records", async (assert) => {
    // delete the record having no stuff_id
    ganttViewParams.serverData.models.task.records.splice(0, 1);
    await makeView({ ...ganttViewParams, groupBy: ["stuff_id"] });

    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map(
            (el) => el.innerText
        ),
        ["Bruce Willis"],
        "should not have an 'Undefined Stuff' group"
    );
});

QUnit.test("user_ids grouped: specific empty group added, even if no records", async (assert) => {
    await makeView({ ...ganttViewParams, groupBy: ["user_ids"] });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map(
            (el) => el.innerText
        ),
        ["Unassigned Tasks", "Jane Doe", "John Doe"],
        "'Unassigned Tasks' should be the first group, even if no record exist without user_ids"
    );
    assert.containsN(target, ".o_gantt_row_headers .o-mail-Avatar", 2);
});

QUnit.test("[user_ids, ...] grouped", async (assert) => {
    // add an unassigned task (no user_ids) that has a linked stuff
    ganttViewParams.serverData.models.task.records.push({
        id: 3,
        name: "Gnop",
        start: "2021-06-02 08:00:00",
        stop: "2021-06-12 08:00:00",
        stuff_id: 1,
    });
    await makeView({ ...ganttViewParams, groupBy: ["user_ids", "stuff_id"] });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        [
            "Unassigned Tasks",
            "Undefined Stuff",
            "Bruce Willis",
            "Jane Doe",
            "Undefined Stuff",
            "John Doe",
            "Bruce Willis",
        ]
    );
});

QUnit.test("[..., user_ids(, ...)] grouped", async (assert) => {
    await makeView({ ...ganttViewParams, groupBy: ["stuff_id", "user_ids"] });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        [
            "Undefined Stuff",
            "Unassigned Tasks",
            "Jane Doe",
            "Bruce Willis",
            "Unassigned Tasks",
            "John Doe",
        ]
    );
});

QUnit.test('Empty groupby "Assigned To" and "Project" can be rendered', async function (assert) {
    ganttViewParams.serverData.models.task.records = [];
    await makeView({
        ...ganttViewParams,
        groupBy: ["user_ids", "project_id"],
    });
    assert.deepEqual(
        [...target.querySelectorAll(".o_gantt_row_headers .o_gantt_row_title")].map((el) =>
            el.innerText.trim()
        ),
        ["Unassigned Tasks", "Undefined Project"]
    );
});

QUnit.test("progress bar has the correct unit", async (assert) => {
    assert.expect(9);
    await makeView({
        arch: '<gantt js_class="task_gantt" date_start="start" date_stop="stop" progress_bar="user_ids"/>',
        resModel: "task",
        type: "gantt",
        groupBy: ["user_ids"],
        serverData: ganttViewParams.serverData,
        async mockRPC(_, { args, method, model }) {
            if (method === "search_milestone_from_task") {
                return [];
            }
            if (method === "gantt_progress_bar") {
                assert.strictEqual(model, "task");
                assert.deepEqual(args[0], ["user_ids"]);
                assert.deepEqual(args[1], { user_ids: [100, 101] });
                return {
                    user_ids: {
                        100: { value: 100, max_value: 100 },
                    },
                };
            }
        },
    });
    assert.containsOnce(target, SELECTORS.progressBar);
    assert.containsOnce(target, SELECTORS.progressBarBackground);
    assert.strictEqual(target.querySelector(SELECTORS.progressBarBackground).style.width, "100%");

    assert.containsNone(target, SELECTORS.progressBarForeground);
    await hoverGridCell(2, 1);
    assert.containsOnce(target, SELECTORS.progressBarForeground);
    assert.deepEqual(
        target.querySelector(SELECTORS.progressBarForeground).textContent,
        "100 h / 100 h"
    );
});
