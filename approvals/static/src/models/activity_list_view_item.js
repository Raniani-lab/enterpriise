/** @odoo-module **/

import { clear, one, Patch } from '@mail/model';

Patch({
    name: 'ActivityListViewItem',
    fields: {
        approvalView: one('ApprovalView', {
            compute() {
                if (this.activity.approval) {
                    return {};
                }
                return clear();
            },
            inverse: 'activityListViewItemOwner',
        }),
        hasEditButton: {
            compute() {
                if (this.approvalView) {
                    return false;
                }
                return this._super();
            }
        },
        hasMarkDoneButton: {
            compute() {
                if (this.approvalView) {
                    return false;
                }
                return this._super();
            },
        },
    }
});
