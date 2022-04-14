/** @odoo-module **/

import { addRecordMethods } from "@mail/model/model_core";
// ensure that the model definition is loaded before the patch
import "@mail/models/activity_view";

addRecordMethods("ActivityView", {
    /**
     * @param {MouseEvent} ev
     */
    onClickMobileNumber(ev) {
        if (!this.exists() || !this.component) {
            return;
        }
        ev.preventDefault();
        this.component.trigger("voip_activity_call", {
            activityId: this.activity.id,
            number: this.activity.mobile,
        });
    },
});
