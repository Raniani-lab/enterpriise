odoo.define('planning.PlanningGanttRenderer', function (require) {
'use strict';

    var GanttRenderer = require('web_gantt.GanttRenderer');

    var PlanningGanttRenderer = GanttRenderer.extend({
        _render: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function() {
                self.$el.addClass('o_planning_gantt');
            });
        }
    });

    return PlanningGanttRenderer;
});
