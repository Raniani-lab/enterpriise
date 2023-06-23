/* @odoo-module */

import { MessagingMenu } from "@mail/core/web/messaging_menu";

import { patch } from "@web/core/utils/patch";

import { useBackButton } from "@web_mobile/js/core/hooks";

patch(MessagingMenu.prototype, "mail_enterprise", {
    setup() {
        this._super();
        useBackButton(
            () => this.close(),
            () => this.state.isOpen
        );
    },
});
