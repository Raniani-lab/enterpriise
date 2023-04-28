/** @odoo-module **/

import { ActivityRenderer } from "@mail/views/activity/activity_renderer";

import { DocumentsInspector } from "../inspector/documents_inspector";
import { DocumentsFileViewer } from "../helper/documents_file_viewer";

const { useRef } = owl;

export class DocumentsActivityRenderer extends ActivityRenderer {
    setup() {
        super.setup();
        this.root = useRef("root");
    }
    /**
     * Props for documentsInspector
     */
    getDocumentsInspectorProps() {
        return {
            selection: this.props.records.filter((rec) => rec.selected),
            count: 0,
            fileSize: 0,
            archInfo: this.props.archInfo,
            withFilePreview: !this.env.documentsView.previewStore.documentList,
        };
    }
}
DocumentsActivityRenderer.template = "documents.DocumentsActivityRenderer";
DocumentsActivityRenderer.components = {
    ...ActivityRenderer.components,
    DocumentsFileViewer,
    DocumentsInspector,
};
