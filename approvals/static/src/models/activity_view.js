/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
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
