/** @odoo-module */

import { ActivityListPopoverItem } from "@mail/core/web/activity_list_popover_item";
import { patch } from "@web/core/utils/patch";

patch(ActivityListPopoverItem.prototype, "sign", {
    get hasMarkDoneButton() {
        return this._super() && this.props.activity.activity_category !== "sign_request";
    },

    async onClickRequestSign() {
        await this.env.services["mail.activity"].requestSignature(
            this.props.activity.id,
            this.props.onActivityChanged
        );
    },
});
