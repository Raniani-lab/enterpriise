odoo.define('mrp.MRPWorkorderGanttRenderer', function (require) {
    'use strict';

    const GanttRenderer = require('web_gantt.GanttRenderer');
    const MRPWorkorderGanttRow = require('mrp.MRPWorkorderGanttRow');

    const MRPWorkorderGanttRenderer = GanttRenderer.extend({
        config: Object.assign({}, GanttRenderer.prototype.config, {
            GanttRow: MRPWorkorderGanttRow
        }),
    });

    return MRPWorkorderGanttRenderer;
});
