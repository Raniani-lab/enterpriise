/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';

registerModel({
    name: 'SignRequestView',
    identifyingFields: ['activityViewOwner'],
    recordMethods: {
        async onClickRequestSign() {
            this.env.bus.trigger('do-action', {
                action: {
                    name: this.env._t("Signature Request"),
                    type: 'ir.actions.act_window',
                    view_mode: 'form',
                    views: [[false, 'form']],
                    target: 'new',
                    res_model: 'sign.send.request',
                },
                options: {
                    additional_context: {
                        'sign_directly_without_mail': false,
                        'default_activity_id': this.activityViewOwner.activity.id,
                    },
                    on_close: () => {
                        this.activityViewOwner.activity.update();
                        this.component.trigger('reload');
                    },
                },
            });
        },
    },
    fields: {
        activityViewOwner: one('ActivityView', {
            inverse: 'signRequestView',
            readonly: true,
            required: true,
        }),
        component: attr(),
    },
});
