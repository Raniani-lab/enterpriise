/** @odoo-module **/

import { attr, Patch } from '@mail/model';

Patch({
    name: 'Activity',
    modelMethods: {
        /**
         * @override
         */
        convertData(data) {
            const data2 = this._super(data);
            if ('mobile' in data) {
                data2.mobile = data.mobile;
            }
            if ('phone' in data) {
                data2.phone = data.phone;
            }
            return data2;
        },
    },
    fields: {
        /**
         * String to store the mobile number in a call activity.
         */
        mobile: attr(),
        /**
         * String to store the phone number in a call activity.
         */
        phone: attr(),
    },
});
