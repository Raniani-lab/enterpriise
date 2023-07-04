/** @odoo-module */

import { ActivityService } from "@mail/core/web/activity_service";

import { patch } from "@web/core/utils/patch";

patch(ActivityService.prototype, {
    insert(data) {
        const activity = super.insert(...arguments);
        if ("approver_id" in data && "approver_status" in data) {
            if (!data.approver_id) {
                delete activity.approval;
            } else {
                activity.approval = { id: data.approver_id, status: data.approver_status };
            }
        }
        return activity;
    },
});
