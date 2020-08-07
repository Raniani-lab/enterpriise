odoo.define('timesheet_grid.GridView', function (require) {
    "use strict";

    const viewRegistry = require('web.view_registry');
    const WebGridView = require('web_grid.GridView');

    const TimesheetGridModel = require('timesheet_grid.GridModel');
    const TimesheetGridController = require('timesheet_grid.GridController');

    // JS class to avoid grouping by date
    const TimesheetGridView = WebGridView.extend({
        config: Object.assign({}, WebGridView.prototype.config, {
            Model: TimesheetGridModel,
            Controller: TimesheetGridController,
        })
    });

    viewRegistry.add('timesheet_grid', TimesheetGridView);

    return TimesheetGridView;
});
