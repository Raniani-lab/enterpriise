/** @odoo-module */

import { Store } from "@mail/core/common/store_service";

import { patch } from "@web/core/utils/patch";

patch(Store.prototype, {
    hasDocumentsUserGroup: false,
    /** @type {Object.<number, import("@documents/core/document_model").Document>} */
    documents: {},
});
