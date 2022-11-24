/** @odoo-module **/

import { onWillStart } from "@odoo/owl";
import { serializeDateTime } from "@web/core/l10n/dates";
import { useService } from "@web/core/utils/hooks";
import { CalendarController } from "@web/views/calendar/calendar_controller";
import { usePlanningControllerActions } from "../planning_hooks";

export class PlanningCalendarController extends CalendarController {
    setup() {
        super.setup(...arguments);
        this.user = useService("user");

        onWillStart(this.onWillStart);

        const getDomain = () => this.model.computeDomain(this.model.data);
        this.planningControllerActions = usePlanningControllerActions({
            getDomain,
            getStartDate: () => this.model.rangeStart,
            getRecords: () => Object.values(this.model.records),
            getResModel: () => this.model.resModel,
            getAdditionalContext: () => ({
                default_start_datetime: serializeDateTime(this.model.rangeStart),
                default_end_datetime: serializeDateTime(this.model.rangeEnd),
                default_slot_ids: Object.values(this.model.records).map(rec => rec.id),
                scale: this.model.scale,
                active_domain: getDomain(),
            }),
            toggleHighlightPlannedFilter: (highlightPlannedIds) => this.env.searchModel.toggleHighlightPlannedFilter(highlightPlannedIds),
            reload: () => this.model.load(),
        });
    }

    async onWillStart() {
        this.isManager = await this.user.hasGroup("planning.group_planning_manager");
    }
};
PlanningCalendarController.template = "planning.PlanningCalendarController";
