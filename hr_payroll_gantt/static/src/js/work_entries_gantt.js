odoo.define('hr_payroll_gantt.work_entries_gantt', function(require) {
    'use strict';

    var core = require('web.core');
    var WorkEntryControllerMixin = require('hr_payroll.WorkEntryControllerMixin');
    var GanttView = require('web_gantt.GanttView');
    var GanttController = require('web_gantt.GanttController');
    var viewRegistry = require('web.view_registry');


    var WorkEntryGanttController = GanttController.extend(WorkEntryControllerMixin, {
        events: _.extend({}, GanttController.prototype.events, {
            'click .btn-work-entry-generate': '_onGenerateWorkEntries',
            'click .btn-work-entry-validate': '_onValidateWorkEntries',
            'click .btn-payslip-generate': '_onGeneratePayslips',
        }),

        _fetchRecords: function () {
            return this.model.ganttData.records;
        },
        _fetchFirstDay: function () {
            return this.model.ganttData.startDate;
        },
        _fetchLastDay: function () {
            return this.model.ganttData.stopDate;
        },

        /*
            Event handlers
        */

        _onGenerateWorkEntries: function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._generateWorkEntries();
        },
        _onGeneratePayslips: function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._generatePayslips();
        },
        _onValidateWorkEntries: function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._validateWorkEntries();
        },
    });

    var WorkEntryGanttView = GanttView.extend({
        config: _.extend({}, GanttView.prototype.config, {
            Controller: WorkEntryGanttController,
        }),
    });

    viewRegistry.add('work_entries_gantt', WorkEntryGanttView);

});
