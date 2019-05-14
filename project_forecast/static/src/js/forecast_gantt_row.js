odoo.define('project_forecast.ForecastGanttRow', function (require) {
    'use strict';

    var GanttRow = require('web_gantt.GanttRow');

    var ForecastGanttRow = GanttRow.extend({
        template: 'ForecastGanttView.Row',
    });

return ForecastGanttRow;

});