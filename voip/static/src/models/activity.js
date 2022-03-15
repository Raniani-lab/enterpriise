/** @odoo-module **/

import { addFields, addLifecycleHooks, addRecordMethods, patchModelMethods } from '@mail/model/model_core';
import { attr } from '@mail/model/model_field';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity';

patchModelMethods('Activity', {
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
});

addFields('Activity', {
    /**
     * String to store the mobile number in a call activity.
     */
    mobile: attr(),
    /**
     * String to store the phone number in a call activity.
     */
    phone: attr(),
});

addLifecycleHooks('Activity', {
    _created() {
        this.env.bus.on('voip_reload_chatter', undefined, this._onReloadChatter);
    },
    _willDelete() {
        this.env.bus.off('voip_reload_chatter', undefined, this._onReloadChatter);
    },
});

addRecordMethods('Activity', {
    /**
     * @private
     */
    _onReloadChatter() {
        if (!this.thread) {
            return;
        }
        this.thread.fetchData(['activities', 'attachments', 'messages']);
    },
});
