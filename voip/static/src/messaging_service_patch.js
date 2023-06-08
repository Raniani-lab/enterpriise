/* @odoo-module */

import { Messaging } from "@mail/core/common/messaging_service";

import { patch } from "@web/core/utils/patch";

patch(Messaging.prototype, "Retrieve VoIP data sent by init_messaging", {
    initMessagingCallback({ voipConfig }) {
        this._super(...arguments);
        this.store.voipConfig = voipConfig;
    },
});
