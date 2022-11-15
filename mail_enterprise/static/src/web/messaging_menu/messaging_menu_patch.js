/* @odoo-module */

import { MessagingMenu } from "@mail/web/messaging_menu/messaging_menu";

import { patch } from "@web/core/utils/patch";

import { useBackButton } from "web_mobile.hooks";

patch(MessagingMenu.prototype, "mail_enterprise", {
    setup() {
        this._super();
        useBackButton(
            () => this.close(),
            () => this.state.isOpen
        );
    },
});
