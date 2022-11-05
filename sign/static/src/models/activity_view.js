/** @odoo-module **/

import { clear, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'ActivityView',
    fields: {
        signRequestView: one('SignRequestView', {
            compute() {
                if (this.activity.category === 'sign_request') {
                    return {};
                }
                return clear();
            },
            inverse: 'activityViewOwner',
        }),
    },
});
