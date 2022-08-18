/** @odoo-module **/

import { addFields, addRecordMethods } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity_view';

addRecordMethods('ActivityView', {
    /**
     * @private
     * @returns {FieldCommand}
     */
    _computeApprovalView() {
        if (this.activity.approval) {
            return {};
        }
        return clear();
    },
});

addFields('ActivityView', {
    approvalView: one('ApprovalView', {
        compute: '_computeApprovalView',
        inverse: 'activityViewOwner',
        isCausal: true,
    }),
});
