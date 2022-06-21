/** @odoo-module **/

import { patchRecordMethods } from "@mail/model/model_core";
import "@mail/models/messaging_initializer"; // ensure the model definition is loaded before the patch

patchRecordMethods("MessagingInitializer", {
    /**
     * @override
     */
    async _init({ voipConfig }) {
        await this._super(...arguments);
        this.messaging.voip.update(voipConfig);
    },
});
