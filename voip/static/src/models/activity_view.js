/** @odoo-module **/

import { Patch } from "@mail/model";

Patch({
    name: "ActivityView",
    recordMethods: {
        /**
         * @param {MouseEvent} ev
         */
        onClickLandlineNumber(ev) {
            ev.preventDefault();
            this.env.services.voip.call({
                number: this.activity.phone,
                activityId: this.activity.id,
                fromActivity: true,
            });
        },
        /**
         * @param {MouseEvent} ev
         */
        onClickMobileNumber(ev) {
            if (!this.exists()) {
                return;
            }
            ev.preventDefault();
            this.env.services.voip.call({
                number: this.activity.mobile,
                activityId: this.activity.id,
                fromActivity: true,
            });
        },
    },
});
