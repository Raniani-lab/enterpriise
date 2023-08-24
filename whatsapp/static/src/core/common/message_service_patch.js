/** @odoo-module */

import { MessageService } from "@mail/core/common/message_service";
import { assignDefined } from "@mail/utils/common/misc";
import { patch } from "@web/core/utils/patch";

patch(MessageService.prototype, {
    update(message, data) {
        assignDefined(message, data, ["whatsappStatus"]);
        super.update(message, data);
    },
});
