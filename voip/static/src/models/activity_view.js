/** @odoo-module **/

import { addRecordMethods } from "@mail/model/model_core";
// ensure that the model definition is loaded before the patch
import "@mail/models/activity_view";

addRecordMethods("ActivityView", {
    /**
     * @private
     * @param {MouseEvent} ev
     */
    onClickLandlineNumber(ev) {
        ev.preventDefault();
        this.env.services.voip.call({
            number: this.activity.phone,
            activityId: this.activity.id,
            fromActivity: true,
        })
    },
    /**
     * @param {MouseEvent} ev
     */
    onClickMobileNumber(ev) {
        if (!this.exists() || !this.component) {
            return;
        }
        ev.preventDefault();
        this.env.services.voip.call({
            number: this.activity.mobile,
            activityId: this.activity.id,
            fromActivity: true,
        })
    },
});
