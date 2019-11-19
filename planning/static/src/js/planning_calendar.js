odoo.define('planning.Calendar', function (require) {
"use strict";

    var CalendarPopover = require('web.CalendarPopover');
    var CalendarRenderer = require('web.CalendarRenderer');
    var CalendarModel = require('web.CalendarModel');
    var CalendarView = require('web.CalendarView');
    var view_registry = require('web.view_registry');

    var PlanningCalendarPopover = CalendarPopover.extend({
        /**
         * Hide empty fields from the calendar popover
         * @override
         */
        _processFields: function () {
            var self = this;

            if (!CalendarPopover.prototype.origDisplayFields) {
                CalendarPopover.prototype.origDisplayFields = _.extend({}, this.displayFields);
            } else {
                this.displayFields = _.extend({}, CalendarPopover.prototype.origDisplayFields);
            }

            _.each(this.displayFields, function(def, field) {
                if (!self.event.record[field]) {
                    delete self.displayFields[field];
                } 
            });

            return this._super.apply(this, arguments);
        }
    });

    var PlanningCalendarModel = CalendarModel.extend({
        /**
         * Hide the employee name on the planning slot if there is
         * only one employee filtered on the view
         */
        _loadCalendar: function () {
            var filter = this.data.filters['employee_id'].filters || {};
            const filteredCount = filter.reduce((n, value) => n + value.active, 0);

            this.data.context['planning_calendar_view'] = true;
            this.data.context['planning_hide_employee'] = filteredCount === 1;
            return this._super.apply(this, arguments);
        }
    });

    var PlanningCalendarRenderer = CalendarRenderer.extend({
        config: _.extend({}, CalendarRenderer.prototype.config, {
            CalendarPopover: PlanningCalendarPopover,
        }),
    });

    var PlanningCalendarView = CalendarView.extend({
        config: _.extend({}, CalendarView.prototype.config, {
            Renderer: PlanningCalendarRenderer,
            Model: PlanningCalendarModel,
        }),
    });

    view_registry.add('planning_calendar', PlanningCalendarView);
});
