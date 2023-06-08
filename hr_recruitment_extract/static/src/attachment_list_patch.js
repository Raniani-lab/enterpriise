/* @odoo-module */

import { AttachmentList } from "@mail/core/common/attachment_list";
import { patch } from "@web/core/utils/patch";

AttachmentList.props.push("reloadChatterParentView?");

patch(AttachmentList.prototype, "hr_recruitment_extract", {
    onConfirmUnlink(attachment) {
        this._super(attachment);
        if (attachment.originThread?.model === "hr.applicant") {
            this.props.reloadChatterParentView();
        }
    },
});
