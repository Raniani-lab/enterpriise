/** @odoo-module alias=timesheet_grid.TimesheetM2OTask **/
import fieldRegistry from 'web.field_registry';
import TimesheetM2OWidget from 'timesheet_grid.TimesheetM2OWidget';
import { _t } from 'web.core';
import { sprintf } from "@web/core/utils/strings";

const TimesheetM2OTask = TimesheetM2OWidget.extend({

    /**
     * @constructor
     */
    init: function (parent, value, rowIndex, workingHoursData) {
        this.modelName = 'project.task';
        this.fieldName = 'task_id';

        this._super.apply(this, arguments);
        const uomName = this.cacheUnit ? this.cacheUnit.toLowerCase() : '';
        this.title = sprintf(_t(
            'Difference between the number of %s allocated to the task and the number of %s recorded.'),
            uomName, uomName
        );
    },
});

fieldRegistry.add('timesheets_m2o_task', TimesheetM2OTask);

export default TimesheetM2OTask;
