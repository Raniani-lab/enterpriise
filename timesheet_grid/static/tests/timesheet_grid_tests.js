/** @odoo-module **/

import { click, getFixture, patchDate } from "@web/../tests/helpers/utils";
import { setupViewRegistries } from "@web/../tests/views/helpers";

import { start, startServer } from "@mail/../tests/helpers/test_utils";

import { addModelNamesToFetch } from "@bus/../tests/helpers/model_definitions_helpers";

addModelNamesToFetch(["project.project", "project.task"]);

function get_planned_and_worked_hours(resIds) {
    const result = {};
    for (const id of resIds) {
        result[id] = {
            planned_hours: 8,
            uom: "hours",
            worked_hours: 7,
        };
    }
    return result;
}

function get_timesheet_and_working_hours_for_employees(employeeIds, dateStart, dateEnd) {
    const result = {};
    for (const employeeId of employeeIds) {
        // Employee 11 hasn't done all his hours
        if (employeeId === 1) {
            result[employeeId] = {
                units_to_work: 987,
                uom: "hours",
                worked_hours: 789,
            };
        }

        // Employee 7 has done all his hours
        else if (employeeId === 2) {
            result[employeeId] = {
                units_to_work: 654,
                uom: "hours",
                worked_hours: 654,
            };
        } else if (employeeId === 4) {
            result[employeeId] = {
                units_to_work: 21,
                uom: "days",
                worked_hours: 20,
            };
        } else {
            // The others have done too much hours (overtime)
            result[employeeId] = {
                units_to_work: 6,
                uom: "hours",
                worked_hours: 10,
            };
        }
    }
    employeeIds.forEach((employeeId) => {});
    return result;
}

export async function mockTimesheetGridRPC(route, args) {
    if (
        args.method === "get_planned_and_worked_hours" &&
        ["project.project", "project.task"].includes(args.model)
    ) {
        return get_planned_and_worked_hours(...args.args);
    } else if (args.method === "get_timesheet_and_working_hours_for_employees") {
        return get_timesheet_and_working_hours_for_employees(...args.args);
    } else if (args.method === "grid_unavailability") {
        const [dateStart, dateEnd] = args.args;
        const employeeIds = args.kwargs.res_ids || [];
        const unavailabilityDates = Object.fromEntries(
            employeeIds.map((emp) => [emp, [dateStart, dateEnd]])
        );
        unavailabilityDates.false = [dateStart, dateEnd];
        return unavailabilityDates;
    } else if (args.model !== "analytic.line" && args.method === "web_read_group") {
        return {
            groups: [],
            length: 0,
        };
    }
}

export async function setupTimesheetGrid() {
    const pyEnv = await startServer();
    const [employeeId11, employeeId7, employeeId23, employeeId12] = pyEnv[
        "hr.employee.public"
    ].create([
        {
            name: "Mario",
        },
        {
            name: "Luigi",
        },
        {
            name: "Yoshi",
        },
        {
            name: "Toad",
        },
    ]);

    const [projectId31, projectId142] = pyEnv["project.project"].create([
        { display_name: "P1" },
        { display_name: "Webocalypse Now" },
    ]);

    const [taskId1, taskId12, taskId54] = pyEnv["project.task"].create([
        { display_name: "BS task", project_id: projectId31 },
        { display_name: "Another BS task", project_id: projectId142 },
        { display_name: "yet another task", project_id: projectId142 },
    ]);

    pyEnv.mockServer.models["analytic.line"] = {
        fields: {
            id: { string: "ID", type: "integer" },
            name: { string: "Description", type: "char" },
            project_id: {
                string: "Project",
                type: "many2one",
                relation: "project.project",
            },
            task_id: { string: "Task", type: "many2one", relation: "project.task" },
            employee_id: {
                string: "Employee",
                type: "many2one",
                relation: "hr.employee.public",
            },
            date: { string: "Date", type: "date" },
            unit_amount: { string: "Unit Amount", type: "float", group_operator: "sum" },
        },
        records: [
            {
                id: 1,
                project_id: projectId31,
                employee_id: employeeId7,
                date: "2017-01-24",
                unit_amount: 2.5,
            },
            {
                id: 2,
                project_id: projectId31,
                task_id: taskId1,
                employee_id: employeeId11,
                date: "2017-01-25",
                unit_amount: 2,
            },
            {
                id: 3,
                project_id: projectId31,
                task_id: taskId1,
                employee_id: employeeId23,
                date: "2017-01-25",
                unit_amount: 5.5,
            },
            {
                id: 4,
                project_id: projectId142,
                task_id: taskId54,
                employee_id: employeeId11,
                date: "2017-01-27",
                unit_amount: 10,
            },
            {
                id: 5,
                project_id: projectId142,
                task_id: taskId12,
                employee_id: employeeId7,
                date: "2017-01-27",
                unit_amount: -3.5,
            },
            {
                id: 6,
                project_id: projectId142,
                task_id: taskId1,
                employee_id: employeeId12,
                date: "2017-01-26",
                unit_amount: 4,
            },
        ],
    };

    patchDate(2017, 0, 25, 0, 0, 0);

    const serverData = {
        views: {
            "analytic.line,false,form": `
                    <form string="Add a line">
                        <group>
                            <group>
                                <field name="project_id"/>
                                <field name="task_id"/>
                                <field name="date"/>
                                <field name="unit_amount" string="Time spent"/>
                            </group>
                        </group>
                    </form>`,
            "analytic.line,false,list": `
                    <tree>
                        <field name="date" />
                        <field name="project_id" />
                        <field name="task_id" />
                        <field name="selection_field" />
                        <field name="unit_amount" />
                    </tree>`,
            "analytic.line,false,grid": `
                    <grid js_class="timesheet_grid" barchart_total="1">
                        <field name="employee_id" type="row" widget="timesheet_many2one_avatar_employee"/>
                        <field name="project_id" type="row" widget="timesheet_many2one"/>
                        <field name="task_id" type="row" widget="timesheet_many2one"/>
                        <field name="date" type="col">
                            <range name="week" string="Week" span="week" step="day"/>
                            <range name="month" string="Month" span="month" step="day"/>
                            <range name="year" string="Year" span="year" step="month"/>
                        </field>
                        <field name="unit_amount" type="measure" widget="float_time"/>
                        <button string="Action" type="action" name="action_name" />
                    </grid>`,
            "analytic.line,1,grid": `<grid js_class="timesheet_grid" barchart_total="1">
                    <field name="employee_id" type="row" section="1" widget="timesheet_many2one_avatar_employee"/>
                    <field name="project_id" type="row" widget="timesheet_many2one"/>
                    <field name="task_id" type="row" widget="timesheet_many2one"/>
                    <field name="date" type="col">
                        <range name="week" string="Week" span="week" step="day"/>
                        <range name="month" string="Month" span="month" step="day"/>
                        <range name="year" string="Year" span="year" step="month"/>
                    </field>
                    <field name="unit_amount" type="measure" widget="float_time"/>
                </grid>`,
            "analytic.line,false,search": `
                    <search>
                        <field name="project_id"/>
                        <filter string="Project" name="groupby_project" domain="[]" context="{'group_by': 'project_id'}"/>
                        <filter string="Task" name="groupby_task" domain="[]" context="{'group_by': 'task_id'}"/>
                        <filter string="Selection" name="groupby_selection" domain="[]" context="{'group_by': 'selection_field'}"/>
                    </search>
                `,
        },
    };
    return { pyEnv, serverData };
}

let serverData, target;

QUnit.module("Views", (hooks) => {
    hooks.beforeEach(async () => {
        const result = await setupTimesheetGrid();
        serverData = result.serverData;
        target = getFixture();
        setupViewRegistries();
    });

    QUnit.module("TimesheetGridView");

    QUnit.test("basic timesheet - no groupby", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"]],
            context: { group_by: [] },
        });

        assert.containsN(
            target,
            ".o_field_timesheet_many2one_avatar_employee",
            6,
            "should have 6 employee avatars"
        );
        assert.containsN(
            target,
            ".o_field_timesheet_many2one",
            11,
            "should have 11 many2one widgets in total"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            6,
            "should have 6 rows displayed in the grid"
        );
    });

    QUnit.test("basic timesheet - groupby employees", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"]],
            context: { group_by: ["employee_id"] },
        });

        assert.containsN(
            target,
            ".o_field_timesheet_many2one_avatar_employee",
            4,
            "should have 4 employee avatars"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            4,
            "should have 4 rows displayed in the grid"
        );
    });

    QUnit.test("basic timesheet - groupby employees>task", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"]],
            context: { group_by: ["employee_id", "task_id"] },
        });

        assert.containsN(
            target,
            ".o_field_timesheet_many2one_avatar_employee",
            6,
            "should have 6 employee avatars"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            6,
            "should have 4 rows displayed in the grid"
        );
        assert.containsN(
            target,
            ".o_field_timesheet_many2one",
            5,
            "should have 5 many2one widgets in total"
        );
        assert.containsN(target, ".o_field_widget", 11, "should have 11 widgets in total");
    });

    QUnit.test("basic timesheet - groupby task>employees", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"]],
            context: { group_by: ["task_id", "employee_id"] },
        });

        assert.containsN(
            target,
            ".o_field_timesheet_many2one_avatar_employee",
            6,
            "should have 6 employee avatars"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            6,
            "should have 4 rows displayed in the grid"
        );
        assert.containsN(
            target,
            ".o_field_timesheet_many2one",
            5,
            "should have 5 many2one widgets in total"
        );
        assert.containsN(target, ".o_field_widget", 11, "should have 11 widgets in total");
    });

    QUnit.test("timesheet with employee section - no groupby", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[1, "grid"]],
            context: { group_by: [] },
        });

        assert.containsN(
            target,
            ".o_grid_section_title .o_field_timesheet_many2one_avatar_employee",
            4,
            "should have 4 sections with employee avatar"
        );
        assert.containsN(
            target,
            ".o_field_timesheet_many2one",
            11,
            "should have 11 many2one widgets in total"
        );
        assert.containsNone(
            target,
            ".o_grid_row_title .o_field_timesheet_many2one_avatar_employee",
            "No employee avatar should be displayed in the rows"
        );
        assert.containsN(
            target,
            ".o_grid_row_title .o_field_timesheet_many2one",
            11,
            "The 11 many2one widgets should be displayed in the rows"
        );
        assert.containsNone(
            target,
            ".o_grid_section_title .o_field_timesheet_many2one",
            "No many2one widgets should be displayed in the sections"
        );
        assert.containsN(
            target,
            ".o_grid_section_title",
            4,
            "4 sections should be rendered in the grid view"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            6,
            "should have 6 rows displayed in the grid"
        );
    });

    QUnit.test("timesheet with employee section - groupby employees", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[1, "grid"]],
            context: { group_by: ["employee_id"] },
        });

        assert.containsNone(
            target,
            ".o_grid_section_title .o_field_timesheet_many2one_avatar_employee",
            "No employee avatar should be displayed in the sections"
        );
        assert.containsN(
            target,
            ".o_grid_row_title .o_field_timesheet_many2one_avatar_employee",
            4,
            "should have 4 rows with employee avatar"
        );
        assert.containsNone(
            target,
            ".o_field_timesheet_many2one",
            "No many2one widgets should be rendered"
        );
        assert.containsNone(
            target,
            ".o_grid_section_title",
            "No sections should be displayed in the grid"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            4,
            "4 rows should be rendered in the grid view"
        );
    });

    QUnit.test("timesheet with employee section - groupby employee>task", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[1, "grid"]],
            context: { group_by: ["employee_id", "task_id"] },
        });

        assert.containsN(
            target,
            ".o_grid_section_title .o_field_timesheet_many2one_avatar_employee",
            4,
            "should have 4 sections with employee avatar"
        );
        assert.containsN(
            target,
            ".o_field_timesheet_many2one",
            5,
            "should have 11 many2one widgets in total"
        );
        assert.containsNone(
            target,
            ".o_grid_row_title .o_field_timesheet_many2one_avatar_employee",
            "No employee avatar should be displayed in the rows"
        );
        assert.containsN(
            target,
            ".o_grid_row_title .o_field_timesheet_many2one",
            5,
            "The 11 many2one widgets should be displayed in the rows"
        );
        assert.containsNone(
            target,
            ".o_grid_section_title .o_field_timesheet_many2one",
            "No many2one widgets should be displayed in the sections"
        );
        assert.containsN(
            target,
            ".o_grid_section_title",
            4,
            "4 sections should be rendered in the grid view"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            6,
            "should have 6 rows displayed in the grid"
        );
    });

    QUnit.test("timesheet with employee section - groupby task>employees", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[1, "grid"]],
            context: { group_by: ["task_id", "employee_id"] },
        });

        assert.containsNone(
            target,
            ".o_grid_section_title .o_field_timesheet_many2one_avatar_employee",
            "No employee avatar should be displayed in the sections"
        );
        assert.containsN(
            target,
            ".o_grid_row_title .o_field_timesheet_many2one_avatar_employee",
            6,
            "should have 4 rows with employee avatar"
        );
        assert.containsN(
            target,
            ".o_field_timesheet_many2one",
            5,
            "5 many2one widgets should be rendered"
        );
        assert.containsNone(
            target,
            ".o_grid_section_title",
            "No sections should be displayed in the grid"
        );
        assert.containsN(
            target,
            ".o_grid_row_title",
            6,
            "6 rows should be rendered in the grid view"
        );
    });

    QUnit.test(
        "timesheet avatar widget should not display overtime if in the view show the current period (today is displayed in the period)",
        async function (assert) {
            const { openView } = await start({
                serverData,
                mockRPC: mockTimesheetGridRPC,
            });

            await openView({
                res_model: "analytic.line",
                views: [[1, "grid"]],
                context: { group_by: [] },
            });

            assert.containsN(
                target,
                ".o_grid_section_title .o_field_timesheet_many2one_avatar_employee",
                4,
                "should have 4 sections with employee avatar"
            );

            assert.containsNone(
                target,
                ".o_grid_section_title .o_timesheet_overtime_indication",
                "No overtime indication should be displayed"
            );
        }
    );

    QUnit.test(
        "timesheet avatar widget should display hours in gray if all the hours were performed",
        async function (assert) {
            patchDate(2017, 0, 31, 0, 0, 0);
            const { openView } = await start({
                serverData,
                mockRPC: mockTimesheetGridRPC,
            });

            await openView({
                res_model: "analytic.line",
                views: [[1, "grid"]],
                context: { group_by: [], grid_anchor: "2017-01-25" },
            });

            assert.containsN(
                target,
                ".o_grid_section_title .o_field_timesheet_many2one_avatar_employee",
                4,
                "should have 4 sections with employee avatar"
            );
            assert.containsN(
                target,
                ".o_grid_section_title .o_timesheet_overtime_indication",
                3,
                "All the avatar should have a timesheet overtime indication displayed except one since he did his working hours without any overtime in the grid"
            );
            const sectionsTitleNodes = target.querySelectorAll(".o_grid_section_title");
            const sectionWithDangerOvertimeTextContents = [];
            const sectionWithSuccessOvertimeTextContents = [];
            const sectionWithoutOvertimeTextContents = [];
            for (const node of sectionsTitleNodes) {
                const overtimeNode = node.querySelector(".o_timesheet_overtime_indication");
                if (overtimeNode) {
                    if (overtimeNode.classList.contains("text-danger")) {
                        sectionWithDangerOvertimeTextContents.push(node.textContent);
                    } else {
                        sectionWithSuccessOvertimeTextContents.push(node.textContent);
                    }
                } else {
                    sectionWithoutOvertimeTextContents.push(node.textContent);
                }
            }
            assert.deepEqual(
                sectionWithDangerOvertimeTextContents,
                ["Mario-198:00", "Toad-1.00"],
                "Mario and Toad have not done all his working hours (the overtime indication for Toad is formatted in float since uom is Days and not hours)"
            );
            assert.deepEqual(
                sectionWithSuccessOvertimeTextContents,
                ["Yoshi+04:00"],
                "Yoshi should have done his working hours and even more."
            );
            assert.deepEqual(
                sectionWithoutOvertimeTextContents,
                ["Luigi"],
                "Luigi should have done his working hours without doing extra hours"
            );
        }
    );

    QUnit.test("when in Next week date should be first working day", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"]],
            context: { group_by: [] },
        });

        await click(target, ".o_grid_navigation_buttons > div > button > span.fa-arrow-right");
        await click(target, ".o_control_panel_main_buttons .d-none.d-xl-inline-flex .o_grid_button_add");
        assert.containsOnce(target, ".modal");
        assert.strictEqual(
            target.querySelector(".modal .o_field_widget[name=date] input").value,
            "01/30/2017"
        );
    });

    QUnit.test("when in Previous week date should be first working day", async function (assert) {
        const { openView } = await start({
            serverData,
            mockRPC: mockTimesheetGridRPC,
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"]],
            context: { group_by: [] },
        });

        await click(target, ".o_grid_navigation_buttons > div > button > span.fa-arrow-left");
        await click(target, ".o_control_panel_main_buttons .d-none.d-xl-inline-flex .o_grid_button_add");
        assert.containsOnce(target, ".modal");
        assert.strictEqual(
            target.querySelector(".modal .o_field_widget[name=date] input").value,
            "01/16/2017"
        );
    });
});
