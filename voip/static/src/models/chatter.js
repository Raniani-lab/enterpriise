/** @odoo-module **/

import { addLifecycleHooks, addRecordMethods, patchLifecycleHooks } from "@mail/model/model_core";
// ensure that the model definition is loaded before the patch
import "@mail/models/chatter";

addLifecycleHooks("Chatter", {
    _created() {
        this.env.bus.on("voip_reload_chatter", undefined, this._onReload);
    },
});

patchLifecycleHooks("Chatter", {
    _willDelete() {
        this.env.bus.off("voip_reload_chatter", undefined, this._onReload);
        this._super();
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
