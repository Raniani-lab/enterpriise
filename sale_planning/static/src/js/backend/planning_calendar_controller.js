/** @odoo-module **/

import PlanningCalendarController from '@planning/js/calendar/planning_calendar_controller';
import { SalePlanningControllerMixin } from './sale_planning_mixin';

PlanningCalendarController.include(SalePlanningControllerMixin);

PlanningCalendarController.include({
    events: Object.assign({}, PlanningCalendarController.prototype.events, {
        'click .o_button_sale_plan_so': '_onPlanSOClicked',
    }),

    /**
     * @param {Object} context
     * @return {Object} context
     */
    addViewContextValues(context) {
        const state = this.model.get();
        const { startDate, endDate } = this.model.getDates();
        return Object.assign(context, {
            scale: state.scale,
            focus_date: this.model.convertToServerTime(state.target_date),
            start_date: startDate,
            stop_date: endDate,
        });
    },
});
