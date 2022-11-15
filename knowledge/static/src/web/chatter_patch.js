/** @odoo-module **/

import { Chatter } from "@mail/web/chatter";

import core from "web.core";
import { patch } from "@web/core/utils/patch";

patch(Chatter.prototype, "knowledge", {
    async onClickChatterSearchArticle() {
        if (this.isTemporary) {
            const saved = await this.doSaveRecord();
            if (!saved) {
                return;
            }
        }
        core.bus.trigger("openMainPalette", { searchValue: "?" });
    },
});
