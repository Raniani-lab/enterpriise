/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, 'documents/controllers/main', {
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    async _performRPC(route, args) {
        if (route.indexOf('/documents/image') >= 0 || _.contains(['.png', '.jpg'], route.substr(route.length - 4))) {
            return Promise.resolve();
        }
        return this._super(...arguments);
    },
});
