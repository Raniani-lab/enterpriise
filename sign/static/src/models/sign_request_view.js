/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';

registerModel({
    name: 'SignRequestView',
    template: 'sign.SignRequestView',
    recordMethods: {
        async onClickRequestSign() {
            const activity = this.activityViewOwner.activity;
            const chatter = this.activityViewOwner.chatterOwner;
            await this.activityViewOwner.activity.requestSignature();
            if (activity.exists()) {
                activity.update();
            }
            if (chatter.exists()) {
                chatter.reloadParentView();
            }
        },
    },
    fields: {
        activityViewOwner: one('ActivityView', {
            identifying: true,
            inverse: 'signRequestView',
        }),
    },
});
