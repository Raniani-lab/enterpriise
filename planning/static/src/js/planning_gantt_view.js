odoo.define('planning.PlanningGanttView', function (require) {
'use strict';

var GanttView = require('web_gantt.GanttView');
var PlanningGanttController = require('planning.PlanningGanttController');
var PlanningGanttModel = require('planning.PlanningGanttModel');
var PlanningGanttRenderer = require('planning.PlanningGanttRenderer');

var view_registry = require('web.view_registry');

var PlanningGanttView = GanttView.extend({
    config: _.extend({}, GanttView.prototype.config, {
        Renderer: PlanningGanttRenderer,
        Controller: PlanningGanttController,
        Model: PlanningGanttModel,
    }),
});

view_registry.add('planning_gantt', PlanningGanttView);

return PlanningGanttView;

});
