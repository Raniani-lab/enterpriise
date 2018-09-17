odoo.define('web_cohort.cohort_tests', function (require) {
'use strict';

var CohortView = require('web_cohort.CohortView');
var testUtils = require('web.test_utils');

var createView = testUtils.createView;
var createActionManager = testUtils.createActionManager;

QUnit.module('Views', {
    beforeEach: function () {
        this.data = {
            subscription: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    start: {string: 'Start', type: 'date'},
                    stop: {string: 'Stop', type: 'date'},
                    recurring: {string: 'Recurring Price', type: 'integer', store: true},
                },
                records: [
                    {id: 1, start: '2017-07-12', stop: '2017-08-11', recurring: 10},
                    {id: 2, start: '2017-08-14', stop: '', recurring: 20},
                    {id: 3, start: '2017-08-21', stop: '2017-08-29', recurring: 10},
                    {id: 4, start: '2017-08-21', stop: '', recurring: 20},
                    {id: 5, start: '2017-08-23', stop: '', recurring: 10},
                    {id: 6, start: '2017-08-24', stop: '', recurring: 22},
                    {id: 7, start: '2017-08-24', stop: '2017-08-29', recurring: 10},
                    {id: 8, start: '2017-08-24', stop: '', recurring: 22},
                ]
            },
            lead: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    start: {string: 'Start', type: 'date'},
                    stop: {string: 'Stop', type: 'date'},
                    revenue: {string: 'Revenue', type: 'float', store: true},
                },
                records: [
                    {id: 1, start: '2017-07-12', stop: '2017-08-11', revenue: 1200.20},
                    {id: 2, start: '2017-08-14', stop: '', revenue: 500},
                    {id: 3, start: '2017-08-21', stop: '2017-08-29', revenue: 5599.99},
                    {id: 4, start: '2017-08-21', stop: '', revenue: 13500},
                    {id: 5, start: '2017-08-23', stop: '', revenue: 6000},
                    {id: 6, start: '2017-08-24', stop: '', revenue: 1499.99},
                    {id: 7, start: '2017-08-24', stop: '2017-08-29', revenue: 16000},
                    {id: 8, start: '2017-08-24', stop: '', revenue: 22000},
                ]
            },
            attendee: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    event_begin_date: {string: 'Event Start Date', type: 'date'},
                    registration_date: {string: 'Registration Date', type: 'date'},
                },
                records: [
                    {id: 1, event_begin_date: '2018-06-30', registration_date: '2018-06-13'},
                    {id: 2, event_begin_date: '2018-06-30', registration_date: '2018-06-20'},
                    {id: 3, event_begin_date: '2018-06-30', registration_date: '2018-06-22'},
                    {id: 4, event_begin_date: '2018-06-30', registration_date: '2018-06-22'},
                    {id: 5, event_begin_date: '2018-06-30', registration_date: '2018-06-29'},
                ]
            },
        };
    }
}, function () {
    QUnit.module('CohortView');

    QUnit.test('simple cohort rendering', function (assert) {
        assert.expect(7);

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop" />'
        });

        assert.strictEqual(cohort.$('.table').length, 1,
            'should have a table');
        assert.ok(cohort.$('.table thead tr:first th:first:contains(Start)').length,
            'should contain "Start" in header of first column');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Day)').length,
            'should contain "Stop - By Day" in title');
        assert.ok(cohort.$('.table thead tr:nth-child(2) th:first:contains(+0)').length,
            'interval should start with 0');
        assert.ok(cohort.$('.table thead tr:nth-child(2) th:nth-child(16):contains(+15)').length,
            'interval should end with 15');

        assert.strictEqual(cohort.$buttons.find('.o_cohort_measures_list').length, 1,
            'should have list of measures');
        assert.strictEqual(cohort.$buttons.find('.o_cohort_interval_button').length, 4,
            'should have buttons of intervals');

        cohort.destroy();
    });

    QUnit.test('correctly set by default measure and interval', function (assert) {
        assert.expect(4);

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop" />'
        });

        assert.ok(cohort.$buttons.find('.o_cohort_measures_list [data-field=__count__]').hasClass('selected'),
                'count should by default for measure');
        assert.ok(cohort.$buttons.find('.o_cohort_interval_button[data-interval=day]').hasClass('active'),
                'day should by default for interval');

        assert.ok(cohort.$('.table thead tr:first th:nth-child(2):contains(Count)').length,
            'should contain "Count" in header of second column');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Day)').length,
            'should contain "Stop - By Day" in title');

        cohort.destroy();
    });

    QUnit.test('correctly set measure and interval after changed', function (assert) {
        assert.expect(8);

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop" measure="recurring" interval="week" />'
        });

        assert.ok(cohort.$buttons.find('.o_cohort_measures_list [data-field=recurring]').hasClass('selected'),
                'should recurring for measure');
        assert.ok(cohort.$buttons.find('.o_cohort_interval_button[data-interval=week]').hasClass('active'),
                'should week for interval');

        assert.ok(cohort.$('.table thead tr:first th:nth-child(2):contains(Recurring Price)').length,
            'should contain "Recurring Price" in header of second column');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Week)').length,
            'should contain "Stop - By Week" in title');

        cohort.$buttons.find('.o_cohort_measures_list [data-field=__count__]').click();
        assert.ok(cohort.$buttons.find('.o_cohort_measures_list [data-field=__count__]').hasClass('selected'),
                'should active count for measure');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(2):contains(Count)').length,
            'should contain "Count" in header of second column');

        cohort.$buttons.find('.o_cohort_interval_button[data-interval=month]').click();
        assert.ok(cohort.$buttons.find('.o_cohort_interval_button[data-interval=month]').hasClass('active'),
                'should active month for interval');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Month)').length,
            'should contain "Stop - By Month" in title');

        cohort.destroy();
    });

    QUnit.test('when clicked on cell redirects to the correct list/form view ', function(assert) {
        assert.expect(6);

        var actionManager = createActionManager({
            data: this.data,
            archs: {
                'subscription,false,cohort': '<cohort string="Subscriptions" date_start="start" date_stop="stop" measure="__count__" interval="week" />',
                'subscription,my_list_view,list': '<tree>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</tree>',
                'subscription,my_form_view,form': '<form>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</form>',
                'subscription,false,list': '<tree>' +
                        '<field name="recurring"/>' +
                        '<field name="start"/>' +
                    '</tree>',
                'subscription,false,form': '<form>' +
                        '<field name="recurring"/>' +
                        '<field name="start"/>' +
                    '</form>',
                'subscription,false,search': '<search></search>',
            },
            intercepts: {
                do_action: function (ev) {
                    actionManager.doAction(ev.data.action, ev.data.options);
                },
            },
        });

        actionManager.doAction({
            name: 'Subscriptions',
            res_model: 'subscription',
            type: 'ir.actions.act_window',
            views: [[false, 'cohort'], ['my_list_view', 'list'], ['my_form_view', 'form']],
        });

        // Going to the list view, while clicking Period / Count cell
        actionManager.$('td.o_cohort_value:first').click();
        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the list view
        actionManager.$('td div.o_cohort_value:first').click();

        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the form view
        actionManager.$('.o_list_view .o_data_row').click();

        assert.strictEqual(actionManager.$('.o_form_view span:first').attr('name'), 'start',
                "First field in the form view should be start");
        assert.strictEqual(actionManager.$('.o_form_view span:nth(1)').attr('name'), 'stop',
                "Second field in the form view should be stop");

        actionManager.destroy();
    });


    QUnit.test('test mode churn', function(assert) {
        assert.expect(3);

        var cohort = createView({
            View: CohortView,
            model: 'lead',
            data: this.data,
            arch: '<cohort string="Leads" date_start="start" date_stop="stop" interval="week" mode="churn" />',
            mockRPC: function(route, args) {
                assert.strictEqual(args.kwargs.mode, "churn", "churn mode should be sent via RPC");
                return this._super(route, args);
            },
        });

        assert.strictEqual(cohort.$('td .o_cohort_value:first').text().trim(), '0.0%', 'first col should display 0 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(4)').text().trim(), '100.0%', 'col 5 should display 100 percent');

        cohort.destroy();
    });

    QUnit.test('test backward timeline', function (assert) {
        assert.expect(7);

        var cohort = createView({
            View: CohortView,
            model: 'attendee',
            data: this.data,
            arch: '<cohort string="Attendees" date_start="event_begin_date" date_stop="registration_date" interval="day" timeline="backward" mode="churn"/>',
            mockRPC: function (route, args) {
                assert.strictEqual(args.kwargs.timeline, "backward", "backward timeline should be sent via RPC");
                return this._super(route, args);
            },
        });

        assert.ok(cohort.$('.table thead tr:nth-child(2) th:first:contains(-15)').length,
            'interval should start with -15');
        assert.ok(cohort.$('.table thead tr:nth-child(2) th:nth-child(16):contains(0)').length,
            'interval should end with 0');
        assert.strictEqual(cohort.$('td .o_cohort_value:first').text().trim(), '20.0%', 'first col should display 20 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(5)').text().trim(), '40.0%', 'col 6 should display 40 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(7)').text().trim(), '80.0%', 'col 8 should display 80 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(14)').text().trim(), '100.0%', 'col 15 should display 100 percent');

        cohort.destroy();
    });

    QUnit.test('when clicked on cell redirects to the action list/form view passed in context', function(assert) {
        assert.expect(6);

        var actionManager = createActionManager({
            data: this.data,
            archs: {
                'subscription,false,cohort': '<cohort string="Subscriptions" date_start="start" date_stop="stop" measure="__count__" interval="week" />',
                'subscription,my_list_view,list': '<tree>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</tree>',
                'subscription,my_form_view,form': '<form>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</form>',
                'subscription,false,list': '<tree>' +
                    '<field name="recurring"/>' +
                    '<field name="start"/>' +
                    '</tree>',
                'subscription,false,form': '<form>' +
                        '<field name="recurring"/>' +
                        '<field name="start"/>' +
                    '</form>',
                'subscription,false,search': '<search></search>',
            },
            intercepts: {
                do_action: function (ev) {
                    actionManager.doAction(ev.data.action, ev.data.options);
                },
            },
        });

        actionManager.doAction({
            name: 'Subscriptions',
            res_model: 'subscription',
            type: 'ir.actions.act_window',
            views: [[false, 'cohort']],
            context: {list_view_id: 'my_list_view', form_view_id: 'my_form_view'},
        });

        // Going to the list view, while clicking Period / Count cell
        actionManager.$('td.o_cohort_value:first').click();
        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the list view
        actionManager.$('td div.o_cohort_value:first').click();

        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the form view
        actionManager.$('.o_list_view .o_data_row').click();

        assert.strictEqual(actionManager.$('.o_form_view span:first').attr('name'), 'start',
                "First field in the form view should be start");
        assert.strictEqual(actionManager.$('.o_form_view span:nth(1)').attr('name'), 'stop',
                "Second field in the form view should be stop");

        actionManager.destroy();
    });

});
});
