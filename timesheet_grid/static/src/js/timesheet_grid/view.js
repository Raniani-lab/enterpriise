odoo.define('timesheet_grid.GridView', function (require) {
"use strict";

    const { _t } = require('web.core');
    const viewRegistry = require('web.view_registry');

    const WebGridView = require('web_grid.GridView');

    const TimesheetGridModel = require('timesheet_grid.GridModel');
    const TimesheetGridController = require('timesheet_grid.GridController');
    const TimesheetGridRenderer = require('timesheet_grid.GridRenderer');

    const TimesheetGridView = WebGridView.extend({
        config: _.extend({}, WebGridView.prototype.config, {
            Model: TimesheetGridModel,
            Controller: TimesheetGridController,
            Renderer: TimesheetGridRenderer
        })
    });

    viewRegistry.add('timesheet_grid', TimesheetGridView);

    return TimesheetGridView;
});
