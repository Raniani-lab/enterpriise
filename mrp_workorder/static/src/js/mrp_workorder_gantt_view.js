odoo.define('mrp.MRPWorkorderGanttView', function (require) {
    'use strict';

    const view_registry = require('web.view_registry');

    const GanttView = require('web_gantt.GanttView');
    const MRPWorkorderGanttRenderer = require('mrp.MRPWorkorderGanttRenderer');

    const MRPWorkorderGanttView = GanttView.extend({
        config: Object.assign({}, GanttView.prototype.config, {
            Renderer: MRPWorkorderGanttRenderer,
        }),
    });

    view_registry.add('mrp_workorder_gantt', MRPWorkorderGanttView);

    return MRPWorkorderGanttView;
});
