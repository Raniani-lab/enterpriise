odoo.define('account_accountant.MoveLineListView', function (require) {
"use strict";

    const { insert, replace } = require('@mail/model/model_field_command');
    const { WebClientViewAttachmentViewContainer } = require('@mail/components/web_client_view_attachment_view_container/web_client_view_attachment_view_container');

    var config = require('web.config');
    var core = require('web.core');
    var ListController = require('web.ListController');
    var ListModel = require('web.ListModel');
    var ListRenderer = require('web.ListRenderer');
    var localStorage = require('web.local_storage');
    var ListView = require('web.ListView');
    var viewRegistry = require('web.view_registry');
    const { ComponentWrapper } = require('web.OwlCompatibility');

    var _t = core._t;

    var AccountMoveListModel = ListModel.extend({
        /**
         * Overridden to fetch extra fields even if `move_attachment_ids` is
         * invisible in the view.
         *
         * @override
         * @private
         */
        _fetchRelatedData: function (list, toFetch, fieldName) {
            if (fieldName === 'move_attachment_ids' && config.device.size_class >= config.device.SIZES.XXL) {
                var fieldsInfo = list.fieldsInfo[list.viewType][fieldName];
                // force to fetch extra fields
                fieldsInfo.__no_fetch = false;
                fieldsInfo.relatedFields = {
                    mimetype: { type: 'char' },
                };
            }
            return this._super.apply(this, arguments);
        },
    });

    var AccountMoveListController = ListController.extend({
        events: _.extend({}, ListController.prototype.events, {
            'click .o_attachment_control': '_onToggleAttachment',
        }),
        custom_events: _.extend({}, ListController.prototype.custom_events, {
            row_selected: '_onRowSelected',
        }),

        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);

            this.currentAttachments = [];
            this.hide_attachment = localStorage.getItem('account.move_line_pdf_previewer_hidden') === 'true';
            this.last_selected = false;

        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Overridden to add an attachment preview container.
         *
         * @override
         * @private
         */
        _update: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                self.$('.o_content').addClass('o_move_line_list_view');
                self.currentAttachments = [];
                if (!self.$attachmentPreview && config.device.size_class >= config.device.SIZES.XXL) {
                    self.$attachmentPreview = $('<div>', { class: 'o_attachment_preview' });
                    self.$attachmentPreview.append($('<p>', {
                        class: 'text-center',
                        text: _t("Choose a line to preview its attachments."),
                    }));
                    self.$attachmentPreview.append($('<div>', { class: 'o_attachment_control' }));
                    self.$attachmentPreview.appendTo(self.$('.o_content'));
                    self.$attachmentPreview.toggleClass('hidden', self.hide_attachment);
                }
            }).then(function () {
                if (!self.hide_attachment) {
                    self._renderAttachmentPreview();
                }
            });
        },
        /**
         * Renders a preview of a record attachments.
         *
         * @param {string} recordId
         * @private
         */
        async _renderAttachmentPreview(recordId) {
            var self = this;
            if (_.filter(this.model.localData, function(value, key, object) {return value.groupData == self.last_selected}).length) {
                recordId = _.filter(this.model.localData, function(value, key, object) {return value.groupData == self.last_selected})[0].data[0]
            }
            if (!recordId) {
                return Promise.resolve();
            }
            var record = this.model.get(recordId || this.last_selected);
            // record type will be list when multi groupby while expanding group row
            if (record.type === 'list') {
                return;
            }
            const messaging = await owl.Component.env.services.messaging.get();
            const thread = messaging.models['Thread'].insert({
                attachments: insert(record.data.move_attachment_ids.data.map(function (attachment) {
                    return {
                        id: attachment.data.id,
                        mimetype: attachment.data.mimetype,
                    };
                })),
                id: record.data.move_id.res_id,
                model: record.data["move_id"].model,
            });
            thread.update({ mainAttachment: replace(thread.attachments[0]) });
            const attachments = thread.attachmentsInWebClientView;
            if (!this.webClientViewAttachmentViewContainer) {
                this.webClientViewAttachmentViewContainer = new ComponentWrapper(this, WebClientViewAttachmentViewContainer, {
                    threadId: thread.id,
                    threadModel: thread.model,
                });
                await this.webClientViewAttachmentViewContainer.mount(this.$attachmentPreview.empty()[0]);
            } else {
                await this.webClientViewAttachmentViewContainer.update({
                    threadId: thread.id,
                    threadModel: thread.model,
                });
            }
            return Promise.resolve().then(() => {
                self.currentAttachments = attachments;
                if (!attachments.length) {
                    if (this.webClientViewAttachmentViewContainer) {
                        this.webClientViewAttachmentViewContainer.destroy();
                        this.webClientViewAttachmentViewContainer = undefined;
                    }
                    var $empty = $('<p>', {
                        class: 'text-center',
                        text: _t("No attachments linked."),
                    });
                    self.$attachmentPreview.empty().append($empty);
                }
                self.$attachmentPreview.find("div.o_attachment_control").remove();
                $('<div>', { class: 'o_attachment_control' }).appendTo(self.$attachmentPreview);
            });
        },

        _onToggleAttachment: function () {
            this.hide_attachment = !this.hide_attachment;
            localStorage.setItem('account.move_line_pdf_previewer_hidden', this.hide_attachment);
            this.$attachmentPreview.toggleClass('hidden');
            if (!this.hide_attachment) {
                this._renderAttachmentPreview(this.last_selected);
            }
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {OdooEvent} ev
         * @param {string} ev.data.recordId
         */
        _onRowSelected: function (ev) {
            if (config.device.size_class >= config.device.SIZES.XXL) {
                this.last_selected = ev.data.recordId;
                if (this.last_selected.includes('line') && !this.hide_attachment) { // if it comes from _onToggleGroup, this._update is triggered but not if it comes from _selectRow
                    this._renderAttachmentPreview(ev.data.recordId);
                }
            }
        },
    });
    var AccountMoveListRenderer = ListRenderer.extend({
        events: Object.assign({}, ListRenderer.prototype.events, {
            'mouseover .o_list_table_grouped tbody tr': '_onToggleGroupButton',
            'mouseout .o_list_table_grouped tbody tr': '_onToggleGroupButton',
        }),

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         *
         * @param {integer} rowIndex
         * @private
         * @override
         */
        _selectRow: function (rowIndex) {
            var self = this;
            var recordId = this._getRecordID(rowIndex);
            var currentRow = this.currentRow; // currentRow is updated in _super
            return this._super.apply(this, arguments).then(function () {
                if (rowIndex !== currentRow) {
                    self.trigger_up('row_selected', {
                        recordId: recordId,
                    });
                }
            });
        },

        /*
         * Show pdf when using mouse
         */
        _onRowClicked: function (ev) {
            ev.stopPropagation();
            var id = $(ev.currentTarget).data('id');
            if (id) {
                this.trigger_up('row_selected', {
                    recordId: id,
                });
            }
            return this._super.apply(this, arguments);
        },

        /*
         * Show pdf when using keys
         */
        _findConnectedCell: function ($cell, direction, colIndex) {
            var res = this._super.apply(this, arguments);
            var id = res && res.closest('tr').data('id');
            if (id) {
                this.trigger_up('row_selected', {
                    recordId: id,
                });
            }
            return res;
        },

        _onToggleGroup: function (ev) {
            var group = $(ev.currentTarget).closest('tr').data('group');
            if (group.model === 'account.move.line' && group.groupData && group.groupData.model === 'account.move') {
                this.trigger_up('row_selected', {
                    recordId: group.groupData.id,
                });
            }
            this._super.apply(this, arguments);
        },
        /**
         * Toggle group buttons on mouseover and mouseout on group header or
         * its content.
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onToggleGroupButton: function (ev) {
            let tr = ev.currentTarget;
            let groupHeader;
            if (tr.classList.contains('o_group_header') && tr.querySelector(".o_group_buttons")) {
                // we are hovering the group header itself
                groupHeader = tr;
            } else {
                let tbody = ev.currentTarget.closest('tbody');
                while (tbody && !tbody.querySelector(".o_group_buttons")) {
                    tbody = tbody.previousElementSibling;
                }
                if (tbody) {
                    groupHeader = tbody.querySelector(".o_group_header.o_group_open");
                }
            }
            if (groupHeader) {
                groupHeader.classList.toggle("show_group_buttons");
            }
        },
    });

    var AccountMoveListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: AccountMoveListController,
            Model: AccountMoveListModel,
            Renderer: AccountMoveListRenderer,
        }),
    });

    viewRegistry.add('account_move_line_list', AccountMoveListView);

    return {
        AccountMoveListView: AccountMoveListView,
        AccountMoveListController: AccountMoveListController,
        AccountMoveListModel: AccountMoveListModel,
        AccountMoveListRenderer: AccountMoveListRenderer,
    };
});
