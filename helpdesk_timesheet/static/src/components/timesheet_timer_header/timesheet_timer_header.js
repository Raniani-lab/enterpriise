/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { TimesheetTimerHeader } from '@timesheet_grid/components/timesheet_timer_header/timesheet_timer_header';
import { useService } from "@web/core/utils/hooks";

patch(TimesheetTimerHeader.prototype, {
    setup() {
        super.setup();
        this.helpdeskTimerService = useService("helpdesk_timer_header");
    },

    /**
     * @override
     */
    async onWillStart() {
        super.onWillStart(...arguments);
        if (this.props.timerRunning && this.helpdeskTimerService.helpdeskProjects == undefined) {
            // Means helpdesk projects has not been fetched yet
            await this.helpdeskTimerService.fetchHelpdeskProjects();
        }
        this._setHasHelpdeskProject();
    },

    /**
     * @override
     */
    async onWillUpdateProps(nextProps) {
        await super.onWillUpdateProps(...arguments);
        if (nextProps.timerRunning && !nextProps.timesheet?.data?.task_id) {
            if (this.helpdeskTimerService.helpdeskProjects == undefined) {
                // Means helpdesk projects has not been fetched yet
                await this.helpdeskTimerService.fetchHelpdeskProjects();
            }
            this._setHasHelpdeskProject(nextProps);
        }
    },

    /**
     * Set the hasHelpdeskProject according to the project set on the timesheet used for the timer
     *
     * If the selected project is linked to the helpdesk, the task field will be hidden and the ticket field will be displayed.
     *
     * @private
     * @param props {Object} props of the component to use.
     */
    _setHasHelpdeskProject(props = this.props) {
        const project = props.timesheet?.data?.project_id;
        this.hasHelpdeskProject = Boolean(project) && this.helpdeskTimerService.helpdeskProjects?.includes(project[0]);
    },
});
