/* @odoo-module */

export class Document {
    id;
    /** @type import("@mail/attachments/attachment_model").Attachment */
    attachment;
    /** @type {string} */
    name;
    /** @type {string} */
    mimetype;
    /** @type {string} */
    url;
    /** @type {string} */
    displayName;
    /** @type {Object} */
    record;
    /** @type {import("@mail/core/store_service").Store} */
    _store;
}
