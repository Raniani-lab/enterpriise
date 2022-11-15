/* @odoo-module */

import { Messaging } from "@mail/core/messaging_service";

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { patch } from "web.utils";

patch(Messaging.prototype, "website_helpdesk_livechat", {
    initMessagingCallback(data) {
        this._super(data);
        if ("helpdesk_livechat_active" in data) {
            this.store.helpdesk_livechat_active = data.helpdesk_livechat_active;
        }
        if (this.store.helpdesk_livechat_active) {
            registry
                .category("mail.channel_commands")
                .add(
                    "helpdesk",
                    {
                        help: _t("Create a new helpdesk ticket"),
                        methodName: "execute_command_helpdesk",
                    },
                    { force: true }
                )
                .add(
                    "helpdesk_search",
                    {
                        force: true,
                        help: _t("Search for a helpdesk ticket"),
                        methodName: "execute_command_helpdesk_search",
                    },
                    { force: true }
                );
        } else {
            registry.category("mail.channel_commands").remove("helpdesk");
            registry.category("mail.channel_commands").remove("helpdesk_search");
        }
    },
});
