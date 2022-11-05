/** @odoo-module **/

import { clear, one, Patch } from '@mail/model';

Patch({
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
