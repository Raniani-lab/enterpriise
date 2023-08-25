/** @odoo-module */

import { Store } from "@mail/core/common/store_service";

import { patch } from "@web/core/utils/patch";

let gEnv;
patch(Store.prototype, {
    hasDocumentsUserGroup: false,
    Document: {
        /** @type {Object.<number, import("@documents/core/document_model").Document>} */
        records: {},
        /**
         * @param {Object} data
         * @returns {import("@documents/core/document_model").Document}
         */
        insert: (data) => gEnv.services["document.document"].insert(data),
    },
    setup(env) {
        super.setup(env);
        gEnv = env;
    },
});
