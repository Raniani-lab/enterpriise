/* @odoo-module */

import { AttachmentService } from "@mail/core/common/attachment_service";
import { patch } from "@web/core/utils/patch";
import { assignDefined } from "@mail/utils/common/misc";

patch(AttachmentService.prototype, {

    update(attachment, data) {
        super.update(attachment, data);
        assignDefined(attachment, data, [
            "documentId",
        ]);
    },

});
