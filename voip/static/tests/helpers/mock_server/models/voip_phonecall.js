/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    async _performRPC(route, args) {
        if (args.model === "voip.phonecall" && args.method === "get_missed_call_info") {
            return [0, false];
        }
        return super._performRPC(route, args);
    },
});
