/** @odoo-module */

import CalendarRenderer from 'web.CalendarRenderer';
import PlanningCalendarPopover from './planning_calendar_popover.js';
import session from 'web.session';

const PlanningCalendarRenderer = CalendarRenderer.extend({
    template: "Planning.CalendarView.extend",

    /**
     * @override
     */
    async willStart() {
        await this._super.apply(this, arguments);
        // Check the planning manager group
        this.is_manager = await session.user_has_group('planning.group_planning_manager');
    },

    config: Object.assign({}, CalendarRenderer.prototype.config, {
        CalendarPopover: PlanningCalendarPopover,
    }),
});

export default PlanningCalendarRenderer;
