/** @odoo-module */

import { Message } from "@mail/core/common/message_model";
import { patch } from "@web/core/utils/patch";

patch(Message.prototype, {
    get editable() {
        if (this.originThread?.type === "whatsapp") {
            return false;
        }
        return super.editable;
    },
});
