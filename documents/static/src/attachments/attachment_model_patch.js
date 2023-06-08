/* @odoo-module */

import { Attachment } from "@mail/core/common/attachment_model";
import { patch } from "@web/core/utils/patch";

patch(Attachment.prototype, "documents", {
    documentId: null,

    get urlRoute() {
        if (this.documentId) {
            return this.isImage ? `/web/image/${this.documentId}` : `/web/content/${this.documentId}`;
        }
        return this._super();
    },

    get urlQueryParams() {
        let res = this._super();
        if (this.documentId) {
            res['model'] = 'documents.document';
           return res
        }
        return res;
    },
});
