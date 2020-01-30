odoo.define('documents.controllerMixin', function (require) {
'use strict';

const DocumentsInspector = require('documents.DocumentsInspector');
const DocumentViewer = require('documents.DocumentViewer');

const Chatter = require('mail.Chatter');

const { _t, qweb } = require('web.core');
const fileUploadMixin = require('web.fileUploadMixin');
const session = require('web.session');

const DocumentsControllerMixin = Object.assign({}, fileUploadMixin, {

    events: {
        'click .o_documents_close_chatter': '_onClickDocumentsCloseChatter',
        'click .o_documents_kanban_share_domain': '_onClickDocumentsShareDomain',
        'click .o_documents_kanban_upload': '_onClickDocumentsUpload',
        'click .o_documents_kanban_url': '_onClickDocumentsUploadFromUrl',
        'click .o_documents_kanban_request': '_onClickDocumentsRequest',
        'dragleave .o_documents_view': '_onDragleaveDocumentsView',
        'dragover .o_documents_view': '_onDragoverDocumentsView',
        'dragstart .o_document_draggable': '_onDragstartDocumentDraggable',
        'drop .o_documents_view': '_onDropDocumentsView',
    },
    custom_events: Object.assign({},  fileUploadMixin.custom_events, {
        archive_records: '_onArchiveRecords',
        delete_records: '_onDeleteRecords',
        document_viewer_attachment_changed: '_onDocumentViewerAttachmentChanged',
        download: '_onDownload',
        get_search_panel_tags: '_onGetSearchPanelTags',
        history_item_delete: '_onHistoryItemDelete',
        history_item_download: '_onHistoryItemDownload',
        history_item_restore: '_onHistoryItemRestore',
        kanban_image_clicked: '_onKanbanImageClicked',
        lock_attachment: '_onLockAttachment',
        open_chatter: '_onOpenChatter',
        open_record: '_onOpenRecord',
        save_multi: '_onSaveMulti',
        select_record: '_onSelectRecord',
        set_focus_tag_input: '_onSetFocusTagInput',
        set_file: '_onSetFile',
        share_ids: '_onShareIds',
        trigger_rule: '_onTriggerRule',
    }),

    /**
     * @override
     */
    init(parent, model, renderer, params) {
        /**
         * The id of the record used as "anchor" for the multi selection.
         * Used to select records with ctrl/shift keys.
         */
        this._anchorId = null;
        this._chatter = null;
        this._documentsInspector = null;
        /**
         * This attribute sets the focus on the tag input of the inspector on mount.
         * Used to indicate that the tag input of the inspector has to regain focus at the next re-render
         */
        this._isInspectorTagInputFocusOnMount = false;
        /**
         * _selectedRecordIds is the list of the ids of all records that are currently selected and on which
         * most UI actions will take effect (drag & drop, Inspector).
         */
        this._selectedRecordIds = params.selectedRecordIds || [];
        fileUploadMixin.init.call(this);
    },

    /**
     * Used in the start() of the view controller,
     * the controller may be configured with pre-selected records, so this should be reflected visually.
     */
    start() {
        this._updateSelection();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Exporting this._selectedRecordIds to be able to keep selection when changing view.
     *
     * @override
     */
    exportState() {
        const state = this._super(...arguments) || {};
        state.selectedRecordIds = this._selectedRecordIds;
        return state;
    },
    /**
     * Called right after the reload of the view.
     */
    async reload() {
        this._updateSelection();
        await this._renderFileUploads();
        const folderIds = [
            ...new Set(Object.values(this._fileUploads).map(upload => upload.folderId))
        ];
        this._searchPanel.setUploadingFolderIds(folderIds);
    },
    /**
     * @param {jQueryElement} $node
     */
    renderButtons($node) {
        this.$buttons = $(qweb.render('DocumentsViews.buttons'));
        this.$buttons.appendTo($node);
        this._updateButtons();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _closeChatter() {
        this.$('.o_content').removeClass('o_chatter_open');
        this.$('.o_document_chatter_container').remove();
        if (!this._chatter) {
            return;
        }
        this._chatter.destroy();
        this._chatter = null;
    },
    /**
     * Renders the inspector with a slight delay.
     * This is useful to let browser do some painting before, notably the record selection,
     * as the rendering of inspector may be quite slow (up to a few seconds).
     *
     * @private
     * @param {ev} event used for custom behaviour on override.
     */
    async _deferredRenderInspector(ev) {
        return new Promise((resolve) => {
            setTimeout(() => {
                this._renderDocumentsInspector();
                resolve();
            });
        });
    },
    /**
     * @override
     */
    _getFileUploadRenderOptions() {
        const currentFolderId = this._searchPanel.getSelectedFolderId();
        return {
            predicate: fileUpload => {
                return !currentFolderId ||
                    fileUpload.recordId ||
                    currentFolderId === fileUpload.folderId;
            },
            targetCallback: fileUpload => {
                const $targetCard = this.$(`.o_documents_attachment[data-id="${fileUpload.recordId}"]`);
                $targetCard.find('.o_record_selector').addClass('o_hidden');
                return $targetCard;
            },
        };
    },
    /**
     * @override
     */
    _getFileUploadRoute() {
        return '/documents/upload_attachment';
    },
    /**
     * Generates an drag icon near the cursor containing information on the dragged records.
     *
     * @private
     * @param {Object} param0
     * @param {Object} dataTransfer
     * @param {integer} lockedCount
     * @param {integer[]} draggedRecordIds
     */
    _makeDragIcon({ dataTransfer, lockedCount, draggedRecordIds }) {
        let dragIconContent;
         if (lockedCount > 0) {
            dragIconContent = _.str.sprintf(_t("%s Documents (%s locked)"), draggedRecordIds.length, lockedCount);
        } else {
            dragIconContent = _.str.sprintf(_t("%s Documents"), draggedRecordIds.length);
        }

        if (draggedRecordIds.length === 1) {
            const state = this.model.get(this.handle);
            const record = state.data.find(record => record.res_id === draggedRecordIds[0]);
            if (record) {
                dragIconContent = record.data.name ? record.data.display_name : _t("Unnamed");
            }
        }
        const $dragIcon = $(qweb.render('documents.dragIcon', {
            dragIconContent,
        })).appendTo($('body'));
        dataTransfer.setDragImage($dragIcon[0], -5, -5);

        // as the DOM render doesn't happen in the current call stack, the .remove() of the dragIcon has to be
        // moved back in the event queue so the setDragImage can use the dragIcon when it is in the DOM.
        setTimeout(() => $dragIcon.remove());
    },
    /**
     * @override
     */
    _makeFileUpload({ recordId }) {
        return Object.assign({
            folderId: this._searchPanel.getSelectedFolderId(),
            recordId,
        },
        fileUploadMixin._makeFileUpload.apply(this, arguments));
    },
    /**
     * @override
     * @param {integer} param0.recordId
     */
    _makeFileUploadFormDataKeys({ recordId }) {
        const context = this.model.get(this.handle, { raw: true }).getContext();
        return {
            document_id: recordId,
            folder_id: this._searchPanel.getSelectedFolderId(),
            partner_id: context && context.default_partner_id,
        };
    },
    /**
     * Used in the tests to mock the upload behaviour and to access the $uploadInput fragment.
     *
     * @private
     * @param {jQueryElement} $uploadInput
     */
    _promptFileInput($uploadInput) {
        $uploadInput.click();
    },
    /**
     * Opens the chatter of the given record.
     *
     * @private
     * @param {Object} record
     * @returns {Promise}
     */
    async _renderChatter() {
        if (this._selectedRecordIds.length != 1) {
            return;
        }
        const recordData = this.model.get(this.handle).data.find(record => record.res_id === this._selectedRecordIds[0]);
        await this.model.fetchActivities(recordData.id);
        const record = this.model.get(recordData.id);
        this._closeChatter();
        const $chatterContainer = $(qweb.render('documents.ChatterContainer'));
        this.$('.o_content').addClass('o_chatter_open').append($chatterContainer);
        this._chatter = new Chatter(this, record, {
            mail_thread: 'message_ids',
            mail_followers: 'message_follower_ids',
            mail_activity: 'activity_ids'
        }, {
            display_log_button: true,
            isEditable: true,
        });
        await this._chatter.replace($chatterContainer.find('.o_documents_chatter_placeholder'));
    },
    /**
     * Renders and appends the documents inspector sidebar.
     *
     * @private
     */
    async _renderDocumentsInspector() {
        const state = this.model.get(this.handle);
        let localState;
        if (this._documentsInspector) {
            localState = this._documentsInspector.getLocalState();
            this._documentsInspector.destroy();
        }
        this._documentsInspector = new DocumentsInspector(this, {
            focusTagInput: this._isInspectorTagInputFocusOnMount,
            folderId: this._searchPanel.getSelectedFolderId(),
            folders: this._searchPanel.getFolders(),
            recordIds: this._selectedRecordIds,
            state,
            tags: this._searchPanel.getTags(),
            viewType: this.viewType,
        });
        this._isInspectorTagInputFocusOnMount = false;
        await this._documentsInspector.insertAfter(this.renderer.$el);
        if (localState) {
            this._documentsInspector.setLocalState(localState);
        }
    },
    /**
     * Open the share wizard with the given context, containing either the
     * 'attachment_ids' or the 'active_domain'.
     *
     * @private
     * @param {Object} vals (ORM create dict)
     * @returns {Promise}
     */
    async _shareDocuments(vals) {
        if (!vals.folder_id) {
            return;
        }
        const result = await this._rpc({
            model: 'documents.share',
            method: 'create_share',
            args: [vals],
        });
        this.do_action(result);
    },
    /**
     * Apply rule's actions for the specified attachments.
     *
     * @private
     * @param {string} ruleId
     * @param {string[]} recordIds
     * @return {Promise}
     */
    async _triggerRule(ruleId, recordIds) {
        const result = await this._rpc({
            model: 'documents.workflow.rule',
            method: 'apply_actions',
            args: [[ruleId], recordIds],
        });
        if (_.isObject(result)) {
            await this.do_action(result);
        } else {
            await this.reload();
        }
    },
    /**
     * Override to render the documents selector and inspector sidebars and
     * update the record selection based on the available records and the controller state.
     *
     * @private
     * @param {Object} state
     * @param {Object} [param1={}]
     * @param {Object} [param1.controllerState={}]
     * @param {integer[]} [param1.controllerState.selectedRecordIds]
     */
    async _update(state, { controllerState: { selectedRecordIds, }={}, }={}) {
        if (selectedRecordIds) {
            this._selectedRecordIds = selectedRecordIds;
        }
        const recordIds = state.data.map(record => record.res_id);
        this._selectedRecordIds = _.intersection(this._selectedRecordIds, recordIds);
        await this._updateChatter();
        await this._renderDocumentsInspector();
    },
    /**
     * Disables the control panel buttons if there is no selected folder.
     *
     * @private
     */
    _updateButtons() {
        const selectedFolderId = this._searchPanel.getSelectedFolderId();
        this.$buttons.find('.o_documents_kanban_upload').prop('disabled', !selectedFolderId);
        this.$buttons.find('.o_documents_kanban_url').prop('disabled', !selectedFolderId);
        this.$buttons.find('.o_documents_kanban_request').prop('disabled', !selectedFolderId);
        this.$buttons.find('.o_documents_kanban_share_domain').prop('disabled', !selectedFolderId);
    },
    /**
     * Update chatter part visually. Chatter only exists in single selection, and it is always open in that case.
     *
     * @private
     * @returns {Promise}
     */
    async _updateChatter() {
        const state = this.model.get(this.handle);
        if (!this._chatter) {
            return;
        }
        if (this._selectedRecordIds.length === 1) {
            const record = state.data.find(record => record.res_id === this._selectedRecordIds[0]);
            if (record) {
                await this._renderChatter();
            }
        } else {
            this._closeChatter();
        }
    },
    /**
     * Calls the renderer updateSelection to display which records are selected.
     *
     * @private
     */
    _updateSelection() {
        this.renderer.updateSelection(this._selectedRecordIds);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * FIXME: build a more complete archive system:
     * currently, it checks the archive state of the first record of the selection and supposes that
     * all the selected records have the same active state (since archived attachments should always be viewed
     * separately). The current system could technically cause unexpected results if the selection contains
     * records of both states.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {Object[]} ev.data.records objects with keys 'id' (the localId)
     *   and 'res_id'
     */
    async _onArchiveRecords(ev) {
        ev.stopPropagation();
        const recordIds = ev.data.records.map(record => record.id);
        await this.model.toggleActive(recordIds, this.handle);
        await this.update({}, { reload: false }); // the reload is done by toggleActive

    },
    /**
     * @private
     */
    async _onBeforeUpload() {
        fileUploadMixin._onBeforeUpload.apply(this, arguments);
        const folderIds = [
            ...new Set(Object.values(this._fileUploads).map(upload => upload.folderId))
        ];
        this._searchPanel.setUploadingFolderIds(folderIds);
    },
    /**
     * @private
     */
    _onClickDocumentsCloseChatter() {
        this._closeChatter();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickDocumentsRequest(ev) {
        ev.preventDefault();
        const context = this.model.get(this.handle, {raw: true}).getContext();
        this.do_action('documents.action_request_form', {
            additional_context: {
                default_partner_id: context.default_partner_id || false,
                default_folder_id: this._searchPanel.getSelectedFolderId(),
                default_tag_ids: [[6, 0, this._searchPanel.getSelectedTagIds()]],
            },
            on_close: async () => await this.reload(),
        });
    },
    /**
     * Share the current domain.
     *
     * @private
     */
    _onClickDocumentsShareDomain() {
        const state = this.model.get(this.handle, { raw: true });
        this._shareDocuments({
            domain: state.domain,
            folder_id: this._searchPanel.getSelectedFolderId(),
            tag_ids: [[6, 0, this._searchPanel.getSelectedTagIds()]],
            type: 'domain',
        });
    },
    /**
     * @private
     */
    _onClickDocumentsUpload() {
        const $uploadInput = $('<input>', {
            type: 'file',
            name: 'files[]',
            multiple: 'multiple'
        });
        $uploadInput.on('change', async ev => {
            await this._uploadFiles(ev.target.files);
            $uploadInput.remove();
        });
        $uploadInput.click();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickDocumentsUploadFromUrl(ev) {
        ev.preventDefault();
        const context = this.model.get(this.handle, {raw: true}).getContext();
        this.do_action('documents.action_url_form', {
            additional_context: {
                default_partner_id: context.default_partner_id || false,
                default_folder_id: this._searchPanel.getSelectedFolderId(),
                default_tag_ids: [[6, 0, this._searchPanel.getSelectedTagIds()]],
            },
            on_close: async () => await this.reload()
        });
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {Object[]} ev.data.records objects with keys 'id' (the localId)
     *   and 'res_id'
     */
    async _onDeleteRecords(ev) {
        ev.stopPropagation();
        const recordIds = ev.data.records.map(record => record.id);
        await this.model.deleteRecords(recordIds, this.modelName);
        const resIds = ev.data.records.map(record => record.res_id);
        this._selectedRecordIds = _.difference(this._selectedRecordIds, resIds);
        await this.reload();
    },
    /**
     * @private
     * @param {DragEvent} ev
     */
    async _onDropDocumentsView(ev) {
        if (!ev.originalEvent.dataTransfer.types.includes('Files')) {
            return;
        }
        ev.preventDefault();
        this.renderer.$el.removeClass('o_documents_drop_over');
        this.$('.o_documents_upload_text').remove();
        await this._uploadFiles(ev.originalEvent.dataTransfer.files);
    },
    /**
     * Update the controller when the DocumentViewer has modified an attachment
     *
     * @private
     * @param {OdooEvent} ev
     */
    async _onDocumentViewerAttachmentChanged(ev) {
        ev.stopPropagation();
        await this.update({});
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer[]} ev.data.resIds
     */
    _onDownload(ev) {
        ev.stopPropagation();
        const resIds = ev.data.resIds;
        if (resIds.length === 1) {
            window.location = `/documents/content/${resIds[0]}`;
        } else {
            session.get_file({
                url: '/document/zip',
                data: {
                    file_ids: resIds,
                    zip_name: `documents-${moment().format('YYYY-MM-DD')}.zip`
                },
            });
        }
    },
    /**
     * @private
     * @param {DragEvent} ev
     */
    _onDragoverDocumentsView(ev) {
        if (
            !this._searchPanel.getSelectedFolderId() ||
            !ev.originalEvent.dataTransfer.types.includes('Files')
        ) {
            return;
        }
        ev.preventDefault();
        this.renderer.$el.addClass('o_documents_drop_over');
        if (this.$('.o_documents_upload_text').length === 0) {
            this.$('.o_content').append($(qweb.render('documents.uploadText')));
        }
    },
    /**
     * @private
     * @param {DragEvent} ev
     */
    _onDragleaveDocumentsView(ev) {
        if (
            $(ev.target).closest(this.renderer.$el) &&
            ev.target !== this.renderer.el
        ) {
            return;
        }
        this.renderer.$el.removeClass('o_documents_drop_over');
        this.$('.o_documents_upload_text').remove();
    },
    /**
     * Adds the selected documents to the data of the drag event and
     * creates a custom drag icon to represent the dragged documents.
     *
     * @private
     * @param {DragEvent} ev
     */
    _onDragstartDocumentDraggable(ev) {
        let isTargetSelected;
        let resId;
        switch (this.viewType) {
            case 'kanban':
                isTargetSelected = ev.currentTarget.classList.contains('o_record_selected');
                resId = $(ev.currentTarget).data('id')
                break;
            case 'list':
                isTargetSelected = $(ev.currentTarget).find('.o_list_record_selector input').prop('checked');
                resId = $(ev.currentTarget).closest('.o_data_row').data('res-id');
                break;
        }

        if (!isTargetSelected) {
            this.trigger_up('select_record', {
                isKeepSelection: false,
                originalEvent: ev,
                resId,
            });
        }
        const unlockedRecordIds = this.model.get(this.handle, {raw: true}).data
            .filter(record => !record.data.lock_uid || record.data.lock_uid === session.uid)
            .map(record => record.res_id);
        const draggedRecordIds = _.intersection(this._selectedRecordIds, unlockedRecordIds);
        if (draggedRecordIds.length === 0) {
            ev.preventDefault();
            return;
        }
        const lockedCount = this._selectedRecordIds.length - draggedRecordIds.length;
        ev.originalEvent.dataTransfer.setData('o_documents_data', JSON.stringify({
            recordIds: draggedRecordIds,
            lockedCount,
        }));

        this._makeDragIcon({
            dataTransfer: ev.originalEvent.dataTransfer,
            lockedCount,
            draggedRecordIds,
        });
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {callback} ev.data.callback
     */
    _onGetSearchPanelTags(ev) {
         ev.data.callback(this._searchPanel.getTags());
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.attachmentId
     */
    async _onHistoryItemDelete(ev) {
        ev.stopPropagation();
        await this._rpc({
            model: 'ir.attachment',
            method: 'unlink',
            args: [[ev.data.attachmentId]],
        });
        await this.reload();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.attachmentId
     */
    _onHistoryItemDownload(ev) {
        ev.stopPropagation();
        window.location = `/web/content/${ev.data.attachmentId}?download=true`;
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.attachmentId
     * @param {integer} ev.data.resId
     */
    async _onHistoryItemRestore(ev) {
        ev.stopPropagation();
        await this._rpc({
            model: 'documents.document',
            method: 'write',
            args: [[ev.data.resId], {attachment_id: ev.data.attachmentId}],
        });
        await this.reload();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.recordId
     * @param {Array<Object>} ev.data.recordList
     */
    async _onKanbanImageClicked(ev) {
        ev.stopPropagation();
        const documents = ev.data.recordList;
        const recordId = ev.data.recordId;
        const documentViewer = new DocumentViewer(this, documents, recordId);
        await documentViewer.appendTo(this.$('.o_documents_view'));
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.resId
     */
    async _onLockAttachment(ev) {
        ev.stopPropagation();
        try {
            await this._rpc({
                model: 'documents.document',
                method: 'toggle_lock',
                args: [ev.data.resId],
            });
        } catch (err) {
            // silently ignore RPC errors
        }
        await this.reload();
    },
    /**
     * Open the chatter of the given document.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {string} ev.data.id localId of the document
     */
    async _onOpenChatter(ev) {
        ev.stopPropagation();
        await this._renderChatter();
    },
    /**
     * Open a record in form view given a model and an id.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {integer} [ev.data.resId] opens the form view in create mode if
     *   not given
     * @param {string} ev.data.resModel
     */
    async _onOpenRecord(ev) {
        ev.stopPropagation();
        let viewId = false;
        try {
            viewId = await this._rpc({
                model: ev.data.resModel,
                method: 'get_formview_id',
                args: [ev.data.resId],
            });
        } catch (err) {
            // ignores error
        }
        this.do_action({
            res_id: ev.data.resId,
            res_model: ev.data.resModel,
            type: 'ir.actions.act_window',
            views: [[viewId, 'form']],
        });
    },
    /**
     * Save the changes done in the DocumentsInspector and re-render the view.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {function} [ev.data.callback]
     * @param {Object} ev.data.changes
     * @param {string[]} ev.data.dataPointsIds
     */
    async _onSaveMulti(ev) {
        ev.stopPropagation();
        try {
            await this.model.saveMulti(ev.data.dataPointIds, ev.data.changes, this.handle);
            await this.reload({});
        } finally {
            ev.data.callback && ev.data.callback();
        }
    },
    /**
     * React to records selection changes to update the DocumentInspector with
     * the current selected records.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {boolean} ev.data.isKeepSelection if true, conserves the current selection
     * equivalent to using the control key.
     * @param {MouseEvent} ev.data.originalEvent the event catched by the child
     *   element triggering up the OdooEvent
     * @param {string} ev.data.resId the resId of the record updating its status
     */
    async _onSelectRecord(ev) {
        const state = this.model.get(this.handle);
        const targetRecordId = ev.data.resId;
        const wasSelected = this._selectedRecordIds.includes(targetRecordId);

        // selections
        const isRangeSelection = ev.data.originalEvent.shiftKey && this._anchorId;
        const isKeepSelection = ev.data.isKeepSelection || ev.data.originalEvent.ctrlKey || ev.data.originalEvent.metaKey;
        const isBasicSelection = !isRangeSelection && !isKeepSelection;
        let newSelection;

        if (isBasicSelection) {
            if (this._selectedRecordIds.length > 1) {
                newSelection = [targetRecordId];
            } else {
                newSelection = wasSelected ? [] : [targetRecordId];
            }
        } else {
            let selectedRecordsIds;
            if (isRangeSelection) {
                const recordIds = state.data.map(record => record.res_id);
                const anchorIndex = recordIds.indexOf(this._anchorId);
                const selectedRecordIndex = recordIds.indexOf(targetRecordId);
                const lowerIndex = Math.min(anchorIndex, selectedRecordIndex);
                const upperIndex = Math.max(anchorIndex, selectedRecordIndex);
                selectedRecordsIds = recordIds.slice(lowerIndex, upperIndex + 1);
            } else {
                selectedRecordsIds = [targetRecordId];
            }

            if (isKeepSelection) {
                newSelection = wasSelected
                    ? this._selectedRecordIds.filter(id => id !== targetRecordId)
                    : this._selectedRecordIds.concat(selectedRecordsIds);
            } else {
                newSelection = selectedRecordsIds;
            }
        }

        if (!isRangeSelection) {
            if (newSelection.includes(targetRecordId)) {
                this._anchorId = targetRecordId;
            } else {
                this._anchorId = null;
            }
        }

        this._selectedRecordIds = [...new Set(newSelection)];
        await this._updateChatter();
        this._deferredRenderInspector(ev);
        this._updateSelection();
    },
    /**
     * Sets the focus on the tag input for the next render of document inspector.
     *
     * @private
     */
    _onSetFocusTagInput() {
        this._isInspectorTagInputFocusOnMount = true;
    },
    /**
     * Set/Replace the file of the document by prompting an input file.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.id
     */
    _onSetFile(ev) {
        const $uploadInput = $('<input/>', {
            type: 'file',
            name: 'files[]'
        });
        $uploadInput.on('change', async e => {
            await this._uploadFiles($uploadInput[0].files, {recordId: ev.data.id});
            $uploadInput.remove();
        });
        this._promptFileInput($uploadInput);
    },
    /**
     * Share the given records.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {integer[]} ev.data.resIds
     */
    _onShareIds(ev) {
        ev.stopPropagation();
        this._shareDocuments({
            document_ids: [[6, 0, ev.data.resIds]],
            folder_id: this._searchPanel.getSelectedFolderId(),
            type: 'ids',
        });
    },
    /**
     * Apply rule's actions for the given records in a mutex, and reload
     *
     * @private
     * @param {OdooEvent} ev
     * @param {Object} ev.data
     */
    async _onTriggerRule(ev) {
        ev.stopPropagation();
        const recordIds = ev.data.records.map(record => record.res_id);
        await this._triggerRule(ev.data.ruleId, recordIds);
    },
    /**
     * @override
     * @param {Object} param0
     * @param {XMLHttpRequest} param0.xhr
     */
    _onUploadLoad({ xhr }) {
        const result = xhr.status === 200
            ? JSON.parse(xhr.response)
            : {
                error: _.str.sprintf(_t("status code: %s </br> message: %s"), xhr.status, xhr.response)
            };
        if (result.error) {
            this.do_notify(_t("Error"), result.error, true);
        }
        fileUploadMixin._onUploadLoad.apply(this, arguments);
    },
});

return DocumentsControllerMixin;

});
