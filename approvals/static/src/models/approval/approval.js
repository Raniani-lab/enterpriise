/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one2one } from '@mail/model/model_field';

registerModel({
    name: 'approvals.approval',
    identifyingFields: ['id'],
    recordMethods: {
        /**
         * Approves the current `approval.approver`.
         */
        async approve() {
            await this.async(() => this.env.services.rpc({
                model: 'approval.approver',
                method: 'action_approve',
                args: [[this.id]],
            }));
            if (this.activity) {
                this.activity.delete();
            }
            this.delete();
        },
        /**
         * Refuses the current `approval.approver`.
         */
        async refuse() {
            await this.async(() => this.env.services.rpc({
                model: 'approval.approver',
                method: 'action_refuse',
                args: [[this.id]],
            }));
            if (this.activity) {
                this.activity.delete();
            }
            this.delete();
        },
    },
    fields: {
        activity: one2one('Activity', {
            inverse: 'approval',
        }),
        id: attr({
            readonly: true,
            required: true,
        }),
        isCurrentPartnerApprover: attr({
            default: false,
            related: 'activity.isCurrentPartnerAssignee',
        }),
        status: attr(),
    },
});
