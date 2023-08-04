/** @odoo-module **/

import { useBus, useService } from "@web/core/utils/hooks";
import { escape } from "@web/core/utils/strings";
import { memoize } from "@web/core/utils/functions";
import { formatFloat } from "@web/views/fields/formatters";
import { useSetupView } from "@web/views/view_hook";
import { PdfManager } from "@documents/owl/components/pdf_manager/pdf_manager";
import { x2ManyCommands } from "@web/core/orm_service";
import { ShareFormViewDialog } from "@documents/views/helper/share_form_view_dialog";
import dUtils from '@documents/views/helper/documents_utils';

const { EventBus, onWillStart, markup, useComponent, useEnv, useRef, useSubEnv } = owl;

/**
 * Controller/View hooks
 */

// Small hack, memoize uses the first argument as cache key, but we need the orm which will not be the same.
const loadMaxUploadSize = memoize((_null, orm) =>
    orm.call("documents.document", "get_document_max_upload_limit")
);

/**
 * To be executed before calling super.setup in view controllers.
 */
export function preSuperSetup() {
    // Otherwise not available in model.env
    useSubEnv({
        documentsView: {
            bus: new EventBus(),
        },
    });
    const component = useComponent();
    const props = component.props;
    // Root state is shared between views to keep the selection
    if (props.globalState && props.globalState.sharedSelection) {
        if (!props.state) {
            props.state = {};
        }
        if (!props.state.modelState) {
            props.state.modelState = {};
        }
        props.state.modelState.sharedSelection = props.globalState.sharedSelection;
    }
}

/**
 * Sets up the env required by documents view, as well as any other hooks.
 * Returns properties to be applied to the calling component. The code assumes that those properties are assigned to the component.
 */
export function useDocumentView(helpers) {
    const component = useComponent();
    const props = component.props;
    const root = useRef("root");
    const uploadFileInputRef = useRef("uploadFileInput");
    const orm = useService("orm");
    const notification = useService("notification");
    const dialogService = useService("dialog");
    const action = useService("action");

    // Env setup
    useSubEnv({
        model: component.model,
    });
    const env = useEnv();

    // Keep selection between views
    useSetupView({
        rootRef: root,
        getGlobalState: () => ({
            sharedSelection: component.model.exportSelection(),
        }),
    });

    let maxUploadSize;
    Object.defineProperty(component, "maxUploadSize", {
        get: () => maxUploadSize,
        set: (newVal) => {
            maxUploadSize = newVal;
        },
    });
    onWillStart(async () => {
        component.maxUploadSize = await loadMaxUploadSize(null, orm);
    });

    return {
        // Refs
        root,
        uploadFileInputRef,
        // Services
        orm,
        notification,
        dialogService,
        actionService: action,
        // Document preview
        ...useDocumentsViewFilePreviewer(helpers),
        // Document upload
        ...useDocumentsViewFileUpload(),
        // Trigger rule
        ...useTriggerRule(),
        // Helpers
        hasDisabledButtons: () => {
            const folder = env.searchModel.getSelectedFolder();
            return !folder.id || !folder.has_write_access;
        },
        hasShareDocuments: () => {
            const folder = env.searchModel.getSelectedFolder();
            return !folder.id
        },
        // Listeners
        onClickDocumentsRequest: () => {
            action.doAction("documents.action_request_form", {
                additionalContext: {
                    default_partner_id: props.context.default_partner_id || false,
                    default_folder_id: env.searchModel.getSelectedFolderId(),
                    default_tag_ids: [
                        x2ManyCommands.replaceWith(env.searchModel.getSelectedTagIds()),
                    ],
                    default_res_id: props.context.default_res_id || false,
                    default_res_model: props.context.default_res_model || false,
                },
                fullscreen: env.isSmall,
                onClose: async () => {
                    await env.model.load();
                    env.model.useSampleModel = env.model.root.records.length === 0;
                    env.model.notify();
                },
            });
        },
        onClickDocumentsAddUrl: () => {
            action.doAction("documents.action_url_form", {
                additionalContext: {
                    default_partner_id: props.context.default_partner_id || false,
                    default_folder_id: env.searchModel.getSelectedFolderId(),
                    default_tag_ids: [
                        x2ManyCommands.replaceWith(env.searchModel.getSelectedTagIds()),
                    ],
                    default_res_id: props.context.default_res_id || false,
                    default_res_model: props.context.default_res_model || false,
                },
                fullscreen: env.isSmall,
                onClose: async () => {
                    await env.model.load();
                    env.model.useSampleModel = env.model.root.records.length === 0;
                    env.model.notify();
                },
            });
        },
        onClickShareDomain: async () => {
            const resIds = await env.model.root.getResIds(true);
            const selectedRecords = env.model.root.records.filter((rec) =>
                resIds.includes(rec.resId)
            );
            if (
                selectedRecords.length &&
                selectedRecords.every((rec) => rec._values.type === "empty")
            ) {
                notification.add(env._t("The requested documents are not shareable."), {
                    type: "danger",
                });
                return;
            }
            const defaultVals = {
                domain: env.searchModel.domain,
                folder_id: env.searchModel.getSelectedFolderId(),
                tag_ids: [x2ManyCommands.replaceWith(env.searchModel.getSelectedTagIds())],
                type: selectedRecords.length ? "ids" : "domain",
                document_ids: selectedRecords.length
                    ? [
                          x2ManyCommands.replaceWith(
                              selectedRecords
                                  .filter((rec) => rec._values.type !== "empty")
                                  .map((rec) => rec.resId)
                          ),
                      ]
                    : false,
            };
            const linkProportion = await dUtils.get_link_proportion(orm, resIds ? resIds : false, defaultVals.domain);
            if (linkProportion == 'all') {
                notification.add(
                    env._t("Links cannot be shared."),
                    { type: "danger", },
                );
                return;
            }
            const vals = helpers?.sharePopupAction ? await helpers.sharePopupAction(defaultVals) : defaultVals;
            const act = await orm.call("documents.share", "open_share_popup", [vals]);
            const shareResId = act.res_id;
            let saved = false;
            const close = dialogService.add(
                ShareFormViewDialog,
                {
                    resModel: "documents.share",
                    resId: shareResId,
                    onSave: async (record) => {
                        saved = true;
                        // Copy the share link to the clipboard
                        navigator.clipboard.writeText(record.data.full_url);
                        // Show a notification to the user about the copy to clipboard
                        notification.add(
                            env._t("The share url has been copied to your clipboard."),
                            {
                                type: "success",
                            }
                        );
                        close();
                    },
                    onDiscard: () => {
                        close();
                    },
                },
                {
                    onClose: async () => {
                        if (!saved) {
                            await orm.unlink("documents.share", [shareResId]);
                        }
                    },
                }
            );
        },
    };
}

/**
 * Hook to setup the file previewer
 */
function useDocumentsViewFilePreviewer({
    getSelectedDocumentsElements,
    setInspectedDocuments,
    setPreviewStore,
    isRecordPreviewable = () => true,
}) {
    const component = useComponent();
    const env = useEnv();
    const bus = env.documentsView.bus;
    /** @type {import("@documents/core/document_service").DocumentService} */
    const documentService = useService("document.document");

    const onOpenDocumentsPreview = async ({
        documents,
        mainDocument,
        isPdfSplit,
        rules,
        hasPdfSplit,
    }) => {
        const openPdfSplitter = (documents) => {
            let newDocumentIds = [];
            component.dialogService.add(
                PdfManager,
                {
                    documents: documents.map((doc) => doc.data),
                    rules: rules.map((rule) => rule.data),
                    onProcessDocuments: ({ documentIds, ruleId, exit }) => {
                        if (documentIds && documentIds.length) {
                            newDocumentIds = [...new Set(newDocumentIds.concat(documentIds))];
                        }
                        if (ruleId) {
                            component.triggerRule(documentIds, ruleId, !exit);
                        }
                    },
                },
                {
                    onClose: async () => {
                        if (!newDocumentIds.length) {
                            return;
                        }
                        await component.model.load();
                        let count = 0;
                        for (const record of documents) {
                            if (!newDocumentIds.includes(record.resId)) {
                                record.model.root.deleteRecords(record);
                                continue;
                            }
                            record.onRecordClick(null, {
                                isKeepSelection: count++ !== 0,
                                isRangeSelection: false,
                            });
                        }
                    },
                }
            );
        };
        if (isPdfSplit) {
            openPdfSplitter(documents);
            return;
        }
        const documentsRecords = (
            (documents.length === 1 && component.model.root.records) ||
            documents
        )
            .filter(isRecordPreviewable)
            .map((rec) => {
                return documentService.insert({
                    id: rec.resId,
                    attachment: {
                        id: rec.data.attachment_id[0],
                        name: rec.data.attachment_id[1],
                        mimetype: rec.data.mimetype,
                        url: rec.data.url,
                        displayName: rec.data.display_name,
                        documentId: rec.resId,
                    },
                    name: rec.data.name,
                    mimetype: rec.data.mimetype,
                    url: rec.data.url,
                    displayName: rec.data.display_name,
                    record: rec,
                });
            });
        // If there is a scrollbar we don't want it whenever the previewer is opened
        if (component.root.el) {
            component.root.el.querySelector(".o_documents_view").classList.add("overflow-hidden");
        }
        const selectedDocument = documentsRecords.find(
            (rec) => rec.id === (mainDocument || documents[0]).resId
        );
        documentService.documentList = {
            documents: documentsRecords || [],
            initialRecordSelectionLength: documents.length,
            pdfManagerOpenCallback: (documents) => {
                openPdfSplitter(documents);
            },
            onDeleteCallback: () => {
                // We want to focus on the first selected document's element
                const elements = getSelectedDocumentsElements();
                if (elements.length) {
                    elements[0].focus();
                }
                if (component.root.el) {
                    component.root.el
                        .querySelector(".o_documents_view")
                        .classList.remove("overflow-hidden");
                }

                setInspectedDocuments([]);
                setPreviewStore({});
            },
            onSelectDocument: (record) => {
                // change the inspected documents only if we inspect only one
                if (documents.length <= 1) {
                    setInspectedDocuments([record]);
                }
            },
            hasPdfSplit,
            selectedDocument,
        };

        const previewStore = {
            documentList: documentService.documentList,
            startIndex: documentsRecords.indexOf(selectedDocument),
            attachments: documentsRecords.map((doc) => doc.attachment),
        };

        setInspectedDocuments(documents);
        setPreviewStore({ ...previewStore });
    };

    useBus(bus, "documents-open-preview", async (ev) => {
        component.onOpenDocumentsPreview(ev.detail);
    });
    useBus(bus, "documents-close-preview", () => {
        setInspectedDocuments([]);
        setPreviewStore({});
    });

    return {
        onOpenDocumentsPreview,
    };
}

/**
 * Hook to setup file upload
 */
function useDocumentsViewFileUpload() {
    const component = useComponent();
    const env = useEnv();
    const bus = env.documentsView.bus;
    const notification = useService("notification");
    const fileUpload = useService("file_upload");

    const handleUploadError = (result) => {
        notification.add(result.error, {
            title: env._t("Error"),
            sticky: true,
        });
    };

    let wasUsingSampleModel = false;
    useBus(fileUpload.bus, "FILE_UPLOAD_ADDED", () => {
        if (env.model.useSampleModel) {
            wasUsingSampleModel = true;
            env.model.useSampleModel = false;
        }
    });

    useBus(fileUpload.bus, "FILE_UPLOAD_ERROR", async (ev) => {
        const { upload } = ev.detail;
        if (wasUsingSampleModel) {
            wasUsingSampleModel = false;
            env.model.useSampleModel = true;
        }
        if (upload.state !== "error") {
            return;
        }
        handleUploadError({
            error: env._t("An error occured while uploading."),
        });
    });

    useBus(fileUpload.bus, "FILE_UPLOAD_LOADED", async (ev) => {
        wasUsingSampleModel = false;
        const { upload } = ev.detail;
        const xhr = upload.xhr;
        const result =
            xhr.status === 200
                ? JSON.parse(xhr.response)
                : { error: env._t("status code: %s, message: %s", xhr.status, xhr.response) };
        if (result.error) {
            handleUploadError(result);
        } else {
            env.model.useSampleModel = false;
            await env.model.load();
            if (!result.ids) {
                return;
            }
            const records = env.model.root.records;
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
    });

    const uploadFiles = async ({ files, folderId, recordId, context, tagIds }) => {
        const validFiles = component.maxUploadSize ?
            [...files].filter((file) => file.size <= component.maxUploadSize) : files;
        if (validFiles.length !== 0) {
            await fileUpload.upload("/documents/upload_attachment", validFiles, {
                buildFormData: (formData) => {
                    formData.append("folder_id", folderId);
                    if (recordId) {
                        formData.append("document_id", recordId);
                    }
                    if (!tagIds.length && context?.default_tag_ids) {
                        tagIds = context.default_tag_ids;
                    }
                    formData.append("tag_ids", tagIds);
                    if (context) {
                        for (const key of [
                            "default_owner_id",
                            "default_partner_id",
                            "default_res_id",
                            "default_res_model",
                        ]) {
                            if (context[key]) {
                                formData.append(key.replace("default_", ""), context[key]);
                            }
                        }
                    }
                },
                displayErrorNotification: false,
            });
        }
        if (validFiles.length < files.length) {
            const message = env._t(
                "Some files could not be uploaded (max size: %s).",
                formatFloat(component.maxUploadSize, { humanReadable: true })
            );
            return notification.add(message, { type: "danger" });
        }
    };

    useBus(bus, "documents-upload-files", (ev) => {
        ev.detail.context = ev.detail.context || component.props.context;
        component.uploadFiles(ev.detail);
    });

    return {
        uploadFiles,
        onFileInputChange: async (ev) => {
            if (!ev.target.files.length) {
                return;
            }
            await component.uploadFiles({
                files: ev.target.files,
                folderId: env.searchModel.getSelectedFolderId(),
                recordId: false,
                context: component.props.context,
                tagIds: env.searchModel.getSelectedTagIds(),
            });
            ev.target.value = "";
        },
    };
}

/**
 * Trigger rule hook.
 * NOTE: depends on env.model being set
 */
export function useTriggerRule() {
    const env = useEnv();
    const orm = useService("orm");
    const notification = useService("notification");
    const action = useService("action");
    return {
        triggerRule: async (documentIds, ruleId, preventReload = false) => {
            const result = await orm.call("documents.workflow.rule", "apply_actions", [
                [ruleId],
                documentIds,
            ]);
            if (result && typeof result === "object") {
                if (result.hasOwnProperty("warning")) {
                    notification.add(
                        markup(
                            `<ul>${result["warning"]["documents"]
                                .map((d) => `<li>${escape(d)}</li>`)
                                .join("")}</ul>`
                        ),
                        {
                            title: result["warning"]["title"],
                            type: "danger",
                        }
                    );
                    if (!preventReload) {
                        await env.model.load();
                    }
                } else if (!preventReload) {
                    await action.doAction(result, {
                        onClose: async () => await env.model.load(),
                    });
                    return;
                }
            } else if (!preventReload) {
                await env.model.load();
            }
        },
    };
}
