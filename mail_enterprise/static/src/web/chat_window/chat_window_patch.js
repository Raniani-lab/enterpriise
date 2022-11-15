/* @odoo-module */

import { ChatWindow } from "@mail/web/chat_window/chat_window";

import { patch } from "@web/core/utils/patch";

import { useBackButton } from "web_mobile.hooks";

patch(ChatWindow.prototype, "mail_enterprise", {
    setup() {
        this._super();
        useBackButton(() => this.chatWindowService.close(this.props.chatWindow));
    },
});
