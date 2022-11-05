/** @odoo-module **/

import { Patch } from "@mail/model";

Patch({
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
