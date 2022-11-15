/** @odoo-module */

import { Activity } from "@mail/web/activity/activity";
import { patch } from "@web/core/utils/patch";

patch(Activity.prototype, "sign", {
    async onClickRequestSign() {
        await this.env.services["mail.activity"].requestSignature(
            this.props.data.id,
            this.props.onUpdate
        );
    },
});
