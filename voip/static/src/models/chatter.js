/** @odoo-module **/

import { registerPatch } from "@mail/model/model_core";

registerPatch({
    name: "Chatter",
    lifecycleHooks: {
        _created() {
            this.env.bus.addEventListener("voip_reload_chatter", this._onReload);
        },
        _willDelete() {
            this.env.bus.removeEventListener("voip_reload_chatter", this._onReload);
        },
    },
    recordMethods: {
        _onReload() {
            if (!this.thread) {
                return;
            }
            this.thread.fetchData(["activities", "attachments", "messages"]);
        },
    },
});
