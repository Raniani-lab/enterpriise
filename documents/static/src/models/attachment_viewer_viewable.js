/** @odoo-module **/

import { addFields, patchIdentifyingFields, patchRecordMethods } from "@mail/model/model_core";
import { one } from "@mail/model/model_field";
import "@mail/models/attachment_viewer_viewable";


patchIdentifyingFields("AttachmentViewerViewable", (identifyingFields) => {
    identifyingFields[0].push("documentOwner");
});

addFields("AttachmentViewerViewable", {
    documentOwner: one("Document", {
        readonly: true,
    }),
});

patchRecordMethods("AttachmentViewerViewable", {
    /**
     * @override
     */
    download() {
        if (this.documentOwner) {
            return;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeAccessToken() {
        if (this.documentOwner) {
            return this.documentOwner.accessToken;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeDefaultSource() {
        if (this.documentOwner) {
            return this.documentOwner.defaultSource;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeDisplayName() {
        if (this.documentOwner) {
            return this.documentOwner.displayName;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeImageUrl() {
        if (this.documentOwner) {
            return this.documentOwner.imageUrl;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeIsImage() {
        if (this.documentOwner) {
            return this.documentOwner.isImage;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeIsPdf() {
        if (this.documentOwner) {
            return this.documentOwner.isPdf;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeIsText() {
        if (this.documentOwner) {
            return this.documentOwner.isText;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeIsUrlYoutube() {
        if (this.documentOwner) {
            return this.documentOwner.isUrlYoutube;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeIsVideo() {
        if (this.documentOwner) {
            return this.documentOwner.isVideo;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeIsViewable() {
        if (this.documentOwner) {
            return this.documentOwner.isViewable;
        }
        return this._super();
    },
    /**
     * @private
     * @override
     */
    _computeMimetype() {
        if (this.documentOwner) {
            return this.documentOwner.mimetype;
        }
        return this._super();
    },
});
