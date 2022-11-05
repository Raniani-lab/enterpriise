/** @odoo-module **/

import { attr, insert, registerPatch } from '@mail/model';

registerPatch({
    name: 'MessagingInitializer',
    recordMethods: {
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
    },
    fields: {
        helpdesk_livechat_active: attr(),
    },
});
