/** @odoo-module **/

import { registerPatch } from '@mail/model';
import core from 'web.core';

registerPatch({
    name: 'Chatter',
    recordMethods: {
        onClickChatterSearchArticle(event) {
            core.bus.trigger("openMainPalette", {
                searchValue: "?",
            });
        },
    },
});
