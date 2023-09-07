/** @odoo-module */

import { Store } from "@mail/core/common/store_service";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

patch(Store.prototype, {
    setup(env) {
        super.setup(env);
        this.discuss.whatsapp = {
            extraClass: "o-mail-DiscussSidebarCategory-whatsapp",
            id: "whatsapp",
            name: _t("WhatsApp"),
            isOpen: false,
            canView: false,
            canAdd: true,
            serverStateKey: "is_discuss_sidebar_category_whatsapp_open",
            threads: [], // list of ids
        };
    },
});
