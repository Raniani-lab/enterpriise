/** @odoo-module **/

import GanttController from 'web_gantt.GanttController';


const TaskGanttController = GanttController.extend({
    custom_events: Object.assign(
        { },
        GanttController.prototype.custom_events,
        {
            display_milestone_popover: '_onDisplayMilestonePopover',
        }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {OdooEvent} ev
     * @private
     */
    _onDisplayMilestonePopover: function (ev) {
        ev.stopPropagation();
        Object.assign(
            ev.data.popoverData,
            {
                display_project_name: !!this.context.search_default_my_tasks,
            });
        this.renderer.display_milestone_popover(ev.data.popoverData, ev.data.targetElement);
    },
});

export default TaskGanttController;
