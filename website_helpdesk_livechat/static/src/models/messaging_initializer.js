/** @odoo-module **/

import { patchRecordMethods } from '@mail/model/model_core';
import { insert } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/messaging_initializer';

patchRecordMethods('MessagingInitializer', {
    /**
     * @override
     */
    _initCommands() {
        this._super();
        this.messaging.update({
            commands: insert([
                {
                    help: this.env._t("Create a new helpdesk ticket"),
                    methodName: 'execute_command_helpdesk',
                    name: "helpdesk",
                },
                {
                    help: this.env._t("Search for a helpdesk ticket"),
                    methodName: 'execute_command_helpdesk_search',
                    name: "helpdesk_search",
                },
            ]),
        });
    },
});
