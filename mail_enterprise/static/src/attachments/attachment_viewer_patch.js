/* @odoo-module */

import { AttachmentViewer } from "@mail/attachments/attachment_viewer";

import { patch } from "@web/core/utils/patch";

import { useBackButton } from "web_mobile.hooks";

patch(AttachmentViewer.prototype, "mail_enterprise", {
    setup() {
        this._super();
        useBackButton(() => this.close());
    },
});
