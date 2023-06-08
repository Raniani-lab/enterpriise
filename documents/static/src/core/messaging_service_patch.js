/** @odoo-module */

import { Messaging } from "@mail/core/common/messaging_service";

import { patch } from "@web/core/utils/patch";

patch(Messaging.prototype, "documents", {
    initMessagingCallback(...args) {
        this._super(...args);
        if (args[0].hasDocumentsUserGroup) {
            this.store.hasDocumentsUserGroup = true;
        }
    },
});
