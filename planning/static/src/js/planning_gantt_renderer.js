odoo.define('planning.PlanningGanttRenderer', function (require) {
'use strict';

    var GanttRenderer = require('web_gantt.GanttRenderer');

    var PlanningGanttRenderer = GanttRenderer.extend({
        sampleDataTargets: [
            '.o_gantt_row:not([data-group-id=empty])',
        ],
        async _renderView() {
            await this._super(...arguments);
            this.el.classList.add('o_planning_gantt');
        }
    });

    return PlanningGanttRenderer;
});
