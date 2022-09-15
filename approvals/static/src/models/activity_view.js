/** @odoo-module **/

import { addFields } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity_view';

addFields('ActivityView', {
    approvalView: one('ApprovalView', {
        compute() {
            if (this.activity.approval) {
                return {};
            }
            return clear();
        },
        inverse: 'activityViewOwner',
    }),
});
