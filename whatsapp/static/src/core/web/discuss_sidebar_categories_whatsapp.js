/* @odoo-module */

import { discussSidebarCategoriesRegistry } from "@mail/discuss/core/web/discuss_sidebar_categories";

discussSidebarCategoriesRegistry.add(
    "whatsapp",
    {
        predicate: (store) =>
            store.discuss.whatsapp.threads.some((localId) => store.Thread.records[localId]?.is_pinned),
        value: (store) => store.discuss.whatsapp,
    },
    { sequence: 20 }
);
