/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { SuggestionService } from "@mail/core/common/suggestion_service";

patch(SuggestionService.prototype, "website_helpdesk_livechat", {
    getSupportedDelimiters(thread) {
        return thread?.model === "helpdesk.ticket"
            ? [...this._super(...arguments), [":"]]
            : this._super(...arguments);
    },
});
