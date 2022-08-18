/** @odoo-module **/

import { registerModel } from "@mail/model/model_core";
import { clear } from "@mail/model/model_field_command";
import { attr, one } from "@mail/model/model_field";

registerModel({
    name: "Document",
    recordMethods: {
        /**
         * @private
         */
        _computeAttachment() {
            if (this.attachmentId) {
                return {
                    id: this.attachmentId,
                    filename: this.name,
                    mimetype: this.mimetype,
                    url: this.url,
                };
            }
            return clear();
        },
        /**
         * Default the attachmentViewerViewable to one linked to an attachment if it exists.
         * @private
         */
        _computeAttachmentViewerViewable() {
            return {
                documentOwner: this,
            };
        },
        /**
         * @private
         * @returns {string}
         */
        _computeImageUrl() {
            return `/web/image/${this.id}?model=documents.document`;
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsViewable() {
            if (this.attachment) {
                return this.attachment.isViewable;
            }
            return this.isText || this.isImage || this.isVideo || this.isPdf || this.isUrlYoutube;
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsImage() {
            if (this.attachment) {
                return this.attachment.isImage;
            }
            const imageMimetypes = new Set([
                "image/bmp",
                "image/gif",
                "image/jpeg",
                "image/png",
                "image/svg+xml",
                "image/tiff",
                "image/x-icon",
            ]);
            return imageMimetypes.has(this.mimetype);
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsPdf() {
            if (this.attachment) {
                return this.attachment.isPdf;
            }
            return this.mimetype === "application/pdf";
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsText() {
            if (this.attachment) {
                return this.attachment.isText;
            }
            const textMimeType = new Set(["application/javascript", "application/json", "text/css", "text/html", "text/plain"]);
            return textMimeType.has(this.mimetype);
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsVideo() {
            if (this.attachment) {
                return this.attachment.isVideo;
            }
            const videoMimeTypes = new Set(["audio/mpeg", "video/x-matroska", "video/mp4", "video/webm"]);
            return videoMimeTypes.has(this.mimetype);
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsUrlYoutube() {
            if (this.attachment) {
                return this.attachment.isUrlYoutube;
            }
            if (!this.url) {
                return false;
            }
            const youtubeUrlMatch = this.url.match(
                "youtu(?:.be|be.com)/(?:.*v(?:/|=)|(?:.*/)?)([a-zA-Z0-9-_]{11})"
            );
            return youtubeUrlMatch.length > 1;
        },
        /**
         * @private
         * @returns {string}
         */
        _computeDefaultSource() {
            if (this.attachment) {
                return this.attachment.defaultSource;
            }
            if (this.isImage) {
                return `/web/image/${this.id}?model=documents.document`;
            }
            if (this.isPdf) {
                const pdf_lib = `/web/static/lib/pdfjs/web/viewer.html?file=`;
                return `${pdf_lib}/web/content/${this.id}?model=documents.document`;
            }
            if (this.isUrlYoutube) {
                const youtubeUrlMatch = this.url.match(
                    "youtu(?:.be|be.com)/(?:.*v(?:/|=)|(?:.*/)?)([a-zA-Z0-9-_]{11})"
                );
                const token = youtubeUrlMatch[1];
                return `https://www.youtube.com/embed/${token}`;
            }
            return `/web/content/${this.id}?model=documents.document`;
        },
    },
    fields: {
        attachment: one("Attachment", {
            compute: "_computeAttachment",
        }),
        attachmentId: attr(),
        attachmentViewerViewable: one("AttachmentViewerViewable", {
            compute: "_computeAttachmentViewerViewable",
            isCausal: true,
        }),
        id: attr({
            identifying: true,
        }),
        defaultSource: attr({
            compute: "_computeDefaultSource",
        }),
        displayName: attr(),
        imageUrl: attr({
            compute: "_computeImageUrl",
        }),
        isImage: attr({
            compute: "_computeIsImage",
        }),
        isPdf: attr({
            compute: "_computeIsPdf",
        }),
        isText: attr({
            compute: "_computeIsText",
        }),
        isUrlYoutube: attr({
            compute: "_computeIsUrlYoutube",
        }),
        isVideo: attr({
            compute: "_computeIsVideo",
        }),
        isViewable: attr({
            compute: "_computeIsViewable",
        }),
        mimetype: attr(),
        name: attr(),
        url: attr(),
    },
});
