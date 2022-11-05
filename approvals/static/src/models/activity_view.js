/** @odoo-module **/

import { clear, one, Patch } from '@mail/model';

Patch({
    name: 'ActivityView',
    fields: {
        approvalView: one('ApprovalView', {
            compute() {
                if (this.activity.approval) {
                    return {};
                }
                return clear();
            },
            inverse: 'activityViewOwner',
        }),
    },
});
