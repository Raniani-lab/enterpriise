/** @odoo-module **/

import "@documents/models/attachment_viewer";
import "@documents/models/document_list";
import "@documents/models/document";

import { DocumentsUploadStore } from "./helper/documents_upload_store";
import { insert } from "@mail/model/model_field_command";
import { useBus, useService } from "@web/core/utils/hooks";
import { useSetupView } from "@web/views/view_hook";
import { x2ManyCommands } from "@web/core/orm_service";
import { PdfManager } from "@documents/owl/components/pdf_manager/pdf_manager";

const { markup, onWillStart, reactive, useRef, useState, useSubEnv } = owl;

export const DocumentsControllerMixin = (component) => class extends component {
    setup() {
        // The root state is shared between the different views to sync up selection
        if (this.props.globalState && this.props.globalState.documentsRootState) {
            if (!this.props.state) {
                this.props.state = {};
            }
            this.props.state.rootState = this.props.globalState.documentsRootState;
        }
        super.setup(...arguments);
        this.root = useRef("root");
        this.uploadFileInputRef = useRef("uploadFileInput");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.dialogService = useService("dialog");
        this.maxUploadSize = undefined;

        // Use DocumentsStore from global state if available -> makes file uploads stay between views
        const documentsStore =
            (this.props.globalState && this.props.globalState.documentsStore) ||
            reactive(new DocumentsUploadStore());
        documentsStore.setController(this);

        useSubEnv({
            // Used for updating the view when uploads are made
            documentsStore: documentsStore,
            // Current state of the file previewer
            documentsPreviewStore: useState({
                inspectedDocuments: [],
                attachmentViewer: null,
            }),
        });

        // Documents Preview
        useBus(this.env.bus, "documents-open-preview", this.onOpenDocumentsPreview.bind(this));
        useBus(this.env.bus, "documents-close-preview", this.onCloseDocumentsPreview.bind(this));
        // Documents rules
        useBus(this.env.bus, "documents-trigger-rule", this.onTriggerRule.bind(this));
        // File upload
        this.documentsUploader = useService("documents_file_upload");
        this.notification = useService("notification");
        useBus(this.env.bus, "documents-upload-files", this.onUploadFiles.bind(this));
        // Keep the selection between views
        useSetupView({
            rootRef: this.root,
            getGlobalState: () => {
                return {
                    documentsStore,
                    documentsRootState: this.model.root.exportState(),
                    maxUploadSize: this.maxUploadSize,
                };
            },
        });
        onWillStart(async () => {
            if (documentsStore.maxUploadSize !== undefined) {
                return;
            }
            this.maxUploadSize =
                (this.props.globalState && this.props.globalState.maxUploadSize) ||
                (await this.orm.call("documents.document", "get_document_max_upload_limit"));
        });
    }

    async onTriggerRule(ev) {
        const { documents, ruleId, preventReload } = ev.detail;
        this.triggerRule(
            documents.map((rec) => rec.resId),
            ruleId,
            preventReload
        );
    }

    async triggerRule(documentIds, ruleId, preventReload = false) {
        const result = await this.orm.call("documents.workflow.rule", "apply_actions", [[ruleId], documentIds]);
        if (result && typeof result === "object") {
            if (result.hasOwnProperty("warning")) {
                this.notification.add(
                    markup(`<ul>${result["warning"]["documents"].map((d) => `<li>${d}</li>`).join("")}</ul>`),
                    {
                        title: result["warning"]["title"],
                        type: "danger",
                    }
                );
                if (!preventReload) {
                    await this.model.load();
                    this.model.notify();
                }
            } else {
                if (preventReload) {
                    return;
                }
                await this.actionService.doAction(result, {
                    onClose: async () => {
                        if (this.env.documentsStore.controller.__owl__.status === 5 /* destroyed */) {
                            return;
                        }
                        await this.model.load();
                        this.model.notify();
                    },
                });
            }
        } else {
            if (!preventReload) {
                await this.model.load();
                this.model.notify();
            }
        }
    }

    async onOpenDocumentsPreview(ev) {
        const { documents, mainDocument, isPdfSplit, rules, hasPdfSplit } = ev.detail;
        if (!documents || !documents.length) {
            return;
        }
        const messaging = await this.env.services.messaging.get();
        const openPdfSplitter = (documents) => {
            let newDocumentIds = [];
            this.dialogService.add(
                PdfManager,
                {
                    documents: documents.map((doc) => doc.data),
                    rules: rules.map((rule) => rule.data),
                    onProcessDocuments: ({ documentIds, ruleId, exit }) => {
                        if (documentIds && documentIds.length) {
                            newDocumentIds = [...new Set(newDocumentIds.concat(documentIds))];
                        }
                        if (ruleId) {
                            this.triggerRule(documentIds, ruleId, !exit);
                        }
                    },
                },
                {
                    onClose: () => {
                        if (!newDocumentIds.length) {
                            return;
                        }
                        this.model.load().then(() => {
                            const records = this.model.root.records;
                            let count = 0;
                            for (const record of records) {
                                if (!newDocumentIds.includes(record.resId)) {
                                    continue;
                                }
                                record.onRecordClick(null, {
                                    isKeepSelection: count++ !== 0,
                                    isRangeSelection: false,
                                });
                            }
                            this.model.notify();
                        });
                    },
                }
            );
        };
        if (isPdfSplit) {
            openPdfSplitter(documents);
            return;
        }
        const documentsRecords = ((documents.length === 1 && this.model.root.records) || documents).map((rec) => {
            return messaging.models["Document"].insert({
                id: rec.resId,
                attachmentId: rec.data.attachment_id && rec.data.attachment_id[0],
                name: rec.data.name,
                mimetype: rec.data.mimetype,
                url: rec.data.url,
                displayName: rec.data.display_name,
                record: rec,
            });
        });
        // If there is a scrollbar we don't want it whenever the previewer is opened
        if (this.root.el) {
            this.root.el.querySelector(".o_documents_view").classList.add("overflow-hidden");
        }
        const selectedDocument = documentsRecords.find((rec) => rec.id === (mainDocument || documents[0]).resId);
        const documentList = messaging.models["DocumentList"].insert({
            documents: documentsRecords,
            initialRecordSelectionLength: documents.length,
            pdfManagerOpenCallback: (documents) => {
                openPdfSplitter(documents);
            },
            onDeleteCallback: () => {
                this.env.documentsPreviewStore.documentList = null;
                // Restore selection
                if (documents.length > 1) {
                    for (const rec of documents) {
                        rec.toggleSelection(true);
                    }
                }
                // We want to focus on the first selected document's element
                const elements = this.getSelectedDocumentsElements();
                if (elements.length) {
                    elements[0].focus();
                }
                if (this.root.el) {
                    this.root.el.querySelector(".o_documents_view").classList.remove("overflow-hidden");
                }
            },
            onSelectDocument: (record) => {
                for (const rec of this.model.root.selection) {
                    rec.selected = false;
                }
                record.toggleSelection(true);
            },
        });
        documentList.update({
            attachmentViewer: insert({ hasPdfSplit: hasPdfSplit || true }),
            selectedDocument: selectedDocument,
        });
        for (const rec of this.model.root.selection) {
            rec.selected = false;
        }
        selectedDocument.record.toggleSelection(true);
        this.env.documentsPreviewStore.documentList = documentList;
    }

    async onCloseDocumentsPreview() {
        if (this.env.documentsPreviewStore.documentList && this.env.documentsPreviewStore.documentList.exists()) {
            this.env.documentsPreviewStore.documentList.delete();
        }
    }

    async onFileInputChange(ev) {
        if (!ev.target.files.length) {
            return;
        }
        await this._uploadFiles(
            ev.target.files,
            this.env.searchModel.getSelectedFolderId(),
            false,
            this.props.context,
            {
                tagIds: this.env.searchModel.getSelectedTagIds(),
            }
        );
        ev.target.value = "";
    }

    async onUploadFiles(ev) {
        const { files, folderId, recordId, context, params } = ev.detail;
        await this._uploadFiles(files, folderId, recordId, context, params);
    }

    async _uploadFiles(files, folderId, recordId, context, params) {
        if (this.maxUploadSize && [...files].some((file) => file.size > this.maxUploadSize)) {
            return this.notification.add(this.env._t("File is too large."), {
                type: "danger",
            });
        }
        const uploadHandler =
            params.uploadHandler ||
            (async (result) => {
                if (result.error) {
                    this.notification.add(result.error, {
                        title: this.env._t("Error"),
                        sticky: true,
                    });
                } else if (!result.abort) {
                    if (this.env.documentsStore.controller.__owl__.status === 5 /* destroyed */) {
                        return;
                    }
                    await this.env.documentsStore.model.load();
                    if (result.ids) {
                        const records = this.env.documentsStore.model.root.records;
                        let count = 0;
                        for (const record of records) {
                            if (!result.ids.includes(record.resId)) {
                                continue;
                            }
                            record.onRecordClick(null, {
                                isKeepSelection: count++ !== 0,
                                isRangeSelection: false,
                            });
                        }
                    }
                }
                if (params.extraHandler) {
                    params.extraHandler(result);
                }
                this.env.documentsStore.model.notify();
            });
        params.onLoaded = params.onError = uploadHandler;
        await this.documentsUploader.add(
            "/documents/upload_attachment",
            files,
            folderId,
            recordId,
            this.env.documentsStore,
            context || this.props.context,
            params
        );
    }

    onClickDocumentsRequest() {
        this.actionService.doAction("documents.action_request_form", {
            additionalContext: {
                default_partner_id: this.props.context.default_partner_id || false,
                default_folder_id: this.env.searchModel.getSelectedFolderId(),
                default_tag_ids: [x2ManyCommands.replaceWith(this.env.searchModel.getSelectedTagIds())],
            },
            fullscreen: this.env.isSmall,
            onClose: async () => {
                await this.model.load();
                this.model.notify();
            },
        });
    }

    onClickDocumentsAddUrl() {
        this.actionService.doAction("documents.action_url_form", {
            additionalContext: {
                default_partner_id: this.props.context.default_partner_id || false,
                default_folder_id: this.env.searchModel.getSelectedFolderId(),
                default_tag_ids: [x2ManyCommands.replaceWith(this.env.searchModel.getSelectedTagIds())],
                default_res_id: this.props.context.default_res_id || false,
                default_res_model: this.props.context.default_res_model || false,
            },
            fullscreen: this.env.isSmall,
            onClose: async () => {
                await this.model.load();
                this.model.notify();
            },
        });
    }

    async onClickShareDomain() {
        const action = await this.orm.call("documents.share", "open_share_popup", [
            {
                domain: this.env.searchModel.domain,
                folder_id: this.env.searchModel.getSelectedFolderId(),
                tag_ids: [x2ManyCommands.replaceWith(this.env.searchModel.getSelectedTagIds())],
                type: this.model.root.selection.length ? "ids" : "domain",
                document_ids: this.model.root.selection.length
                    ? [[6, 0, await this.model.root.getResIds(true)]]
                    : false,
            },
        ]);
        let shareResId = null;
        let shareShouldDelete = true;
        this.actionService.doAction(action, {
            fullscreen: this.env.isSmall,
            props: {
                setShareResId: (resId) => {
                    shareResId = resId;
                },
                setShouldDelete: (shouldDelete) => {
                    shareShouldDelete = shouldDelete;
                },
            },
            onClose: () => {
                if (shareResId && shareShouldDelete) {
                    this.orm.unlink("documents.share", [shareResId]);
                }
            },
        });
    }

    hasDisabledButtons() {
        const folder = this.env.searchModel.getSelectedFolder();
        return !folder.id || !folder.has_write_access;
    }

    getSelectedDocumentsElements() {
        throw new Error("getSelectedDocumentsElements not implemented");
    }
};
