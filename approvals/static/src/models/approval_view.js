/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';

registerModel({
    name: 'ApprovalView',
    recordMethods: {
        async onClickApprove() {
            if (!this.exists()) {
                return;
            }
            const chatter = this.activityViewOwner.activityBoxView.chatter;
            await this.activityViewOwner.activity.approval.approve();
            if (chatter.exists()) {
                chatter.reloadParentView();
            }
        },
        async onClickRefuse() {
            if (!this.exists()) {
                return;
            }
            const chatter = this.activityViewOwner.activityBoxView.chatter;
            await this.activityViewOwner.activity.approval.refuse();
            if (chatter.exists()) {
                chatter.reloadParentView();
            }
        },
    },
    fields: {
        activityViewOwner: one('ActivityView', {
            identifying: true,
            inverse: 'approvalView',
        }),
        component: attr(),
    },
});
