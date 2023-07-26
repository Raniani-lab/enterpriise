/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, "voip/models/voip_phonecall", {
    async _performRPC(route, args) {
        if (args.model === "voip.phonecall" && args.method === "get_missed_call_info") {
            return [0, false];
        }
        return this._super(route, args);
    },
});
