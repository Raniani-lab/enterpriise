odoo.define('project_forecast.ForecastGanttView', function (require) {
'use strict';

var GanttView = require('web_gantt.GanttView');
var ForecastGanttController = require('project_forecast.ForecastGanttController');
var ForecastGanttRenderer = require('project_forecast.ForecastGanttRenderer');
var view_registry = require('web.view_registry');

var ForecastGanttView = GanttView.extend({
    config: _.extend({}, GanttView.prototype.config, {
        Controller: ForecastGanttController,
        Renderer: ForecastGanttRenderer,
    }),
});

view_registry.add('forecast_gantt', ForecastGanttView);

return ForecastGanttView;

});