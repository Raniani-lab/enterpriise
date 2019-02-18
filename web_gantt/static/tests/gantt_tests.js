odoo.define('web_gantt.tests', function (require) {
'use strict';

var concurrency = require('web.concurrency');
var GanttView = require('web_gantt.GanttView');
var GanttRenderer = require('web_gantt.GanttRenderer');
var GanttRow = require('web_gantt.GanttRow');
var testUtils = require('web.test_utils');


var initialDate = new Date(2018, 11, 20, 8, 0, 0);
initialDate = new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60 * 1000);

var createView = testUtils.createView;


function getPillItemWidth($el) {
    return $el.attr('style').split('width: ')[1].split(';')[0];
}

QUnit.module('Views', {
    beforeEach: function () {
        this.data = {
            tasks: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                    start: {string: 'Start Date', type: 'datetime'},
                    stop: {string: 'Stop Date', type: 'datetime'},
                    stage: {string: 'Stage', type: 'selection', selection: [['todo', 'To Do'], ['in_progress', 'In Progress'], ['done', 'Done'], ['cancel', 'Cancelled']]},
                    project_id: {string: 'Project', type: 'many2one', relation: 'projects'},
                    user_id: {string: 'Assign To', type: 'many2one', relation: 'users'},
                    color: {string: 'Color', type: 'integer'},
                    progress: {string: 'Progress', type: 'integer'},
                    exclude: {string: 'Excluded from Consolidation', type: 'boolean'},
                },
                records: [
                    {id: 1, name: 'Task 1', start: '2018-11-30 18:30:00', stop: '2018-12-31 18:29:59', stage: 'todo', project_id: 1, user_id: 1, color: 0, progress: 0},
                    { id: 2, name: 'Task 2', start: '2018-12-17 11:30:00', stop: '2018-12-22 06:29:59', stage: 'done', project_id: 1, user_id: 2, color: 2, progress: 30},
                    { id: 3, name: 'Task 3', start: '2018-12-27 06:30:00', stop: '2019-01-03 06:29:59', stage: 'cancel', project_id: 1, user_id: 2, color: 10, progress: 60},
                    { id: 4, name: 'Task 4', start: '2018-12-19 18:30:00', stop: '2018-12-20 06:29:59', stage: 'in_progress', project_id: 1, user_id: 1, color: 1, progress: false, exclude: 0},
                    { id: 5, name: 'Task 5', start: '2018-11-08 01:53:10', stop: '2018-12-04 02:34:34', stage: 'done', project_id: 2, user_id: 1, color: 2, progress: 100, exclude: 1},
                    { id: 6, name: 'Task 6', start: '2018-11-19 23:00:00', stop: '2018-11-20 04:21:01', stage: 'in_progress', project_id: 2, user_id: 1, color: 1, progress: 0},
                    { id: 7, name: 'Task 7', start: '2018-12-20 06:30:12', stop: '2018-12-20 18:29:59', stage: 'cancel', project_id: 2, user_id: 2, color: 10, progress: 80},
                ],
            },
            projects: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                },
                records: [
                    {id: 1, name: 'Project 1'},
                    {id: 2, name: 'Project 2'},
                ],
            },
            users: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    name: {string: 'Name', type: 'char'},
                },
                records: [
                    {id: 1, name: 'User 1'},
                    {id: 2, name: 'User 2'},
                ],
            },
        };
    },
}, function () {
    QUnit.module('GanttView');

    // BASIC TESTS

    QUnit.test('empty ungrouped gantt rendering', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 0]],
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row',
            'should have a 1 row');

        gantt.destroy();
    });

    QUnit.test('ungrouped gantt rendering', function (assert) {
        var done = assert.async();
        assert.expect(18);

        var POPOVER_DELAY = GanttRow.prototype.POPOVER_DELAY;
        GanttRow.prototype.POPOVER_DELAY = 0;

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (route === '/web/dataset/search_read') {
                    assert.strictEqual(args.model, 'tasks',
                        "should read on the correct model");
                } else if (route === '/web/dataset/call_kw/tasks/read_group') {
                    throw Error("Should not call read_group when no groupby !");
                }
                return this._super.apply(this, arguments);
            },
            session: {
                getTZOffset: function () {
                    return 60;
                },
            },
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'), 'active',
            'month view should be activated by default');
        assert.notOk(gantt.$buttons.find('.o_gantt_button_expand_rows').is(':visible'),
            "the expand button should be invisible (only displayed if useful)");
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'December 2018',
            'should contain "December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row',
            'should have a 1 row');
        assert.containsNone(gantt, '.o_gantt_row_container .o_gantt_row .o_gantt_row_sidebar',
            'should not have a sidebar');
        assert.containsN(gantt, '.o_gantt_pill_wrapper', 6,
            'should have a 6 pills');

        // verify that the level offset is correctly applied
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-01 00:00:00"] .o_gantt_pill_wrapper:contains(Task 1)').css('padding-top'), '0px',
            'task 1 should be in first level');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-01 00:00:00"] .o_gantt_pill_wrapper:contains(Task 5)').css('padding-top'), GanttRow.prototype.LEVEL_TOP_OFFSET + 'px',
            'task 5 should be in second level');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-17 00:00:00"] .o_gantt_pill_wrapper:contains(Task 2)').css('padding-top'), GanttRow.prototype.LEVEL_TOP_OFFSET + 'px',
            'task 2 should be in second level');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-20 00:00:00"] .o_gantt_pill_wrapper:contains(Task 4)').css('padding-top'), 2 * GanttRow.prototype.LEVEL_TOP_OFFSET + 'px',
            'task 4 should be in third level');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-20 00:00:00"] .o_gantt_pill_wrapper:contains(Task 7)').css('padding-top'), 2 * GanttRow.prototype.LEVEL_TOP_OFFSET + 'px',
            'task 7 should be in third level');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-27 00:00:00"] .o_gantt_pill_wrapper:contains(Task 3)').css('padding-top'), GanttRow.prototype.LEVEL_TOP_OFFSET + 'px',
            'task 3 should be in second level');

        // test popover and local timezone
        assert.containsNone(gantt, 'div.popover', 'should not have a popover');
        gantt.$('.o_gantt_pill:contains("Task 2")').trigger('mouseenter');

        concurrency.delay(0).then(function () {
            assert.containsOnce($, 'div.popover', 'should have a popover');

            // TODO: these two assertions will fail with a different timezone
            // (hence, on runbot) because of momentJS `local()` function that
            // doesn't use the session.getTZOffset mocked in this test but we
            // haven't f another way to achieve the same behaviour without it

            // assert.strictEqual($('div.popover li:contains(Start Date)').text(), 'Start Date: 2018-12-17 12:30:00 PM',
            //     'popover should display start date of task 2 in local time');
            // assert.strictEqual($('div.popover li:contains(Stop Date)').text(), 'Stop Date: 2018-12-22 07:29:59 AM',
            //     'popover should display start date of task 2 in local time');

            gantt.$('.o_gantt_pill:contains("Task 2")').trigger('mouseleave');
            assert.containsNone(gantt, 'div.popover', 'should not have a popover anymore');

            GanttRow.prototype.POPOVER_DELAY = POPOVER_DELAY;
            gantt.destroy();
            done();
        });
    });

    QUnit.test('empty single-level grouped gantt rendering', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['project_id'],
            domain: [['id', '=', 0]],
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row',
            'should have a 1 row');

        gantt.destroy();
    });

    QUnit.test('single-level grouped gantt rendering', function (assert) {
        assert.expect(12);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt string="Tasks" date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['project_id'],
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'), 'active',
            'month view should by default activated');
        assert.notOk(gantt.$buttons.find('.o_gantt_button_expand_rows').is(':visible'),
            "the expand button should be invisible (only displayed if useful)");
        assert.strictEqual(gantt.$('.o_gantt_header_container > .o_gantt_row_sidebar').text().trim(), 'Tasks',
            'should contain "Tasks" in header sidebar');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'December 2018',
            'should contain "December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row', 2,
            'should have a 2 rows');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row:first-child .o_gantt_row_sidebar',
            'should have a sidebar');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:first-child .o_gantt_row_title').text().trim(), 'Project 1',
            'should contain "Project 1" in sidebar title');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row:first-child .o_gantt_pill_wrapper', 4,
            'should have a 4 pills in first row');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:last-child .o_gantt_row_title').text().trim(), 'Project 2',
            'should contain "Project 2" in sidebar title');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row:last-child .o_gantt_pill_wrapper', 2,
            'should have a 2 pills in first row');

        gantt.destroy();
    });

    QUnit.test('single-level grouped gantt rendering with group_expand', function (assert) {
        assert.expect(12);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt string="Tasks" date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['project_id'],
            mockRPC: function (route) {
                if (route === '/web/dataset/call_kw/tasks/read_group') {
                    return $.when([
                        { project_id: [20, "Unused Project 1"], project_id_count: 0 },
                        { project_id: [50, "Unused Project 2"], project_id_count: 0 },
                        { project_id: [2, "Project 2"], project_id_count: 2 },
                        { project_id: [30, "Unused Project 3"], project_id_count: 0 },
                        { project_id: [1, "Project 1"], project_id_count: 4 }
                    ]);
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'), 'active',
            'month view should by default activated');
        assert.notOk(gantt.$buttons.find('.o_gantt_button_expand_rows').is(':visible'),
            "the expand button should be invisible (only displayed if useful)");
        assert.strictEqual(gantt.$('.o_gantt_header_container > .o_gantt_row_sidebar').text().trim(), 'Tasks',
            'should contain "Tasks" in header sidebar');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'December 2018',
            'should contain "December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row', 5,
            'should have a 5 rows');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row:first-child .o_gantt_row_sidebar',
            'should have a sidebar');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:first-child .o_gantt_row_title').text().trim(), 'Unused Project 1',
            'should contain "Unused Project" in sidebar title');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row:first-child .o_gantt_pill_wrapper', 0,
            'should have 0 pills in first row');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:last-child .o_gantt_row_title').text().trim(), 'Project 1',
            'should contain "Project 1" in sidebar title');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row:not(.o_gantt_total_row):last-child .o_gantt_pill_wrapper', 4,
            'should have 4 pills in last row');

        gantt.destroy();
    });

    QUnit.test('multi-level grouped gantt rendering', function (assert) {
        assert.expect(31);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt string="Tasks" date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'project_id', 'stage'],
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'), 'active',
            'month view should by default activated');
        assert.ok(gantt.$buttons.find('.o_gantt_button_expand_rows').is(':visible'),
            "there should be an expand button");
        assert.strictEqual(gantt.$('.o_gantt_header_container > .o_gantt_row_sidebar').text().trim(), 'Tasks',
            'should contain "Tasks" in header sidebar');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'December 2018',
            'should contain "December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row', 12,
            'should have a 12 rows');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row_group.open', 6,
            'should have a 6 opened groups');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row:not(.o_gantt_row_group)', 6,
            'should have a 6 rows');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row:first .o_gantt_row_sidebar',
            'should have a sidebar');

        // Check grouped rows
        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:first'), 'o_gantt_row_group',
            '1st row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:first .o_gantt_row_title').text().trim(), 'User 1',
            '1st row title should be "User 1"');

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:nth(1)'), 'o_gantt_row_group',
            '2nd row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(1) .o_gantt_row_title').text().trim(), 'Project 1',
            '2nd row title should be "Project 1"');

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:nth(4)'), 'o_gantt_row_group',
            '5th row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(4) .o_gantt_row_title').text().trim(), 'Project 2',
            '5th row title should be "Project 2"');

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:nth(6)'), 'o_gantt_row_group',
            '7th row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(6) .o_gantt_row_title').text().trim(), 'User 2',
            '7th row title should be "User 2"');

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:nth(7)'), 'o_gantt_row_group',
            '8th row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(7) .o_gantt_row_title').text().trim(), 'Project 1',
            '8th row title should be "Project 1"');

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:nth(10)'), 'o_gantt_row_group',
            '11th row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(10) .o_gantt_row_title').text().trim(), 'Project 2',
            '11th row title should be "Project 2"');

        // group row count and greyscale
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill').text().replace(/\s+/g, ''), "2121",
            "the count should be correctly computed");

        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(0)').css('background-color'), "rgba(158, 158, 158, 0.6)",
            "the 1st group pill should have the correct grey scale)");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(1)').css('background-color'), "rgba(215, 215, 215, 0.6)",
            "the 2nd group pill should have the correct grey scale)");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(2)').css('background-color'), "rgba(158, 158, 158, 0.6)",
            "the 3rd group pill should have the correct grey scale");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(3)').css('background-color'), "rgba(215, 215, 215, 0.6)",
            "the 4th group pill should have the correct grey scale");

        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(0)')), "300%",
            "the 1st group pill should have the correct width (1 to 3 dec)");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(1)')), "1600%",
            "the 2nd group pill should have the correct width (4 to 19 dec)");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(2)')), "50%",
            "the 3rd group pill should have the correct width (20 morning dec");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(3)')), "1150%",
            "the 4th group pill should have the correct width (20 afternoon to 31 dec");

        gantt.destroy();
    });

    QUnit.test('scale switching', function (assert) {
        assert.expect(17);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        // default (month)
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'), 'active',
            'month view should be activated by default');

        // switch to day view
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=day]'));
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=day]'), 'active',
            'day view should be activated');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '20 December 2018',
            'should contain "20 December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 24,
            'should have a 24 slots for day view');
        assert.containsN(gantt, '.o_gantt_pill_wrapper', 4,
            'should have a 4 pills');

        // switch to week view
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=week]'));
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=week]'), 'active',
            'week view should be activated');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '16 December 2018 - 22 December 2018',
            'should contain "16 December 2018 - 22 December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 7,
            'should have a 7 slots for week view');
        assert.containsN(gantt, '.o_gantt_pill_wrapper', 4,
            'should have a 4 pills');

        // switch to month view
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'));
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=month]'), 'active',
            'month view should be activated');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'December 2018',
            'should contain "December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 31,
            'should have a 31 slots for month view');
        assert.containsN(gantt, '.o_gantt_pill_wrapper', 6,
            'should have a 6 pills');

        // switch to year view
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=year]'));
        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=year]'), 'active',
            'year view should be activated');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '2018',
            'should contain "2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 12,
            'should have a 12 slots for year view');
        assert.containsN(gantt, '.o_gantt_pill_wrapper', 7,
            'should have a 7 pills');

        gantt.destroy();
    });

    QUnit.test('today is highlighted', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
        });

        var dayOfMonth = moment().date();
        assert.containsOnce(gantt, '.o_gantt_header_cell.o_gantt_today',
            "there should be an highlighted day");
        assert.strictEqual(parseInt(gantt.$('.o_gantt_header_cell.o_gantt_today').text(), 10), dayOfMonth,
            'the highlighted day should be today');

        gantt.destroy();
    });

    // BEHAVIORAL TESTS

    QUnit.test('date navigation with timezone (1h)', function (assert) {
        assert.expect(32);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (route === '/web/dataset/search_read') {
                    assert.step(args.domain.toString());
                }
                return this._super.apply(this, arguments);
            },
            session: {
                getTZOffset: function () {
                    return 60;
                },
            },
        });
        var searchReads = [];
        searchReads.push("start,<=,2018-12-31 22:59:59,stop,>=,2018-11-30 23:00:00");
        assert.verifySteps(searchReads);

        // month navigation
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_prev'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'November 2018',
            'should contain "November 2018" in header');
        searchReads.push("start,<=,2018-11-30 22:59:59,stop,>=,2018-10-31 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_next'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), 'December 2018',
            'should contain "December 2018" in header');
        searchReads.push("start,<=,2018-12-31 22:59:59,stop,>=,2018-11-30 23:00:00");
        assert.verifySteps(searchReads);

        // switch to day view and check day navigation
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=day]'));
        searchReads.push("start,<=,2018-12-20 22:59:59,stop,>=,2018-12-19 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_prev'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '19 December 2018',
            'should contain "19 December 2018" in header');
        searchReads.push("start,<=,2018-12-19 22:59:59,stop,>=,2018-12-18 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_next'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '20 December 2018',
            'should contain "20 December 2018" in header');
        searchReads.push("start,<=,2018-12-20 22:59:59,stop,>=,2018-12-19 23:00:00");
        assert.verifySteps(searchReads);

        // switch to week view and check week navigation
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=week]'));
        searchReads.push("start,<=,2018-12-22 22:59:59,stop,>=,2018-12-15 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_prev'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '09 December 2018 - 15 December 2018',
            'should contain "09 December 2018 - 15 December 2018" in header');
        searchReads.push("start,<=,2018-12-15 22:59:59,stop,>=,2018-12-08 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_next'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '16 December 2018 - 22 December 2018',
            'should contain "16 December 2018 - 22 December 2018" in header');
        searchReads.push("start,<=,2018-12-22 22:59:59,stop,>=,2018-12-15 23:00:00");
        assert.verifySteps(searchReads);

        // switch to year view and check year navigation
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_scale[data-value=year]'));
        searchReads.push("start,<=,2018-12-31 22:59:59,stop,>=,2017-12-31 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_prev'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '2017',
            'should contain "2017" in header');
        searchReads.push("start,<=,2017-12-31 22:59:59,stop,>=,2016-12-31 23:00:00");
        assert.verifySteps(searchReads);

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_next'));
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '2018',
            'should contain "2018" in header');
        searchReads.push("start,<=,2018-12-31 22:59:59,stop,>=,2017-12-31 23:00:00");
        assert.verifySteps(searchReads);

        gantt.destroy();
    });

    QUnit.test('open a dialog to add a new task', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            archs: {
                'tasks,false,form': '<form>' +
                        '<field name="name"/>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</form>',
            },
        });

        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_add'));

        // check that the dialog is opened with prefilled fields
        var $modal = $('.modal');
        assert.strictEqual($modal.length, 1, 'There should be one modal opened');
        assert.strictEqual($modal.find('.o_field_widget[name=start] .o_input').val(), '12/01/2018 00:00:00',
            'the start date should be the start of the focus month');
        assert.strictEqual($modal.find('.o_field_widget[name=stop] .o_input').val(), '12/31/2018 23:59:59',
            'the end date should be the end of the focus month');

        gantt.destroy();
    });

    QUnit.test('open a dialog to create/edit a task', function (assert) {
        assert.expect(12);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            archs: {
                'tasks,false,form': '<form>' +
                        '<field name="name"/>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                        '<field name="stage"/>' +
                        '<field name="project_id"/>' +
                        '<field name="user_id"/>' +
                    '</form>',
            },
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'project_id', 'stage'],
        });

        // open dialog to create a task
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_row_container .o_gantt_row:nth(3) .o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_cell_add'), "mouseup");

        // check that the dialog is opened with prefilled fields
        var $modal = $('.modal-lg');
        assert.strictEqual($modal.length, 1, 'There should be one modal opened');
        assert.strictEqual($modal.find('.modal-title').text(), "Create");
        testUtils.fields.editInput($modal.find('input[name=name]'), 'Task 8');
        var $modalFieldStart = $modal.find('.o_field_widget[name=start]');
        assert.strictEqual($modalFieldStart.find('.o_input').val(), '12/10/2018 00:00:00',
            'The start field should have a value "12/10/2018 00:00:00"');
        var $modalFieldStop = $modal.find('.o_field_widget[name=stop]');
        assert.strictEqual($modalFieldStop.find('.o_input').val(), '12/10/2018 23:59:59',
            'The stop field should have a value "12/10/2018 23:59:59"');
        var $modalFieldProject = $modal.find('.o_field_widget.o_field_many2one[name=project_id]');
        assert.strictEqual($modalFieldProject.find('.o_input').val(), 'Project 1',
            'The project field should have a value "Project 1"');
        var $modalFieldUser = $modal.find('.o_field_widget.o_field_many2one[name=user_id]');
        assert.strictEqual($modalFieldUser.find('.o_input').val(), 'User 1',
            'The user field should have a value "User 1"');
        var $modalFieldStage = $modal.find('.o_field_widget[name=stage]');
        assert.strictEqual($modalFieldStage.val(), '"in_progress"',
            'The stage field should have a value "In Progress"');

        // create the task
        testUtils.modal.clickButton('Save & Close');
        assert.strictEqual($('.modal-lg').length, 0, 'Modal should be closed');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(3) .o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_pill').text().trim(), 'Task 8',
            'Task should be created with name "Task 8"');

        // open dialog to view a task
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_row_container .o_gantt_row:nth(3) .o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_pill'), "mouseup");
        $modal = $('.modal-lg');
        assert.strictEqual($modal.find('.modal-title').text(), "Open");
        assert.strictEqual($modal.length, 1, 'There should be one modal opened');
        assert.strictEqual($modal.find('input[name=name]').val(), 'Task 8',
            'should open dialog for "Task 8"');

        gantt.destroy();
    });

    QUnit.test('create dialog with timezone', function (assert) {
        assert.expect(4);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            archs: {
                'tasks,false,form': '<form>' +
                        '<field name="name"/>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                        '<field name="stage"/>' +
                        '<field name="project_id"/>' +
                        '<field name="user_id"/>' +
                    '</form>',
            },
            viewOptions: {
                initialDate: initialDate,
            },
            session: {
                getTZOffset: function () {
                    return 60;
                },
            },
            mockRPC: function (route, args) {
                if (args.method === 'create') {
                    assert.deepEqual(args.args, [{
                        name: false,
                        project_id: false,
                        stage: false,
                        start: "2018-12-09 23:00:00",
                        stop: "2018-12-10 22:59:59",
                        user_id: false,
                    }], "the start/stop date should take timezone into account");
                }
                return this._super.apply(this, arguments);
            },
        });

        // open dialog to create a task
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_cell_add'), "mouseup");

        assert.strictEqual($('.modal').length, 1, 'There should be one modal opened');
        assert.strictEqual($('.modal .o_field_widget[name=start] .o_input').val(), '12/10/2018 00:00:00',
            'The start field should have a value "12/10/2018 00:00:00"');
        assert.strictEqual($('.modal .o_field_widget[name = stop] .o_input').val(), '12/10/2018 23:59:59',
            'The stop field should have a value "12/10/2018 23:59:59"');

        // create the task
        testUtils.modal.clickButton('Save & Close');

        gantt.destroy();
    });

    QUnit.test('open a dialog to plan a task', function (assert) {
        assert.expect(5);

        this.data.tasks.records.push({ id: 41, name: 'Task 41' });
        this.data.tasks.records.push({ id: 42, name: 'Task 42', stop: '2018-12-31 18:29:59' });
        this.data.tasks.records.push({ id: 43, name: 'Task 43', start: '2018-11-30 18:30:00' });

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            archs: {
                'tasks,false,list': '<tree><field name="name"/></tree>',
                'tasks,false,search': '<search><field name="name"/></search>',
            },
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.strictEqual(args.model, 'tasks', "should write on the current model");
                    assert.deepEqual(args.args[0], [41, 42], "should write on the selected ids");
                    assert.deepEqual(args.args[1], { start: "2018-12-10 00:00:00", stop: "2018-12-10 23:59:59" },
                        "should write the correct values on the correct fields");
                }
                return this._super.apply(this, arguments);
            },
        });

        // click on the plan button
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_cell_plan'), "mouseup");

        assert.strictEqual($('.modal .o_list_view').length, 1,
            "a list view dialog should be opened");
        assert.strictEqual($('.modal .o_list_view tbody .o_data_cell').text().replace(/\s+/g, ''), "Task41Task42Task43",
            "the 3 records without date set should be displayed");

        testUtils.dom.click($('.modal .o_list_view tbody tr:eq(0) input'));
        testUtils.dom.click($('.modal .o_list_view tbody tr:eq(1) input'));
        testUtils.dom.click($('.modal .o_select_button:contains(Select)'));

        gantt.destroy();
    });

    QUnit.test('open a dialog to plan a task (with timezone)', function (assert) {
        assert.expect(2);

        this.data.tasks.records.push({ id: 41, name: 'Task 41' });

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            archs: {
                'tasks,false,list': '<tree><field name="name"/></tree>',
                'tasks,false,search': '<search><field name="name"/></search>',
            },
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [41], "should write on the selected id");
                    assert.deepEqual(args.args[1], { start: "2018-12-09 23:00:00", stop: "2018-12-10 22:59:59" },
                        "should write the correct start/stop taking timezone into account");
                }
                return this._super.apply(this, arguments);
            },
            session: {
                getTZOffset: function () {
                    return 60;
                },
            },
        });

        // click on the plan button
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_cell_plan'), "mouseup");

        testUtils.dom.click($('.modal .o_list_view tbody tr:eq(0) input'));
        testUtils.dom.click($('.modal .o_select_button:contains(Select)'));

        gantt.destroy();
    });

    QUnit.test('open a dialog to plan a task (multi-level)', function (assert) {
        assert.expect(2);

        this.data.tasks.records.push({ id: 41, name: 'Task 41' });

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            archs: {
                'tasks,false,list': '<tree><field name="name"/></tree>',
                'tasks,false,search': '<search><field name="name"/></search>',
            },
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'project_id', 'stage'],
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [41], "should write on the selected id");
                    assert.deepEqual(args.args[1], {
                        project_id: 1,
                        stage: "todo",
                        start: "2018-12-10 00:00:00",
                        stop: "2018-12-10 23:59:59",
                        user_id: 1,
                    }, "should write on all the correct fields");
                }
                return this._super.apply(this, arguments);
            },
        });

        // click on the plan button
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_row:not(.o_gantt_row_group):first .o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_cell_plan'), "mouseup");

        testUtils.dom.click($('.modal .o_list_view tbody tr:eq(0) input'));
        testUtils.dom.click($('.modal .o_select_button:contains(Select)'));

        gantt.destroy();
    });

    QUnit.test('expand/collapse rows', function (assert) {
        assert.expect(8);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            groupBy: ['user_id', 'project_id', 'stage'],
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.containsN(gantt, '.o_gantt_row_group.open', 6,
            "there should be 6 opened grouped (2 for the users + 2 projects by users = 6)");
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 0,
            "all groups should be opened");

        // collapse all groups
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_collapse_rows'));
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 2,
            "there should be 2 closed groups");
        assert.containsN(gantt, '.o_gantt_row_group.open', 0,
            "all groups should now be closed");

        // expand all groups
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_expand_rows'));
        assert.containsN(gantt, '.o_gantt_row_group.open', 6,
            "there should be 6 opened grouped");
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 0,
            "all groups should be opened again");

        // collapse the first group
        testUtils.dom.click(gantt.$('.o_gantt_row_group:first .o_gantt_row_sidebar'));
        assert.containsN(gantt, '.o_gantt_row_group.open', 3,
            "there should be three open groups");
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 1,
            "there should be 1 closed group");

        gantt.destroy();
    });

    QUnit.test('collapsed rows remain collapsed at reload', function (assert) {
        assert.expect(6);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            groupBy: ['user_id', 'project_id', 'stage'],
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.containsN(gantt, '.o_gantt_row_group.open', 6,
            "there should be 6 opened grouped (2 for the users + 2 projects by users = 6)");
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 0,
            "all groups should be opened");

        // collapse the first group
        testUtils.dom.click(gantt.$('.o_gantt_row_group:first .o_gantt_row_sidebar'));
        assert.containsN(gantt, '.o_gantt_row_group.open', 3,
            "there should be three open groups");
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 1,
            "there should be 1 closed group");

        // reload
        gantt.reload({});

        assert.containsN(gantt, '.o_gantt_row_group.open', 3,
            "there should be three open groups");
        assert.containsN(gantt, '.o_gantt_row_group:not(.open)', 1,
            "there should be 1 closed group");

        gantt.destroy();
    });

    QUnit.test('resize a pill', function (assert) {
        assert.expect(13);

        var nbWrite = 0;
        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 1]],
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [1]);
                    // initial dates -- start: '2018-11-30 18:30:00', stop: '2018-12-31 18:29:59'
                    if (nbWrite === 0) {
                        assert.deepEqual(args.args[1], { stop: "2018-12-30 18:29:59" });
                    } else {
                        assert.deepEqual(args.args[1], { start: "2018-11-29 18:30:00" });
                    }
                    nbWrite++;
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.containsOnce(gantt, '.o_gantt_pill',
            "there should be one pill (Task 1)");
        assert.containsNone(gantt, '.o_gantt_pill.ui-resizable',
            "the pill should not be resizable after initial rendering");

        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill'), 'mouseenter');

        assert.containsOnce(gantt, '.o_gantt_pill.ui-resizable',
            "the pill should be resizable after mouse enter");

        assert.containsNone(gantt, '.ui-resizable-w',
            "there should be no left resizer for task 1 (it starts before december)");
        assert.containsOnce(gantt, '.ui-resizable-e',
            "there should be one right resizer for task 1");

        // resize to one cell smaller (-1 day)
        var cellWidth = gantt.$('.o_gantt_cell:first').width();
        testUtils.dom.dragAndDrop(
            gantt.$('.ui-resizable-e'),
            gantt.$('.ui-resizable-e'),
            { position: { left: -cellWidth, top: 0 } }
        );

        // go to previous month (november)
        testUtils.dom.click(gantt.$buttons.find('.o_gantt_button_prev'));
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill'), 'mouseenter');

        assert.containsOnce(gantt, '.o_gantt_pill',
            "there should still be one pill (Task 1)");
        assert.containsNone(gantt, '.ui-resizable-e',
            "there should be no right resizer for task 1 (it stops after november)");
        assert.containsOnce(gantt, '.ui-resizable-w',
            "there should be one left resizer for task 1");

        // resize to one cell smaller (-1 day)
        testUtils.dom.dragAndDrop(
            gantt.$('.ui-resizable-w'),
            gantt.$('.ui-resizable-w'),
            { position: { left: -cellWidth, top: 0 } }
        );

        assert.strictEqual(nbWrite, 2);

        gantt.destroy();
    });

    QUnit.test('pill is updated after failed resized', function (assert) {
        assert.expect(3);

        var nbRead = 0;
        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 7]],
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.strictEqual(true, true, "should perform a write");
                    return $.Deferred().reject();
                }
                if (route === '/web/dataset/search_read') {
                    nbRead++;
                }
                return this._super.apply(this, arguments);
            },
        });

        var pillWidth = gantt.$('.o_gantt_pill').width();
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill'), 'mouseenter');

        // resize to one cell larger (1 day)
        var cellWidth = gantt.$('.o_gantt_cell:first').width();
        testUtils.dom.dragAndDrop(
            gantt.$('.ui-resizable-e'),
            gantt.$('.ui-resizable-e'),
            { position: { left: cellWidth, top: 0 } }
        );

        assert.strictEqual(nbRead, 2);

        assert.strictEqual(pillWidth, gantt.$('.o_gantt_pill').width(),
            "the pill should have the same width as before the resize");

        gantt.destroy();
    });

    QUnit.test('move a pill in the same row', function (assert) {
        assert.expect(5);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 7]],
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [7],
                        "should write on the correct record");
                    assert.deepEqual(args.args[1], {
                        start: "2018-12-21 06:30:12",
                        stop: "2018-12-21 18:29:59",
                    }, "both start and stop date should be correctly set (+1 day)");
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.containsOnce(gantt, '.o_gantt_pill',
            "there should be one pill (Task 1)");
        assert.doesNotHaveClass(gantt.$('.o_gantt_pill'), 'ui-draggable',
            "the pill should not be draggable after initial rendering");

        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill'), 'mouseenter');

        assert.hasClass(gantt.$('.o_gantt_pill'), 'ui-draggable',
            "the pill should be draggable after mouse enter");

        // move a pill in the next cell (+1 day)
        var cellWidth = gantt.$('.o_gantt_cell:first').width();
        testUtils.dom.dragAndDrop(
            gantt.$('.o_gantt_pill'),
            gantt.$('.o_gantt_pill'),
            { position: { left: cellWidth, top: 0 } },
        );

        gantt.destroy();
    });

    QUnit.test('move a pill in the same row (with timezone)', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 7]],
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [7],
                        "should write on the correct record");
                    assert.deepEqual(args.args[1], {
                        start: "2018-12-21 06:30:12",
                        stop: "2018-12-21 18:29:59",
                    }, "both start and stop date should be correctly set (+1 day)");
                }
                return this._super.apply(this, arguments);
            },
            session: {
                getTZOffset: function () {
                    return 60;
                },
            },
        });

        // move a pill in the next cell (+1 day)
        var cellWidth = gantt.$('.o_gantt_cell:first').width();
        testUtils.dom.dragAndDrop(
            gantt.$('.o_gantt_pill'),
            gantt.$('.o_gantt_pill'),
            { position: { left: cellWidth, top: 0 } },
        );

        gantt.destroy();
    });

    QUnit.test('move a pill in another row', function (assert) {
        assert.expect(4);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            groupBy: ['project_id'],
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [7],
                        "should write on the correct record");
                    assert.deepEqual(args.args[1], {
                        project_id: 1,
                        start: "2018-12-21 06:30:12",
                        stop: "2018-12-21 18:29:59",
                    }, "all modified fields should be correctly set");
                }
                return this._super.apply(this, arguments);
            },
            domain: [['id', 'in', [1, 7]]],
        });

        assert.containsN(gantt, '.o_gantt_pill', 2,
            "there should be two pills (task 1 and task 7)");
        assert.containsN(gantt, '.o_gantt_row', 2,
            "there should be two rows (project 1 and project 2");

        // move a pill (task 7) in the other row and in the the next cell (+1 day)
        var cellWidth = gantt.$('.o_gantt_cell:first').width();
        var cellHeight = gantt.$('.o_gantt_cell:first').height();
        testUtils.dom.dragAndDrop(
            gantt.$('.o_gantt_pill[data-id=7]'),
            gantt.$('.o_gantt_pill[data-id=7]'),
            { position: { left: cellWidth, top: -cellHeight } },
        );

        gantt.destroy();
    });

    QUnit.test('move a pill in another row in multi-level grouped', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            groupBy: ['user_id', 'project_id', 'stage'],
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [7],
                        "should write on the correct record");
                    assert.deepEqual(args.args[1], {
                        user_id: 2,
                    }, "we should only write on user_id");
                }
                return this._super.apply(this, arguments);
            },
            domain: [['id', 'in', [3, 7]]],
        });

        gantt.$('.o_gantt_pill').each(function () {
            testUtils.dom.triggerMouseEvent($(this), 'mouseenter');
        });

        assert.containsN(gantt, '.o_gantt_pill.ui-draggable', 1,
            "there should be only one draggable pill (Task 7)");

        // move a pill (task 7) in the top-level group (User 2)
        var cellHeight = gantt.$('.o_gantt_cell:first').height();
        testUtils.dom.dragAndDrop(
            gantt.$('.o_gantt_pill.ui-draggable'),
            gantt.$('.o_gantt_pill.ui-draggable'),
            { position: { left: 0, top: -4 * cellHeight } },
        );

        gantt.destroy();
    });

    QUnit.test('grey pills should not be resizable nor draggable', function (assert) {
        assert.expect(4);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" color="color" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'project_id'],
            domain: [['id', '=', 7]],
        });


        gantt.$('.o_gantt_pill').each(function () {
            testUtils.dom.triggerMouseEvent($(this), 'mouseenter');
        });

        assert.doesNotHaveClass(gantt.$('.o_gantt_row_group .o_gantt_pill'), 'ui-resizable',
            'the group row pill should not be resizable');
        assert.doesNotHaveClass(gantt.$('.o_gantt_row_group .o_gantt_pill'), 'ui-draggable',
            'the group row pill should not be draggable');
        assert.hasClass(gantt.$('.o_gantt_row:not(.o_gantt_row_group) .o_gantt_pill'), 'ui-resizable',
            'the pill should be resizable');
        assert.hasClass(gantt.$('.o_gantt_row:not(.o_gantt_row_group) .o_gantt_pill'), 'ui-draggable',
            'the pill should be draggable');

        gantt.destroy();
    });

    // ATTRIBUTES TESTS

    QUnit.test('create attribute', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" create="false" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        // the "Add" should not appear
        assert.containsNone(gantt.$buttons.find('.o_gantt_button_add'),
        "there should be no 'Add' button");

        testUtils.dom.click(gantt.$('.o_gantt_cell:first'));

        assert.strictEqual($('.modal').length, 0,
            "there should be no opened modal");

        gantt.destroy();
    });

    QUnit.test('edit attribute', function (assert) {
        assert.expect(4);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" edit="false" />',
            viewOptions: {
                initialDate: initialDate,
            },
            archs: {
                'tasks,false,form': '<form>' +
                        '<field name="name"/>' +
                    '</form>',
            },
        });

        assert.containsNone(gantt, '.o_gantt_pill.ui-resizable',
            "the pills should not be resizable");

        assert.containsNone(gantt, '.o_gantt_pill.ui-draggable',
            "the pills should not be draggable");

        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill:first'), 'mouseup');

        assert.strictEqual($('.modal').length, 1,
            "there should be a opened modal");
        assert.strictEqual($('.modal .o_form_view.o_form_readonly').length, 1,
            "the form view should be in readonly");

        gantt.destroy();
    });

    QUnit.test('total_row attribute', function (assert) {
        assert.expect(6);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" total_row="1" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row',
            'should have 1 row');
        assert.containsOnce(gantt, '.o_gantt_total_row_container .o_gantt_row_total',
            'should have 1 total row');
        assert.containsNone(gantt, '.o_gantt_row_container .o_gantt_row_sidebar',
            'container should not have a sidebar');
        assert.containsNone(gantt, '.o_gantt_total_row_container .o_gantt_row_sidebar',
            'total container should not have a sidebar');
        assert.containsN(gantt, '.o_gantt_row_total .o_gantt_pill ', 7,
            'should have a 7 pills in the total row');
        assert.strictEqual(gantt.$('.o_gantt_row_total .o_gantt_pill').text().replace(/\s+/g, ''), "2123212",
            "the total row should be correctly computed");

        gantt.destroy();
    });

    QUnit.test('scale attribute', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" default_scale="day" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.hasClass(gantt.$buttons.find('.o_gantt_button_scale[data-value=day]'), 'active',
            'day view should be activated');
        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '20 December 2018',
            'should contain "20 December 2018" in header');
        assert.containsN(gantt, '.o_gantt_header_container .o_gantt_header_scale .o_gantt_header_cell', 24,
            'should have a 24 slots for day view');

        gantt.destroy();
    });

    QUnit.test('precision attribute', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" precision=\'{"day": "hour:quarter", "week": "day:half", "month": "day", "year": "month:quarter"}\' default_scale="day" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 7]],
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[1], { stop: "2018-12-20 18:44:59" });
                }
                return this._super.apply(this, arguments);
            },
        });

        var cellWidth = gantt.$('.o_gantt_cell:first').width();
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill'), 'mouseenter');

        // resize of a quarter
        testUtils.dom.dragAndDrop(
            gantt.$('.ui-resizable-e'),
            gantt.$('.ui-resizable-e'),
            { disableDrop: true, position: { left: cellWidth / 4, top: 0 } }
        );

        assert.strictEqual(gantt.$('.o_gantt_pill_resize_badge').text().trim(), "+15 minutes",
            "the resize should be by 15min step");

        // manually trigger the drop to trigger a write
        var toOffset = gantt.$('.ui-resizable-e').offset();
        gantt.$('.ui-resizable-e').trigger($.Event("mouseup", {
            which: 1,
            pageX: toOffset.left + cellWidth / 4,
            pageY: toOffset.top
        }));

        assert.containsNone(gantt, '.o_gantt_pill_resize_badge',
            "the badge should disappear after drop");

        gantt.destroy();
    });

        QUnit.test('progress attribute', function (assert) {
            assert.expect(7);

            var gantt = createView({
                View: GanttView,
                model: 'tasks',
                data: this.data,
                arch: '<gantt string="Tasks" date_start="start" date_stop="stop" progress="progress" />',
                viewOptions: {
                    initialDate: initialDate,
                },
                groupBy: ['project_id'],
            });

            assert.containsN(gantt, '.o_gantt_row_container .o_gantt_pill.o_gantt_progress', 6,
                'should have 6 rows with o_gantt_progress class');

            assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_pill.o_gantt_progress:contains("Task 1")').css('background-size'), '0%',
                'first pill should have 0% progress');
            assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_pill.o_gantt_progress:contains("Task 2")').css('background-size'), '30%',
                'second pill should have 30% progress');
            assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_pill.o_gantt_progress:contains("Task 3")').css('background-size'), '60%',
                'third pill should have 60% progress');
            assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_pill.o_gantt_progress:contains("Task 4")').css('background-size'), '0%',
                'fourth pill should have 0% progress');
            assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_pill.o_gantt_progress:contains("Task 5")').css('background-size'), '100%',
                'fifth pill should have 100% progress');
            assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_pill.o_gantt_progress:contains("Task 7")').css('background-size'), '80%',
                'seventh task should have 80% progress');

            gantt.destroy();
        });

    QUnit.test('decoration attribute', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" decoration-info="stage == \'todo\'">' +
                    '<field name="stage"/>' +
                '</gantt>',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.hasClass(gantt.$('.o_gantt_pill[data-id=1]'), 'decoration-info',
            'should have a "decoration-info" class on task 1');
        assert.doesNotHaveClass(gantt.$('.o_gantt_pill[data-id=2]'), 'decoration-info',
            'should not have a "decoration-info" class on task 2');

        gantt.destroy();
    });

    QUnit.test('consolidation feature', function (assert) {
        assert.expect(25);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt string="Tasks" date_start="start" date_stop="stop" consolidation="progress" consolidation_max=\'{"user_id": 100}\' consolidation_exclude="exclude" progress="progress"/>',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'project_id', 'stage'],
        });

        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row', 18,
            'should have a 18 rows');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row_group.open', 12,
            'should have a 12 opened groups as consolidation implies collapse_first_level');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row:not(.o_gantt_row_group)', 6,
            'should have a 6 rows');
        assert.containsOnce(gantt, '.o_gantt_row_container .o_gantt_row:first .o_gantt_row_sidebar',
            'should have a sidebar');

        // Check grouped rows
        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:first'), 'o_gantt_row_group',
            '1st row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:first .o_gantt_row_title').text().trim(), 'User 1',
            '1st row title should be "User 1"');

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_row:nth(9)'), 'o_gantt_row_group',
            '7th row should be a group');
        assert.strictEqual(gantt.$('.o_gantt_row_container .o_gantt_row:nth(9) .o_gantt_row_title').text().trim(), 'User 2',
            '7th row title should be "User 2"');

        // Consolidation
        // 0 over the size of Task 5 (Task 5 is 100 but is excluded !) then 0 over the rest of Task 1, cut by Task 4 which has progress 0
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill').text().replace(/\s+/g, ''), "0000",
            "the consolidation should be correctly computed");

        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(0)').css('background-color'), "rgb(0, 160, 74)",
            "the 1st group pill should have the correct color)");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(1)').css('background-color'), "rgb(0, 160, 74)",
            "the 2nd group pill should have the correct color)");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill:eq(2)').css('background-color'), "rgb(0, 160, 74)",
            "the 3rd group pill should have the correct color");

        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(0)')), "300%",
            "the 1st group pill should have the correct width (1 to 3 dec)");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(1)')), "1600%",
            "the 2nd group pill should have the correct width (4 to 19 dec)");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(2)')), "50%",
            "the 3rd group pill should have the correct width (20 morning dec");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_pill_wrapper:eq(3)')), "1150%",
            "the 4th group pill should have the correct width (20 afternoon to 31 dec");

        // 30 over Task 2 until Task 7 then 110 (Task 2 (30) + Task 7 (80)) then 30 again until end of task 2 then 60 over Task 3
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill').text().replace(/\s+/g, ''), "301103060",
            "the consolidation should be correctly computed");

        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill:eq(0)').css('background-color'), "rgb(0, 160, 74)",
            "the 1st group pill should have the correct color)");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill:eq(1)').css('background-color'), "rgb(220, 105, 101)",
            "the 2nd group pill should have the correct color)");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill:eq(2)').css('background-color'), "rgb(0, 160, 74)",
            "the 3rd group pill should have the correct color");
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill:eq(3)').css('background-color'), "rgb(0, 160, 74)",
            "the 4th group pill should have the correct color");

        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill_wrapper:eq(0)')), "300%",
            "the 1st group pill should have the correct width (17 afternoon to 20 dec morning)");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill_wrapper:eq(1)')), "50%",
            "the 2nd group pill should have the correct width (20 dec afternoon)");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill_wrapper:eq(2)')), "150%",
            "the 3rd group pill should have the correct width (21 to 22 dec morning dec");
        assert.strictEqual(getPillItemWidth(gantt.$('.o_gantt_row_group:eq(6) .o_gantt_pill_wrapper:eq(3)')), "450%",
            "the 4th group pill should have the correct width (27 afternoon to 31 dec");

        gantt.destroy();
    });

    QUnit.test('color attribute', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" color="color" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.hasClass(gantt.$('.o_gantt_pill[data-id=1]'), 'o_gantt_color_0',
            'should have a color_0 class on task 1');
        assert.hasClass(gantt.$('.o_gantt_pill[data-id=2]'), 'o_gantt_color_2',
            'should have a color_0 class on task 2');

        gantt.destroy();
    });

    QUnit.test('color attribute in multi-level grouped', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" color="color" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'project_id'],
            domain: [['id', '=', 1]],
        });

        assert.doesNotHaveClass(gantt.$('.o_gantt_row_group .o_gantt_pill'), 'o_gantt_color_0',
            "the group row pill should not be colored");
        assert.hasClass(gantt.$('.o_gantt_row:not(.o_gantt_row_group) .o_gantt_pill'), 'o_gantt_color_0',
            'the pill should be colored');

        gantt.destroy();
    });

    QUnit.test('color attribute on a many2one', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" color="project_id" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.hasClass(gantt.$('.o_gantt_pill[data-id=1]'), 'o_gantt_color_1',
            'should have a color_1 class on task 1');
        assert.containsN(gantt, '.o_gantt_pill.o_gantt_color_1', 4,
            "there should be 4 pills with color 1");
        assert.containsN(gantt, '.o_gantt_pill.o_gantt_color_2', 2,
            "there should be 2 pills with color 2");

        gantt.destroy();
    });

    QUnit.test('display_unavailability attribute', function (assert) {
        assert.expect(3);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" display_unavailability="1" />',
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route, args) {
                if (args.method === 'gantt_unavailability') {
                    assert.strictEqual(args.model, 'tasks',
                        "the availability should be fetched on the correct model");
                    var result = {};
                    for (var i = 0; i < 31; i++) {
                        if ((i + 1) % 7 === 6 || (i + 1) % 7 === 0) {
                            // week-ends are unavailable
                            result[i] = 1;
                        } else {
                            // not mandatory
                            // result[i] = 0;
                        }
                    }
                    return $.when(result);
                }
                return this._super.apply(this, arguments);
            },
        });

        assert.hasClass(gantt.$('.o_gantt_row_container .o_gantt_cell[data-date="2018-12-06 00:00:00"]'), 'o_gantt_unavailable',
            "the 6th should be unavailable");
        assert.containsN(gantt, '.o_gantt_cell.o_gantt_unavailable', 8,
            "the week-ends should be unavailable");

        gantt.destroy();
    });

    QUnit.test('offset attribute', function (assert) {
        assert.expect(1);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" offset="-4" default_scale="day"/>',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.strictEqual(gantt.$('.o_gantt_header_container > .col > .row:first-child .o_gantt_header_cell').text().trim(), '16 December 2018',
            'gantt view should be set to 4 days before initial date');

        gantt.destroy();
    });

    QUnit.test('default_group_by attribute', function (assert) {
        assert.expect(2);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" default_group_by="user_id" />',
            viewOptions: {
                initialDate: initialDate,
            },
        });

        assert.containsN(gantt, '.o_gantt_row', 2,
            "there should be 2 rows");
        assert.strictEqual(gantt.$('.o_gantt_row:last .o_gantt_row_title').text().trim(), 'User 2',
            'should be grouped by user');

        gantt.destroy();
    });

    QUnit.test('collapse_first_level attribute with single-level grouped', function (assert) {
        assert.expect(13);

        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt string="Tasks" date_start="start" date_stop="stop" collapse_first_level="1" />',
            archs: {
                'tasks,false,form': '<form>' +
                    '<field name="name"/>' +
                    '<field name="start"/>' +
                    '<field name="stop"/>' +
                    '<field name="project_id"/>' +
                    '</form>',
            },
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['project_id'],
        });

        assert.containsOnce(gantt, '.o_gantt_header_container',
            'should have a header');
        assert.ok(gantt.$buttons.find('.o_gantt_button_expand_rows').is(':visible'),
            "the expand button should be visible");
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row', 4,
            'should have a 4 rows');
        assert.containsN(gantt, '.o_gantt_row_container .o_gantt_row.o_gantt_row_group', 2,
            'should have 2 group rows');
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(0) .o_gantt_row_title').text().trim(), 'Project 1',
            'should contain "Project 1" in sidebar title');
        assert.containsN(gantt, '.o_gantt_row:eq(1) .o_gantt_pill', 4,
            'should have a 4 pills in first row');
        assert.strictEqual(gantt.$('.o_gantt_row_group:eq(1) .o_gantt_row_title').text().trim(), 'Project 2',
            'should contain "Project 2" in sidebar title');
        assert.containsN(gantt, '.o_gantt_row:eq(3) .o_gantt_pill', 2,
            'should have a 2 pills in second row');


        // open dialog to create a task
        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_row:nth(3) .o_gantt_cell[data-date="2018-12-10 00:00:00"] .o_gantt_cell_add'), "mouseup");

        assert.strictEqual($('.modal').length, 1, 'There should be one modal opened');
        assert.strictEqual($('.modal .modal-title').text(), "Create");
        assert.strictEqual($('.modal .o_field_widget[name=project_id] .o_input').val(), 'Project 2',
            'project_id should be set');
        assert.strictEqual($('.modal .o_field_widget[name=start] .o_input').val(), '12/10/2018 00:00:00',
            'start should be set');
        assert.strictEqual($('.modal .o_field_widget[name = stop] .o_input').val(), '12/10/2018 23:59:59',
            'stop should be set');


        gantt.destroy();
    });

    // CONCURRENCY TESTS
    QUnit.test('concurrent scale switches return in inverse order', function (assert) {
        assert.expect(11);

        testUtils.patch(GanttRenderer, {
            _render: function () {
                assert.step('render');
                return this._super.apply(this, arguments);
            },
        });

        var firstReloadProm = null;
        var reloadProm = firstReloadProm;
        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            mockRPC: function (route) {
                var result = this._super.apply(this, arguments);
                if (route === '/web/dataset/search_read') {
                    return $.when(reloadProm).then(_.constant(result));
                }
                return result;
            },
        });

        assert.strictEqual(gantt.$('.o_gantt_header_cell:first').text().trim(), 'December 2018',
            "should be in 'month' scale");
        assert.strictEqual(gantt.model.get().records.length, 6,
            "should have 6 records in the state");

        // switch to 'week' scale (this rpc will be delayed)
        firstReloadProm = $.Deferred();
        reloadProm = firstReloadProm;
        testUtils.dom.click(gantt.$('.o_gantt_button_scale[data-value=week]'));

        assert.strictEqual(gantt.$('.o_gantt_header_cell:first').text().trim(), 'December 2018',
            "should still be in 'month' scale");
        assert.strictEqual(gantt.model.get().records.length, 6,
            "should still have 6 records in the state");

        // switch to 'year' scale
        reloadProm = null;
        testUtils.dom.click(gantt.$('.o_gantt_button_scale[data-value=year]'));

        assert.strictEqual(gantt.$('.o_gantt_header_cell:first').text().trim(), '2018',
            "should be in 'year' scale");
        assert.strictEqual(gantt.model.get().records.length, 7,
            "should have 7 records in the state");

        firstReloadProm.resolve();

        assert.strictEqual(gantt.$('.o_gantt_header_cell:first').text().trim(), '2018',
            "should still be in 'year' scale");
        assert.strictEqual(gantt.model.get().records.length, 7,
            "should still have 7 records in the state");

        assert.verifySteps(['render', 'render']); // should only re-render once

        gantt.destroy();
        testUtils.unpatch(GanttRenderer);
    });

    QUnit.test('concurrent pill resizes return in inverse order', function (assert) {
        assert.expect(7);

        testUtils.patch(GanttRenderer, {
            _render: function () {
                assert.step('render');
                return this._super.apply(this, arguments);
            },
        });

        var writeProm = $.Deferred();
        var firstWriteProm = writeProm;
        var gantt = createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            domain: [['id', '=', 2]],
            mockRPC: function (route, args) {
                var result = this._super.apply(this, arguments);
                assert.step(args.method || route);
                if (args.method === 'write') {
                    return $.when(writeProm).then(_.constant(result));
                }
                return result;
            },
        });

        var cellWidth = gantt.$('.o_gantt_cell:first').width();

        testUtils.dom.triggerMouseEvent(gantt.$('.o_gantt_pill'), 'mouseenter');

        // resize to 1 cell smaller (-1 day) ; this RPC will be delayed
        testUtils.dom.dragAndDrop(
            gantt.$('.ui-resizable-e'),
            gantt.$('.ui-resizable-e'),
            { position: { left: -cellWidth, top: 0 } }
        );

        // resize to two cells larger (+2 days)
        writeProm = null;
        testUtils.dom.dragAndDrop(
            gantt.$('.ui-resizable-e'),
            gantt.$('.ui-resizable-e'),
            { position: { left: 2 * cellWidth, top: 0 } }
        );

        firstWriteProm.resolve();

        assert.verifySteps([
            '/web/dataset/search_read',
            'render',
            'write',
            'write',
            '/web/dataset/search_read', // should only reload once
            'render', // should only re-render once
        ]);

        gantt.destroy();
        testUtils.unpatch(GanttRenderer);
    });

    // OTHER TESTS

    QUnit.skip('[for manual testing] scripting time of large amount of records (ungrouped)', function (assert) {
        assert.expect(1);

        this.data.tasks.records = [];
        for (var i = 1; i <= 1000; i++) {
            this.data.tasks.records.push({
                id: i,
                name: 'Task ' + i,
                start: '2018-12-01 00:00:00',
                stop: '2018-12-02 00:00:00',
            });
        }

        createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            debug: 1,
        });
    });

    QUnit.skip('[for manual testing] scripting time of large amount of records (one level grouped)', function (assert) {
        assert.expect(1);

        this.data.tasks.records = [];
        this.data.users.records = [];

        var i;
        for (i = 1; i <= 100; i++) {
            this.data.users.records.push({
                id: i,
                name: i,
            });
        }

        for (i = 1; i <= 10000; i++) {
            var day1 = (i % 30) + 1;
            var day2 = ((i % 30) + 2);
            if (day1 < 10) {
                day1 = '0' + day1;
            }
            if (day2 < 10) {
                day2 = '0' + day2;
            }
            this.data.tasks.records.push({
                id: i,
                name: 'Task ' + i,
                user_id: Math.floor(Math.random() * Math.floor(100)) + 1,
                start: '2018-12-' + day1,
                stop: '2018-12-' + day2,
            });
        }

        createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id'],
            debug: 1,
        });
    });

    QUnit.skip('[for manual testing] scripting time of large amount of records (two level grouped)', function (assert) {
        assert.expect(1);

        this.data.tasks.records = [];
        this.data.users.records = [];
        var stages = this.data.tasks.fields.stage.selection;

        var i;
        for (i = 1; i <= 100; i++) {
            this.data.users.records.push({
                id: i,
                name: i,
            });
        }

        for (i = 1; i <= 10000; i++) {
            this.data.tasks.records.push({
                id: i,
                name: 'Task ' + i,
                stage: stages[i % 2][0],
                user_id: (i % 100) + 1,
                start: '2018-12-01 00:00:00',
                stop: '2018-12-02 00:00:00',
            });
        }

        createView({
            View: GanttView,
            model: 'tasks',
            data: this.data,
            arch: '<gantt date_start="start" date_stop="stop" />',
            viewOptions: {
                initialDate: initialDate,
            },
            groupBy: ['user_id', 'stage'],
            debug: 1,
        });
    });
});
});
