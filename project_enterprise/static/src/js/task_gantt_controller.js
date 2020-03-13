odoo.define('project_enterprise.TaskGanttController', function (require) {
    'use strict';

    var GanttController = require('web_gantt.GanttController');
    var core = require('web.core');
    var QWeb = core.qweb;

    var PlanningGanttController = GanttController.extend({
        /**
         * @override
         * @param {jQuery} [$node] to which the buttons will be appended
         */
        renderButtons: function ($node) {
            var state = this.model.get();
            this.$buttons = $(QWeb.render('TaskGanttView.buttons', {
                groupedBy: state.groupedBy,
                widget: this,
                SCALES: this.SCALES,
                activateScale: state.scale,
                allowedScales: this.allowedScales,
                activeActions: this.activeActions,
            }));
            if ($node) {
                this.$buttons.appendTo($node);
            }
        },
    });

    return PlanningGanttController;

    });