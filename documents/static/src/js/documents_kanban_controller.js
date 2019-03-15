odoo.define('documents.DocumentsKanbanController', function (require) {
"use strict";

/**
 * This file defines the Controller for the Documents Kanban view, which is an
 * override of the KanbanController.
 */

var DocumentsInspector = require('documents.DocumentsInspector');
var DocumentViewer = require('documents.DocumentViewer');

var Chatter = require('mail.Chatter');

var core = require('web.core');
var KanbanController = require('web.KanbanController');
var session = require('web.session');

var qweb = core.qweb;
var _t = core._t;

var DocumentsKanbanController = KanbanController.extend({
    events: _.extend({}, KanbanController.prototype.events, {
        'click .o_document_close_chatter': '_onCloseChatter',
        'drop .o_documents_kanban_view': '_onDrop',
        'dragover .o_documents_kanban_view': '_onHoverDrop',
        'dragleave .o_documents_kanban_view': '_onHoverLeave',
    }),
    custom_events: _.extend({}, KanbanController.prototype.custom_events, {
        archive_records: '_onArchiveRecords',
        delete_records: '_onDeleteRecords',
        document_viewer_attachment_changed: '_onDocumentViewerAttachmentChanged',
        download: '_onDownload',
        kanban_image_clicked: '_onKanbanPreview',
        lock_attachment: '_onLock',
        open_chatter: '_onOpenChatter',
        open_record: '_onOpenRecord',
        replace_file: '_onReplaceFile',
        save_multi: '_onSaveMulti',
        select_record: '_onRecordSelected',
        selection_changed: '_onSelectionChanged',
        share: '_onShareIDs',
        trigger_rule: '_onTriggerRule',
    }),

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.selectedRecordIDs = [];
        this.chatter = null;
        this.documentsInspector = null;
        this.anchorID = null; // used to select records with ctrl/shift keys
    },
    /**
     * @override
     */
    start: function () {
        this.$('.o_content').addClass('o_documents_kanban');
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {jQueryElement} $node
     */
    renderButtons: function ($node) {
        this.$buttons = $(qweb.render('DocumentsKanbanView.buttons'));
        this.$buttons.appendTo($node);
        this.$buttons.on('click', '.o_documents_kanban_share', this._onShareDomain.bind(this));
        this.$buttons.on('click', '.o_documents_kanban_upload', this._onUpload.bind(this));
        this.$buttons.on('click', '.o_documents_kanban_url', this._onUploadFromUrl.bind(this));
        this.$buttons.on('click', '.o_documents_kanban_request', this._onRequestFile.bind(this));
        this._updateButtons();
    },
    /**
     * Override to update the records selection.
     *
     * @override
     */
    update: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var state = self.model.get(self.handle, {raw: true});
            var recordIDs = _.pluck(state.data, 'res_id');
            self.selectedRecordIDs = _.intersection(self.selectedRecordIDs, recordIDs);
            self.renderer.updateSelection(self.selectedRecordIDs);
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _closeChatter: function () {
        this.$('.o_content').removeClass('o_chatter_open');
        this.$('.o_document_chatter').remove();
        if (this.chatter) {
            this.chatter.destroy();
            this.chatter = null;
        }
    },
    /**
     * Opens the chatter of the given record.
     *
     * @private
     * @param {Object} record
     * @returns {Promise}
     */
    _openChatter: function (record) {
        var self = this;
        return this.model.fetchActivities(record.id).then(function () {
            record = self.model.get(record.id);
            var $chatterContainer = $('<div>').addClass('o_document_chatter oe_chatter p-relative bg-white');
            var options = {
                display_log_button: true,
                isEditable: true,
            };
            var mailFields = {mail_thread: 'message_ids',
                          mail_followers: 'message_follower_ids',
                          mail_activity: 'activity_ids'};

            self._closeChatter();
            self.chatter = new Chatter(self, record, mailFields, options);
            return self.chatter.appendTo($chatterContainer).then(function () {
                $chatterContainer.append($('<span>').addClass('o_document_close_chatter text-center').html('&#215;'));
                self.$('.o_content').addClass('o_chatter_open');
                self.$('.o_content').append($chatterContainer);
            });
        });
    },
    /**
     * Processes the files and send them to the backend then, if the upload happened inside a share,
     * calls a new view with the domain updated for the newly uploaded files
     *
     * @private
     */
    _processFiles: function (files) {
        var self = this;
        var defs = [];
        var tagIDs = this._searchPanel.getSelectedTagIds();
        _.each(files, function (f) {
            var def = new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function (ev) {
                    resolve({
                        name: f.name,
                        datas_fname: f.name,
                        datas: ev.target.result,
                    });
                };
                reader.readAsDataURL(f);
            });
            defs.push(def);
        });
        return Promise.all(defs).then(function (fileList) {
            for (var i = 0; i < fileList.length; i++) {
                // convert data from "data:application/zip;base64,R0lGODdhAQBADs=" to "R0lGODdhAQBADs="
                fileList[i].datas = fileList[i].datas.split(',', 2)[1];
                fileList[i].folder_id = self._searchPanel.getSelectedFolderId();
                if (tagIDs) {
                    fileList[i].tag_ids = [[6, 0, tagIDs]];
                }
            }
            return self._rpc({
                model: 'documents.document',
                method: 'create',
                args: [fileList],
            });
        });
    },
    /**
     * Renders and appends the documents inspector sidebar.
     *
     * @private
     * @param {Object} state
     */
    _renderDocumentsInspector: function (state) {
        var self = this;
        var localState;
        if (this.documentsInspector) {
            localState = this.documentsInspector.getLocalState();
            this.documentsInspector.destroy();
        }
        var params = {
            recordIDs: this.selectedRecordIDs,
            state: state,
            folders: this._searchPanel.getFolders(),
            tags: this._searchPanel.getTags(),
            folderId: this._searchPanel.getSelectedFolderId(),
        };
        this.documentsInspector = new DocumentsInspector(this, params);
        this.documentsInspector.insertAfter(this.$('.o_kanban_view')).then(function () {
            if (localState) {
                self.documentsInspector.setLocalState(localState);
            }
        });
    },
    /**
     * Open the share wizard with the given context, containing either the
     * 'attachment_ids' or the 'active_domain'.
     *
     * @private
     * @param {Object} vals
     * @param {Array[]} [vals.document_ids] M2M commandsF
     * @param {Array[]} [vals.domain] the domain to share
     * @param {integer|undefined} [vals.folder_id=undefined]
     * @param {Array[]} [vals.tags] M2M commands
     * @param {string} vals.type the type of share (either 'ids' or 'domain')
     * @returns {Promise}
     */
    _share: function (vals) {
        var self = this;
        if (!vals.folder_id) {
            return;
        }
        return this._rpc({
            model: 'documents.share',
            method: 'create_share',
            args: [vals],
        }).then(function (result) {
            return self.do_action(result);
        });
    },
    /*
     * Apply rule's actions for the specified attachments.
     *
     * @private
     * @param {string[]} recordIDs
     * @param {string} ruleID
     * @returns {Promise} either returns true or an action to open
     *   a form view on the created business object (if available)
     */
    _triggerRule: function (recordIDs, ruleID) {
        var self = this;
        return this._rpc({
            model: 'documents.workflow.rule',
            method: 'apply_actions',
            args: [[ruleID], recordIDs],
        }).then(function (result) {
            if (_.isObject(result)) {
                return self.do_action(result);
            } else {
                return self.reload();
            }
        });
    },
    /**
     * Override to render the documents selector and inspector sidebars.
     * Also update the selection.
     *
     * @override
     * @private
     */
    _update: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var state = self.model.get(self.handle);
            return self._updateChatter(state).then(function () {
                self._renderDocumentsInspector(state);
                self.anchorID = null;
            });
        });
    },
    /**
     * Disables the control panel buttons if there is no selected folder.
     *
     * @override
     * @private
     */
    _updateButtons: function () {
        this._super.apply(this, arguments);
        var selectedFolderId = this._searchPanel.getSelectedFolderId();
        this.$buttons.find('.o_documents_kanban_upload').prop('disabled', !selectedFolderId);
        this.$buttons.find('.o_documents_kanban_url').prop('disabled', !selectedFolderId);
        this.$buttons.find('.o_documents_kanban_request').prop('disabled', !selectedFolderId);
        this.$buttons.find('.o_documents_kanban_share').prop('disabled', !selectedFolderId);
    },
    /**
     * If a chatter is currently open, close it and re-open it with the
     * currently selected record (if exactly one is selected).
     *
     * @private
     * @param {Object} state
     * @returns {Promise}
     */
    _updateChatter: function (state) {
        if (this.chatter) {
            // re-open the chatter if the new selection still contains 1 record
            if (this.selectedRecordIDs.length === 1) {
                var record = _.findWhere(state.data, {res_id: this.selectedRecordIDs[0]});
                if (record) {
                    return this._openChatter(record);
                }
            }
            this._closeChatter();
        }
        return Promise.resolve();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * FIXME: build a more complete archive system:
     * TODO tests
     * currently, it checks the archive state of the first record of the selection and supposes that
     * all the selected records have the same active state (since archived attachments should always be viewed
     * separately. The current system could technically cause unexpected results if the selection contains
     * records of both states.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {Object[]} ev.data.records objects with keys 'id' (the localID)
     *   and 'res_id'
     */
    _onArchiveRecords: function (ev) {
        ev.stopPropagation();
        var self = this;
        var active = !ev.data.records[0].data.active;
        var recordIDs = _.pluck(ev.data.records, 'id');
        this.model.toggleActive(recordIDs, active, this.handle).then(function () {
            self.update({}, {reload: false}); // the reload is done by toggleActive
        });
    },
    /**
     * @private
     */
    _onCloseChatter: function () {
        this._closeChatter();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {Object[]} ev.data.records objects with keys 'id' (the localID)
     *   and 'res_id'
     */
    _onDeleteRecords: function (ev) {
        ev.stopPropagation();
        var self = this;
        var recordIDs = _.pluck(ev.data.records, 'id');
        this.model.deleteRecords(recordIDs, this.modelName).then(function () {
            var resIDs = _.pluck(ev.data.records, 'res_id');
            self.selectedRecordIDs = _.difference(self.selectedRecordIDs, resIDs);
            self.reload();
        });
    },
    /**
     * Update the controller when the DocumentViewer has modified an attachment
     *
     * @private
     */
    _onDocumentViewerAttachmentChanged: function () {
        this.update();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer[]} ev.data.resIDs
     */
    _onDownload: function (ev) {
        ev.stopPropagation();
        var resIDs = ev.data.resIDs;
        if (resIDs.length === 1) {
            window.location = '/documents/content/' + resIDs[0];
        } else {
            var timestamp = moment().format('YYYY-MM-DD');
            session.get_file({
                url: '/document/zip',
                data: {
                    file_ids: resIDs,
                    zip_name: 'documents-' + timestamp + '.zip',
                },
            });
        }
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onDrop: function (ev) {
        ev.preventDefault();
        var self = this;
        var always = function () {
            self.$('.o_documents_kanban_view').removeClass('o_drop_over');
            self.$('.o_upload_text').remove();
            self.reload();
        }
        this._processFiles(ev.originalEvent.dataTransfer.files).then(always).guardedCatch(always);
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onHoverDrop: function (ev) {
        ev.preventDefault();
        this.renderer.$el.addClass('o_drop_over');
        if (this.$('.o_upload_text').length === 0) {
            var $upload_text = $('<div>').addClass("o_upload_text text-center text-white");
            $upload_text.append('<i class="d-block fa fa-upload fa-9x mb-4"/>');
            $upload_text.append('<span>' + _t('Drop files here to upload') + '</span>');
            this.$('.o_content').append($upload_text);
        }
        $(document).on('dragover:kanbanView', this._onHoverLeave.bind(this));
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onHoverLeave: function (ev) {
        if ($.contains(this.renderer.$el[0], ev.target)) {
            return;
        }

        // hack to prevent flickering when leaving kanban cards (in a 1px perimeter)
        var target = document.elementFromPoint(ev.originalEvent.clientX, ev.originalEvent.clientY);
        if ($.contains(this.renderer.$el[0], target)) {
            return;
        }

        $(document).off('dragover:kanbanView');
        this.renderer.$el.removeClass('o_drop_over');
        this.$('.o_upload_text').remove();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.recordID
     * @param {Array<Object>} ev.data.recordList
     */
    _onKanbanPreview: function (ev) {
        ev.stopPropagation();
        var documents = ev.data.recordList;
        var documentID = ev.data.recordID;
        var documentViewer = new DocumentViewer(this, documents, documentID);
        documentViewer.appendTo(this.$('.o_documents_kanban_view'));
    },
    /**
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.resID
     */
    _onLock: function (ev) {
        ev.stopPropagation();
        var self = this;
        this._rpc({
            model: 'documents.document',
            method: 'toggle_lock',
            args: [ev.data.resID],
        }).then(self.reload.bind(self), self.reload.bind(self));
    },
    /**
     * Open the chatter of the given document.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {string} ev.data.id localID of the document
     */
    _onOpenChatter: function (ev) {
        ev.stopPropagation();
        var state = this.model.get(this.handle);
        var record = _.findWhere(state.data, {id: ev.data.id});
        this._openChatter(record);
    },
    /**
     * Open a record in form view given a model and an id.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {integer} [ev.data.resID] opens the form view in create mode if
     *   not given
     * @param {string} ev.data.resModel
     */
    _onOpenRecord: function (ev) {
        ev.stopPropagation();
        var self = this;
        var always = function (result) {
            self.do_action({
                res_id: ev.data.resID,
                res_model: ev.data.resModel,
                type: 'ir.actions.act_window',
                views: [[result, 'form']],
            });
        };
        this._rpc({
            model: ev.data.resModel,
            method: 'get_formview_id',
            args: [ev.data.resID],
        }).then(always).guardedCatch(always);
    },
    /**
     * React to records selection changes to update the DocumentInspector with
     * the current selected records.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {boolean} ev.data.clear if true, unselect other records
     * @param {MouseEvent} ev.data.originalEvent the event catched by the child
     *   element triggering up the OdooEvent
     * @param {string} ev.data.resID the resID of the record updating its status
     * @param {boolean} ev.data.selected whether the record is selected or not
     */
    _onRecordSelected: function (ev) {
        ev.stopPropagation();

        // update the list of selected records (support typical behavior of
        // ctrl/shift/command muti-selection)
        var shift = ev.data.originalEvent.shiftKey;
        var ctrl = ev.data.originalEvent.ctrlKey || ev.data.originalEvent.metaKey;
        var state = this.model.get(this.handle);
        if (ev.data.clear || shift || ctrl) {
            if (this.selectedRecordIDs.length === 1 && this.selectedRecordIDs[0] === ev.data.resID) {
                // unselect the record if it is currently the only selected one
                this.selectedRecordIDs = [];
            } else if (shift && this.selectedRecordIDs.length) {
                var recordIDs = _.pluck(state.data, 'res_id');
                var anchorIndex = recordIDs.indexOf(this.anchorID);
                var selectedRecordIndex = recordIDs.indexOf(ev.data.resID);
                var lowerIndex = Math.min(anchorIndex, selectedRecordIndex);
                var upperIndex = Math.max(anchorIndex, selectedRecordIndex);
                var shiftSelection = recordIDs.slice(lowerIndex, upperIndex + 1);
                if (ctrl) {
                    this.selectedRecordIDs = _.uniq(this.selectedRecordIDs.concat(shiftSelection));
                } else {
                    this.selectedRecordIDs = shiftSelection;
                }
            } else if (ctrl && this.selectedRecordIDs.length) {
                var oldIds = this.selectedRecordIDs.slice();
                this.selectedRecordIDs = _.without(this.selectedRecordIDs, ev.data.resID);
                if (this.selectedRecordIDs.length === oldIds.length) {
                    this.selectedRecordIDs.push(ev.data.resID);
                    this.anchorID = ev.data.resID;
                }
            } else {
                this.selectedRecordIDs = [ev.data.resID];
                this.anchorID = ev.data.resID;
            }
        } else if (ev.data.selected) {
            this.selectedRecordIDs.push(ev.data.resID);
            this.selectedRecordIDs = _.uniq(this.selectedRecordIDs);
            this.anchorID = ev.data.resID;
        } else {
            this.selectedRecordIDs = _.without(this.selectedRecordIDs, ev.data.resID);
        }

        // notify the controller of the selection changes
        this.trigger_up('selection_changed', {
            selection: this.selectedRecordIDs,
        });

        this.renderer.updateSelection(this.selectedRecordIDs);
    },
    /**
     * Replace a file of the document by prompting an input file.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {integer} ev.data.id
     */
    _onReplaceFile: function (ev) {
        var self = this;
        var $upload_input = $('<input type="file" name="files[]"/>');
        $upload_input.on('change', function (e) {
            var f = e.target.files[0];
            var reader = new FileReader();
            var always = function () {
                $upload_input.removeAttr('disabled');
                $upload_input.val("");
            };
            reader.onload = function (e) {
                 // convert data from "data:application/zip;base64,R0lGODdhAQBADs=" to "R0lGODdhAQBADs="
                var dataString = e.target.result;
                var data = dataString.split(',', 2)[1];
                var mimetype = dataString.substring(
                                        dataString.indexOf(":") + 1,
                                        dataString.indexOf(";")
                                        );
                self._rpc({
                    model: 'documents.document',
                    method: 'write',
                    args: [[ev.data.id], {datas: data, mimetype: mimetype, datas_fname: f.name, name: f.name}],
                }).then(function () {
                    return self.reload();
                }).then(always).guardedCatch(always);
            };
            try {
                reader.readAsDataURL(f);
            } catch (err) {
                console.warn(err);
            }
        });
        $upload_input.click();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onRequestFile: function (ev) {
        ev.preventDefault();
        var self = this;
        this.do_action('documents.action_request_form', {
            additional_context: {
                default_folder_id: this._searchPanel.getSelectedFolderId(),
                default_tag_ids: [[6, 0, this._searchPanel.getSelectedTagIds()]],
            },
            on_close: function () {
                self.reload();
            },
        });
    },
    /**
     * Save the changes done in the DocumentsInspector and re-render the view.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onSaveMulti: function (ev) {
        ev.stopPropagation();
        this.model
            .saveMulti(ev.data.dataPointIDs, ev.data.changes, this.handle)
            .then(this.update.bind(this, {}, {}));
    },
    /**
     * React to records selection changes to update the DocumentInspector with
     * the current selected records.
     *
     * @private
     * @param {OdooEvent} ev
     * @param {integer[]} ev.data.selection the new list of selected record IDs
     */
    _onSelectionChanged: function (ev) {
        ev.stopPropagation();
        var self = this;
        this.selectedRecordIDs = ev.data.selection;
        var state = this.model.get(this.handle);
        this._updateChatter(state).then(function () {
            self._renderDocumentsInspector(state);
        });
    },
    /**
     * Share the current domain.
     *
     * @private
     */
    _onShareDomain: function () {
        var state = this.model.get(this.handle, {raw: true});
        this._share({
            domain: state.domain,
            folder_id: this._searchPanel.getSelectedFolderId(),
            tag_ids: [[6, 0, this._searchPanel.getSelectedTagIds()]],
            type: 'domain',
        });
    },
    /**
     * Share the given records.
     *
     * @param {OdooEvent} ev
     * @param {integer[]} ev.data.resIDs
     */
    _onShareIDs: function (ev) {
        ev.stopPropagation();
        this._share({
            document_ids: [[6, 0, ev.data.resIDs]],
            folder_id: this._searchPanel.getSelectedFolderId(),
            type: 'ids',
        });
    },
    /**
     * @private
     */
    _onToggleFavorite: function (ev) {
        ev.stopPropagation();
        var self = this;
        self._rpc({
            model: 'documents.document',
            method: 'toggle_favorited',
            args: [ev.data.resID],
        })
        .then(function () {
            self.reload();
        });
    },
    /**
     * Apply rule's actions for the given records in a mutex, and reload
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onTriggerRule: function (ev) {
        ev.stopPropagation();
        var recordIDs = _.pluck(ev.data.records, 'res_id');
        return this._triggerRule(recordIDs, ev.data.ruleID, this.handle);
    },
    /**
     * @private
     */
    _onUpload: function () {
        var self = this;
        var $uploadInput = $('<input>', {type: 'file', name: 'files[]', multiple: 'multiple'});
        var always = function () {
            self.reload();
            $uploadInput.remove();
        };
        $uploadInput.on('change', function (ev) {
            self._processFiles(ev.target.files).then(always).guardedCatch(always);
        });
        $uploadInput.click();
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onUploadFromUrl: function (ev) {
        ev.preventDefault();
        var self = this;
        this.do_action('documents.action_url_form', {
            additional_context: {
                default_folder_id: this._searchPanel.getSelectedFolderId(),
                default_tag_ids: [[6, 0, this._searchPanel.getSelectedTagIds()]],
            },
            on_close: function () {
                self.reload();
            },
        });
    },
});

return DocumentsKanbanController;

});
