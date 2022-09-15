/** @odoo-module **/

import { addFields } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity_view';

addFields('ActivityView', {
    signRequestView: one('SignRequestView', {
        compute() {
            if (this.activity.category === 'sign_request') {
                return {};
            }
            return clear();
        },
        inverse: 'activityViewOwner',
    }),
});
