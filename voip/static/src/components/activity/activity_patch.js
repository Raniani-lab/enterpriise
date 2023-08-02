/* @odoo-module */

import { Activity } from "@mail/core/web/activity";

import { patch } from "@web/core/utils/patch";

patch(Activity.prototype, {
    /**
     * @param {MouseEvent} ev
     */
    onClickLandlineNumber(ev) {
        ev.preventDefault();
        this.env.services.voip.call({
            number: this.props.data.phone,
            activityId: this.props.data.id,
            fromActivity: true,
        });
    },
    /**
     * @param {MouseEvent} ev
     */
    onClickMobileNumber(ev) {
        ev.preventDefault();
        this.env.services.voip.call({
            number: this.props.data.mobile,
            activityId: this.props.data.id,
            fromActivity: true,
        });
    },
});
