/* @odoo-module */

import { Document } from "./document_model";
import { registry } from "@web/core/registry";

export class DocumentService {
    documentList;

    constructor(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        /** @type {import("@mail/core/store_service").Store} */
        this.store = services["mail.store"];
        /** @type {import("@mail/attachments/attachment_service").AttachmentService} */
        this.attachmentService = services["mail.attachment"];
    }

    /**
     * @param {Object} data
     * @returns {Document}
     */
    insert(data) {
        let document = this.store.documents[data.id];
        if (!document) {
            document = new Document();
            if ("id" in data) {
                document.id = data.id;
            }
            if ("attachment" in data) {
                document.attachment = this.attachmentService.insert(data.attachment);
            }
            if ("name" in data) {
                document.name = data.name;
            }
            if ("mimetype" in data) {
                document.mimetype = data.mimetype;
            }
            if ("url" in data) {
                document.url = data.url;
            }
            if ("displayName" in data) {
                document.displayName = data.displayName;
            }
            if ("record" in data) {
                document.record = data.record;
            }
            document._store = this.store;
            this.store.documents[data.id] = document;
            // Get reactive version.
            document = this.store.documents[data.id];
        }
        // return reactive version
        return document;
    }
}

export const documentService = {
    dependencies: ["rpc", "mail.store", "mail.attachment"],
    start(env, services) {
        return new DocumentService(env, services);
    },
};

registry.category("services").add("document.document", documentService);