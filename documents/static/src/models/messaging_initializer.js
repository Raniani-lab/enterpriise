/** @odoo-module **/

import { Patch } from "@mail/model";

Patch({
    name: "MessagingInitializer",
    recordMethods: {
        /**
         * @override
         */
        async _init({ hasDocumentsUserGroup }) {
            this.messaging.update({ hasDocumentsUserGroup });
            await this._super(...arguments);
        },
    },
});
