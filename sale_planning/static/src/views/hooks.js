/** @odoo-module **/

import { useEnv } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { serializeDateTime } from "@web/core/l10n/dates";

export function useSalePlanningActions({ getDomain, getResModel, getViewContext, getScale, getFocusDate, reload }) {
    const env = useEnv();
    const actionService = useService("action");
    const orm = useService("orm");
    const notification = useService("notification");
    return {
        onClickPlanOrders: async () => {
            const result = await orm.call(
                getResModel(),
                "action_plan_sale_order",
                [getDomain()],
                {
                    context: getViewContext(),
                },
            );
            if (!result.length) {
                notification.add(
                    env._t("There are no sales orders to assign or no employees are available."),
                    {
                        type: "danger",
                    },
                );
            } else {
                const scale = getScale();
                const viewType = env.config.viewType;
                notification.add(
                    env._t("The sales orders have successfully been assigned."),
                    {
                        type: "success",
                        buttons: [{
                            name: env._t("View Shifts"),
                            icon: "oi oi-arrow-right",
                            onClick: () => {
                                actionService.doAction("sale_planning.planning_action_orders_planned", {
                                    viewType,
                                    additionalContext: {
                                        active_ids: result,
                                        default_scale: scale,
                                        default_mode: scale,
                                        initial_date: serializeDateTime(getFocusDate()),
                                        initialDate: serializeDateTime(getFocusDate()),
                                    },
                                });
                            },
                        }],
                    },
                );
            }
            reload();
        },
    }
}
