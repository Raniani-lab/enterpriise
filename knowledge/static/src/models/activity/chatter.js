/** @odoo-module **/

import { Patch } from '@mail/model';
import core from 'web.core';

Patch({
    name: 'Chatter',
    recordMethods: {
        onClickChatterSearchArticle(event) {
            core.bus.trigger("openMainPalette", {
                searchValue: "?",
            });
        },
    },
});
