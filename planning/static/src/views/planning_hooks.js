/** @odoo-module **/

import { markup, useEnv } from "@odoo/owl";
import { serializeDateTime } from "@web/core/l10n/dates";
import { useService } from "@web/core/utils/hooks";
import { escape } from "@web/core/utils/strings";

/**
 * @param {Object} params
 * @param {() => any} params.getAdditionalContext
 * @param {() => any} params.getDomain
 * @param {() => any} params.getRecords
 * @param {() => any} params.getResModel
 * @param {() => luxon.DateTime} params.getStartDate
 * @param {() => Promise<any>} params.reload
 */
export function usePlanningActions({
    getAdditionalContext,
    getDomain,
    getRecords,
    getResModel,
    getStartDate,
    reload,
}) {
    const actionService = useService("action");
    const env = useEnv();
    const notifications = useService("notification");
    const orm = useService("orm");
    return {
        async copyPrevious() {
            const resModel = getResModel();
            const startDate = serializeDateTime(getStartDate());
            const domain = getDomain();
            const result = await orm.call(resModel, "action_copy_previous_week", [
                startDate,
                domain,
            ]);
            if (result) {
                const message = env._t(
                    "The shifts from the previous week have successfully been copied."
                );
                notifications.add(
                    markup(
                        `<i class="fa fa-fw fa-check"></i><span class="ms-1">${escape(
                            message
                        )}</span>`
                    ),
                    { type: "success" }
                );
                return reload();
            } else {
                notifications.add(
                    env._t(
                        "There are no shifts planned for the previous week, or they have already been copied."
                    ),
                    { type: "danger" }
                );
            }
        },
        async publish() {
            const records = getRecords();
            if (!records?.length) {
                return notifications.add(
                    env._t(
                        "The shifts have already been published, or there are no shifts to publish."
                    ),
                    { type: "danger" }
                );
            }
            return actionService.doAction("planning.planning_send_action", {
                additionalContext: getAdditionalContext(),
                onClose: reload,
            });
        },
    };
}
