/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, 'documents/models/share', {
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    async _performRPC(route, args) {
        if (args.model === 'documents.share' && args.method === 'check_access_rights') {
            return true;
        }
        return this._super(...arguments);
    },
});
