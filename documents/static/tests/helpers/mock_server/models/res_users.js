/** @odoo-module **/

import '@mail/../tests/helpers/mock_server/models/res_users'; // ensure mail overrides are applied first
import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, 'documents/models/res_users', {
    /**
     * @override
     * @returns {Object}
     */
    _mockResUsers_InitMessaging(...args) {
        return {
            ...this._super(...args),
            'hasDocumentsUserGroup': true,
        };
    },
});
