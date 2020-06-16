odoo.define('forecast_timesheet.ForecastTimesheetGanttView', function (require) {
    'use strict';

const PlanningGanttView = require('forecast.ForecastGanttView');
const GanttRenderer = require('planning.PlanningGanttRenderer');
const viewRegistry = require('web.view_registry');
const GanttRow = require('web_gantt.GanttRow');


const PlanningGanttRow = GanttRow.extend({
    template: 'PlanningTimesheetGanttView.Row',
});

const ForecastGanttRenderer = GanttRenderer.extend({
    /*
     Override the renderer to use custom ForecastGanttRow
    */
    _renderRow: function (pillsInfo, params) {
        const ganttRow = new PlanningGanttRow(this, pillsInfo, this.viewInfo, params);
        this.rowWidgets[ganttRow.rowId] = ganttRow;
        this.proms.push(ganttRow._widgetRenderAndInsert(function () {}));
        // here find slots with pills and task_id
        if (ganttRow.pills) {
            // there are slots.
            ganttRow.pills.forEach((pill) => {
                if (pill.task_id && pill.allocated_hours) {
                    // the slot have a task_id, we need to display the cell as a progress bar
                    pill.progress = Math.round(pill.effective_hours / pill.allocated_hours * 100);
                } else {
                   pill.progress = 0;
                }
            });
        }
        return ganttRow;
    },
});

const ForecastTimesheetGanttView = PlanningGanttView.extend({
    config: _.extend({}, PlanningGanttView.prototype.config, {
        Renderer: ForecastGanttRenderer,
    }),
});

viewRegistry.add('forecast_timesheet', ForecastTimesheetGanttView);
return ForecastTimesheetGanttView;
});
