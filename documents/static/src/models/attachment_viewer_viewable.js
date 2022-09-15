/** @odoo-module **/

import { addFields, patchFields, patchRecordMethods } from "@mail/model/model_core";
import { one } from "@mail/model/model_field";
import "@mail/models/attachment_viewer_viewable";

addFields("AttachmentViewerViewable", {
    documentOwner: one("Document", {
        identifying: true,
    }),
});

patchFields("AttachmentViewerViewable", {
    defaultSource: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.defaultSource;
            }
            return this._super();
        },
    },
    displayName: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.displayName;
            }
            return this._super();
        },
    },
    imageUrl: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.imageUrl;
            }
            return this._super();
        },
    },
    isImage: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.isImage;
            }
            return this._super();
        },
    },
    isPdf: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.isPdf;
            }
            return this._super();
        },
    },
    isText: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.isText;
            }
            return this._super();
        },
    },
    isUrlYoutube: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.isUrlYoutube;
            }
            return this._super();
        },
    },
    isVideo: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.isVideo;
            }
            return this._super();
        },
    },
    isViewable: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.isViewable;
            }
            return this._super();
        },
    },
    mimetype: {
        compute() {
            if (this.documentOwner) {
                return this.documentOwner.mimetype;
            }
            return this._super();
        },
    },
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
});
