/** @odoo-module **/

import { addLifecycleHooks, addRecordMethods } from "@mail/model/model_core";
// ensure that the model definition is loaded before the patch
import "@mail/models/chatter";

addLifecycleHooks("Chatter", {
    _created() {
        this.env.bus.on("voip_reload_chatter", undefined, this._onReload);
    },
    _willDelete() {
        this.env.bus.off("voip_reload_chatter", undefined, this._onReload);
    },
});

addRecordMethods("Chatter", {
    _onReload() {
        if (!this.thread) {
            return;
        }
        this.thread.fetchData(["activities", "attachments", "messages"]);
    },
});
