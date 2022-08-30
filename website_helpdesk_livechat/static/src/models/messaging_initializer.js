/** @odoo-module **/

import { addFields, patchRecordMethods } from '@mail/model/model_core';
import { insert } from '@mail/model/model_field_command';
import { attr } from '@mail/model/model_field';

// ensure that the model definition is loaded before the patch
import '@mail/models/messaging_initializer';

addFields('MessagingInitializer', {
    helpdesk_livechat_active: attr(),
});

patchRecordMethods('MessagingInitializer', {
    /**
     * @override
     */
    async _init({ helpdesk_livechat_active }) {
        this.update({ helpdesk_livechat_active });
        await this._super(...arguments);
    },

    /**
     * @override
     */
    _initCommands() {
        this._super();
        if (!this.helpdesk_livechat_active) return;
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
