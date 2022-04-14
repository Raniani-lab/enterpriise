/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';

registerModel({
    name: 'ApprovalView',
    identifyingFields: ['activityViewOwner'],
    recordMethods: {
        async onClickApprove() {
            if (!this.exists()) {
                return;
            }
            const component = this.component;
            await this.activityViewOwner.activity.approval.approve();
            component.trigger('o-approval-approved');
        },
        async onClickRefuse() {
            if (!this.exists()) {
                return;
            }
            const component = this.component;
            await this.activityViewOwner.activity.approval.refuse();
            component.trigger('o-approval-refused');
        },
    },
    fields: {
        activityViewOwner: one('ActivityView', {
            inverse: 'approvalView',
            readonly: true,
            required: true,
        }),
        component: attr(),
    },
});
