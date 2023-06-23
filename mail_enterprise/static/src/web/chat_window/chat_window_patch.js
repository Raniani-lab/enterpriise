/* @odoo-module */

import { ChatWindow } from "@mail/core/common/chat_window";

import { patch } from "@web/core/utils/patch";

import { useBackButton } from "@web_mobile/js/core/hooks";

patch(ChatWindow.prototype, "mail_enterprise", {
    setup() {
        this._super();
        useBackButton(() => this.chatWindowService.close(this.props.chatWindow));
    },
});
