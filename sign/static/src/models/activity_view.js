/** @odoo-module **/

import { addFields, addRecordMethods } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear, insertAndReplace } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity_view';

addRecordMethods('ActivityView', {
    /**
     * @private
     * @returns {FieldCommand}
     */
    _computeSignRequestView() {
        if (this.activity.category === 'sign_request') {
            return insertAndReplace();
        }
        return clear();
    },
});

addFields('ActivityView', {
    signRequestView: one('SignRequestView', {
        compute: '_computeSignRequestView',
        inverse: 'activityViewOwner',
        isCausal: true,
    }),
});
