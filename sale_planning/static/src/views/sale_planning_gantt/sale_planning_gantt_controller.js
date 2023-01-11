/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PlanningGanttController } from "@planning/views/planning_gantt/planning_gantt_controller";
import { useSalePlanningActions } from "@sale_planning/views/hooks";

patch(PlanningGanttController.prototype, "sale_planning_gantt_controller", {
    setup() {
        this._super();
        const { onClickPlanOrders } = useSalePlanningActions({
            getResModel: () => this.model.metaData.resModel,
            getDomain: () => this.model.getDomain(),
            getViewContext: () => {
                const viewContext = { ...this.props.context };
                this.model.addSpecialKeys(viewContext);
                return viewContext;
            },
            getScale: () => this.model.metaData.scale.id,
            getFocusDate: () => this.model.metaData.focusDate,
            reload: () => this.model.fetchData(),
        });
        this.onClickPlanOrders = onClickPlanOrders;
    },
});
