/** @odoo-module **/

import { ActivityRenderer } from "@mail/views/web/activity/activity_renderer";

import { DocumentsInspector } from "../inspector/documents_inspector";
import { DocumentsFileViewer } from "../helper/documents_file_viewer";

const { useRef } = owl;

export class DocumentsActivityRenderer extends ActivityRenderer {
    static props = {
        ...ActivityRenderer.props,
        inspectedDocuments: Array,
        previewStore: Object,
    };
    static template = "documents.DocumentsActivityRenderer";
    static components = {
        ...ActivityRenderer.components,
        DocumentsFileViewer,
        DocumentsInspector,
    };

    setup() {
        super.setup();
        this.root = useRef("root");
    }

    getDocumentsAttachmentViewerProps() {
        return { previewStore: this.props.previewStore };
    }

    /**
     * Props for documentsInspector
     */
    getDocumentsInspectorProps() {
        return {
            documents: this.props.records.filter((rec) => rec.selected),
            count: 0,
            fileSize: 0,
            archInfo: this.props.archInfo,
        };
    }
}
