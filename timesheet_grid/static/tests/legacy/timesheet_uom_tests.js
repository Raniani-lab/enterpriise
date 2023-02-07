odoo.define('timesheet_grid.timesheet_uom_tests', function (require) {
"use strict";

const session = require('web.session');
const SetupTimesheetUOMWidgetsTestEnvironment = require('hr_timesheet.timesheet_uom_tests_env');
const GridView = require('timesheet_grid.GridView');
const gridComponentRegistry = require('web_grid.component_registry');
const GridTimesheetUOM = require('timesheet_grid.timesheet_uom');
const TimerTimesheetUOM = require('thimesheet_grid.timesheet_uom_timer');
const { registry } = require("@web/core/registry");
const { timesheetUomGridService } = GridTimesheetUOM;
const { timesheetUomTimerService } = TimerTimesheetUOM;

const get_planned_and_worked_hours = function (args) {
    const ids = [...new Set(args[0].map(item => item.id))];
    const result = {};
    for (const id of ids) {
        result[id] = {
            'planned_hours': 8,
            'uom': 'hours',
            'worked_hours': 7,
        };
    }
    return result;
};


QUnit.module('Timesheet UOM Widgets', function (hooks) {
    let env;
    let sessionUserCompaniesBackup;
    let sessionUserContextBackup;
    let sessionUOMIdsBackup;
    let sessionUIDBackup;
    hooks.beforeEach(function (assert) {
        env = new SetupTimesheetUOMWidgetsTestEnvironment();
        env.data['project.task'].get_planned_and_worked_hours = get_planned_and_worked_hours;
        env.data['project.project'].get_planned_and_worked_hours = get_planned_and_worked_hours;
        const originalPatch = env.patchSessionAndStartServices.bind(env);
        env.patchSessionAndStartServices = (...args) => {
            const serviceRegistry = registry.category("services");
            if (!serviceRegistry.contains("timesheet_uom_grid")) {
                serviceRegistry.add("timesheet_uom_grid", timesheetUomGridService);
            }
            if (!serviceRegistry.contains("timesheet_uom_timer")) {
                serviceRegistry.add("timesheet_uom_timer", timesheetUomTimerService);
            }
            return originalPatch(...args);
        }
        // Backups session parts that this testing module will alter in order to restore it at the end.
        sessionUserCompaniesBackup = session.user_companies || false;
        sessionUserContextBackup = session.user_context || false;
        sessionUOMIdsBackup = session.uom_ids || false;
        sessionUIDBackup = session.uid || false;
    });
    hooks.afterEach(async function (assert) {
        // Restores the session
        const sessionToApply = Object.assign(
            { },
            sessionUserCompaniesBackup && {
                user_companies: sessionUserCompaniesBackup
            } || { },
            sessionUserContextBackup && {
                user_context: sessionUserContextBackup
            } || { },
            sessionUOMIdsBackup && {
                uom_ids: sessionUOMIdsBackup
            } || { },
            sessionUIDBackup && {
                uid: sessionUIDBackup
            } || { });
        await env.patchSessionAndStartServices(sessionToApply, true);
    });
    QUnit.module('GridView timesheet_uom', function (hooks) {
        QUnit.module('fieldRegistry', async function (hooks) {
            QUnit.test('the timesheet_uom widget added to the WebGrid fieldRegistry is company related', async function (assert) {
                assert.expect(2);
                let sessionToApply = {
                    uom_ids: Object.assign(
                        { },
                        {
                            1: {
                                timesheet_widget: 'float_factor',
                            },
                        }),
                };
                await env.patchSessionAndStartServices(sessionToApply);
                assert.ok(gridComponentRegistry.get('timesheet_uom') == GridTimesheetUOM.FloatFactorComponentTimesheet, 'FloatFactorComponentTimesheet is rendered when company uom has float_factor as timesheet_widget');

                sessionToApply = {
                    uom_ids: Object.assign(
                        { },
                        {
                            1: {
                                timesheet_widget: 'float_toggle',
                            },
                        }),
                };
                await env.patchSessionAndStartServices(sessionToApply);
                assert.ok(gridComponentRegistry.get('timesheet_uom') == GridTimesheetUOM.FloatToggleComponentTimesheet, 'FloatToggleComponentTimesheet is rendered when company uom has float_toggle as timesheet_widget');
            });
        });
        QUnit.module('nodeOptions factor', function (hooks) {
            QUnit.test('the Grid timesheet factor nodeOptions are company related', async function (assert) {
                assert.expect(4);

                let options = {
                    View: GridView,
                    arch: `<grid string="Timesheet" adjustment="object" adjust_name="adjust_grid">
                               <field name="unit_amount" type="measure" widget="timesheet_uom"/>
                               <field name="task_id" type="row"/>
                               <field name="date" type="col">
                                   <range name="week" string="Week" span="week" step="day"/>
                                   <range name="month" string="Month" span="month" step="day"/>
                                   <range name="year" string="Year" span="year" step="month"/>
                               </field>
                           </grid>`,
                    currentDate: env.data['account.analytic.line'].records[0].date,
                    session: {
                        uom_ids: Object.assign(
                            { },
                            {
                                1: {
                                    timesheet_widget: 'float_factor',
                                },
                            }),
                    },
                };
                let grid = await env.createView(options);
                let $renderedTotalData = grid.$('.o_view_grid tbody tr:nth-of-type(1) td:nth-of-type(2) :contains("8.00")');
                assert.ok($renderedTotalData.length, 'The GridView FloatFactorComponentTimesheet widget is taking the timesheet_uom_factor into account');
                grid.destroy();

                options = Object.assign(
                    { },
                    options,
                    {
                    uom_ids: Object.assign(
                        { },
                        {
                            1: {
                                timesheet_widget: 'float_toggle',
                            },
                        }),
                    });
                grid = await env.createView(options);
                $renderedTotalData = grid.$('.o_view_grid tbody tr:nth-of-type(1) td:nth-of-type(2) :contains("8.00")');
                assert.ok($renderedTotalData.length, 'The GridView FloatToggleComponentTimesheet widget is taking the timesheet_uom_factor into account');
                grid.destroy();

                options = Object.assign(
                    { },
                    options,
                    {
                        session: {
                            user_context: env.singleCompanyDayUOMUser,
                        },
                        uom_ids: Object.assign(
                            { },
                            {
                                2: {
                                    timesheet_widget: 'float_factor',
                                },
                            }),
                    });
                grid = await env.createView(options);
                $renderedTotalData = grid.$('.o_view_grid tbody tr:nth-of-type(1) td:nth-of-type(2) :contains("1.00")');
                assert.ok($renderedTotalData.length, 'The GridView FloatFactorComponentTimesheet widget is taking the timesheet_uom_factor into account');
                grid.destroy();

                options = Object.assign(
                    { },
                    options,
                    {
                    uom_ids: Object.assign(
                        { },
                        {
                            2: {
                                timesheet_widget: 'float_toggle',
                            },
                        }),
                    });
                grid = await env.createView(options);
                $renderedTotalData = grid.$('.o_view_grid tbody tr:nth-of-type(1) td:nth-of-type(2) :contains("1.00")');
                assert.ok($renderedTotalData.length, 'The GridView FloatToggleComponentTimesheet widget is taking the timesheet_uom_factor into account');
                grid.destroy();
            });
        });
    });
});
});
