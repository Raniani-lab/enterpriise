/* @odoo-module */

import { Messaging } from "@mail/core/common/messaging_service";

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { patch } from '@web/legacy/js/core/utils';

patch(Messaging.prototype, "website_helpdesk_livechat", {
    initMessagingCallback(data) {
        this._super(data);
        if ("helpdesk_livechat_active" in data) {
            this.store.helpdesk_livechat_active = data.helpdesk_livechat_active;
        }
        if (this.store.helpdesk_livechat_active) {
            registry
                .category("discuss.channel_commands")
                .add(
                    "ticket",
                    {
                        help: _t("Create a new helpdesk ticket (/ticket ticket title)"),
                        methodName: "execute_command_helpdesk",
                    },
                    { force: true }
                )
                .add(
                    "search_tickets",
                    {
                        force: true,
                        help: _t("Search helpdesk tickets (/search_tickets keyword)"),
                        methodName: "execute_command_helpdesk_search",
                    },
                    { force: true }
                );
        } else {
            registry.category("discuss.channel_commands").remove("ticket");
            registry.category("discuss.channel_commands").remove("search_tickets");
        }
    },
});
