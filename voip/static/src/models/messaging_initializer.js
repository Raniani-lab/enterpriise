/** @odoo-module **/

import { registerPatch } from "@mail/model";

registerPatch({
    name: "MessagingInitializer",
    recordMethods: {
        /**
         * @override
         */
        async _init({ voipConfig }) {
            await this._super(...arguments);
            this.messaging.voip.update(voipConfig);
        },
    },
});
