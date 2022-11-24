/** @odoo-module */

import { CalendarModel } from "@web/views/calendar/calendar_model";
import { usePlanningModelActions } from "../planning_hooks";

export class PlanningCalendarModel extends CalendarModel {
    setup() {
        super.setup(...arguments);
        this.getHighlightIds = usePlanningModelActions({
            getHighlightPlannedIds: () => this.env.searchModel.highlightPlannedIds,
            getContext: () => this.env.searchModel._context,
        }).getHighlightIds;
    }

    /**
     * @override
     */
    async loadRecords(data) {
        this.highlightIds = await this.getHighlightIds();
        return await super.loadRecords(data);
    }
}
