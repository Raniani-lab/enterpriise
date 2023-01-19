/** @odoo-module **/

import { Patch } from '@mail/model';
import core from 'web.core';

Patch({
    name: 'Chatter',
    recordMethods: {
        async onClickChatterSearchArticle(event) {
            if (this.isTemporary) {
                const saved = await this.doSaveRecord();
                if (!saved) {
                    return;
                }
            }
            core.bus.trigger("openMainPalette", {
                searchValue: "?",
            });
        },
    },
});
