/* @odoo-module */

import { AttachmentViewer } from "@web/core/attachment_viewer/attachment_viewer";

import { patch } from "@web/core/utils/patch";

import { useBackButton } from "web_mobile.hooks";

patch(AttachmentViewer.prototype, "mail_enterprise", {
    setup() {
        this._super();
        useBackButton(() => this.close());
    },
});
