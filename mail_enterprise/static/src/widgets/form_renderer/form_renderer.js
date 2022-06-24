/** @odoo-module **/

import config from 'web.config';
import dom from 'web.dom';
import FormRenderer from 'web.FormRenderer';
import AttachmentViewer from '@mail_enterprise/js/attachment_viewer';

// ensure `.include()` on `mail` is applied before `mail_enterprise`
import '@mail/widgets/form_renderer/form_renderer';

/**
 * Display attachment preview on side of form view for large screen devices.
 *
 * To use this simply add div with class o_attachment_preview in format
 *     <div class="o_attachment_preview"/>
**/

FormRenderer.include({
    //--------------------------------------------------------------------------
    // Form Overrides
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);

        this.$attachmentPreview = undefined;
        this.attachmentPreviewResID = undefined;
        this.attachmentViewer = undefined;
        /**
         * Tracked thread of rendered attachments by attachment viewer.
         *
         * Useful for updating attachment viewer in case the thread linked to
         * the attachments has been changed.
         *
         * Note that attachment viewer only requires attachments, but attachment
         * viewer is not that well designed to update its content solely based
         * on provided list attachments (until rewritten using OWL).
         *
         * In the meantime, it updates its content on change of thread and on
         * change of amount of attachments. This doesn't cover some corner cases
         * (like new list with same length and same thread), but it's good enough
         * for the time being.
         */
        this._attachmentViewerThread = undefined;
        this._onResizeWindow = _.debounce(this._onResizeWindow.bind(this), 200);
    },
    /**
     * @override
     */
    start() {
        window.addEventListener('resize', this._onResizeWindow);
        return this._super(...arguments);
    },
    /**
     * Overrides the function that renders the nodes to return the preview's $el
     * for the `o_attachment_preview` div node.
     *
     * @override
     */
    _renderNode(node) {
        if (node.tag === 'div' && node.attrs.class === 'o_attachment_preview') {
            if (this.attachmentViewer) {
                if (this.attachmentPreviewResID !== this.state.res_id) {
                    this.attachmentViewer.destroy();
                    this.attachmentViewer = undefined;
                }
            } else {
                this.$attachmentPreview = $('<div>', { class: 'o_attachment_preview' });
            }
            this._handleAttributes(this.$attachmentPreview, node);
            this._registerModifiers(node, this.state, this.$attachmentPreview);
            if (this.attachmentPreviewWidth) {
                this.$attachmentPreview.css('width', this.attachmentPreviewWidth);
            }
            return this.$attachmentPreview;
        } else {
            return this._super.apply(this, arguments);
        }
    },
    /**
     * Overrides the function to interchange the chatter and the preview once
     * the chatter is in the dom.
     *
     * @override
     */
    async _renderView() {
        await this._super(...arguments);
        if (!this.hasChatter) {
            return;
        }
        this._interchangeChatter();
    },
    /**
     * @override
     */
    destroy() {
        window.removeEventListener('resize', this._onResizeWindow);
        this._super();
    },

    //--------------------------------------------------------------------------
    // Mail Methods
    //--------------------------------------------------------------------------

    /**
     * @returns {boolean}
     */
    hasAttachmentViewer() {
        return (
            config.device.size_class >= config.device.SIZES.XXL &&
            this.$attachmentPreview && !this.$attachmentPreview.hasClass('o_invisible_modifier') &&
            this.attachmentPreviewResID && this.attachmentPreviewResID === this.state.res_id
        );
    },
    /**
     * @override
     */
    _isChatterAside() {
        const parent = this._chatterContainerTarget && this._chatterContainerTarget.parentNode;
        return (
            config.device.size_class >= config.device.SIZES.XXL &&
            !this.hasAttachmentViewer() &&
            // We also test the existance of parent.classList. At start of the
            // form_renderer, parent is a DocumentFragment and not the parent of
            // the chatter. DocumentFragment doesn't have a classList property.
            !(parent && parent.classList && (parent.classList.contains('o_form_sheet') || parent.classList.contains('tab-pane')))
        );
    },
    /**
     * Interchange the position of the chatter and the attachment preview.
     *
     * @private
     */
     _interchangeChatter() {
        const $sheetBg = this.$('.o_form_sheet_bg');
        this._updateChatterContainerTarget();
        if (this.hasAttachmentViewer()) {
            this.$attachmentPreview.insertAfter($sheetBg);
            dom.append($sheetBg, $(this._chatterContainerTarget), {
                callbacks: [{ widget: this.chatter }],
                in_DOM: this._isInDom,
            });
        } else {
            $(this._chatterContainerTarget).insertAfter($sheetBg);
            dom.append($sheetBg, this.$attachmentPreview, {
                callbacks: [],
                in_DOM: this._isInDom,
            });
        }
        this._updateChatterContainerComponent();
    },
    /**
     * @override
     */
    _makeChatterContainerProps() {
        const props = this._super(...arguments);
        return Object.assign(props, {
            isInFormSheetBg: this.hasAttachmentViewer(),
        });
    },
    /**
     * Triggered from the mail chatter, send attachments data for preview
     *
     * @override
     * @private
     * @param {OdooEvent} ev
     * @param {Object} ev.data
     * @param {Attachment[]} ev.data.attachments
     * @param {Thread} ev.data.thread
     */
    _onChatterRendered(ev) {
        if (config.device.size_class < config.device.SIZES.XXL) {
            return;
        }
        if (!this.$attachmentPreview || this.$attachmentPreview.hasClass('o_invisible_modifier')) {
            return;
        }
        var self = this;
        const thread = ev.data.thread;
        const attachments = thread.attachmentsInWebClientView;
        if (attachments.length || this.attachmentViewer) {
            if (this.attachmentViewer) {
                // FIXME should be improved : what if somehow an attachment is replaced in a thread ?
                if (
                    this._attachmentViewerThread !== thread ||
                    this.attachmentViewer.attachments.length !== attachments.length
                ) {
                    if (!attachments.length) {
                        this.attachmentViewer.destroy();
                        this.attachmentViewer = undefined;
                        this.attachmentPreviewResID = undefined;
                        this._interchangeChatter();
                    } else {
                        this.attachmentViewer.updateContents(thread);
                    }
                } else {
                    // The attachmentViewer lose its event listeners when it is reused,
                    // we just need to reregister them.
                    if (this.attachmentViewer.$el) {
                        this.attachmentViewer._undelegateEvents();
                        this.attachmentViewer._delegateEvents();
                    }
                }
                this.trigger_up('preview_attachment_validation');
                this._updateChatterContainerTarget();
            } else {
                this.attachmentPreviewResID = this.state.res_id;
                this.attachmentViewer = new AttachmentViewer(this, thread);
                this.attachmentViewer.appendTo(this.$attachmentPreview).then(function () {
                    self.trigger_up('preview_attachment_validation');
                    self.$attachmentPreview.resizable({
                        handles: 'w',
                        minWidth: 400,
                        maxWidth: 900,
                        resize: function (event, ui) {
                            self.attachmentPreviewWidth = ui.size.width;
                        },
                    });
                    self._interchangeChatter();
                });
            }
        }
        this._attachmentViewerThread = thread;
    },
    /**
     * Reflects the move of chatter (from aside to underneath of form sheet or
     * the other way around) into classes and component props to allow theming
     * to be adapted
     *
     * @private
     * @param {Event} ev
     */
    _onResizeWindow(ev) {
        if (this._chatterContainerComponent) {
            this._interchangeChatter();
        }
        this._applyFormSizeClass();
    },
    /**
     * @override
     */
    _updateChatterContainerTarget() {
        this._super();
        if (this.hasAttachmentViewer()) {
            this._chatterContainerTarget.classList.add('o-isInFormSheetBg');
        } else {
            this._chatterContainerTarget.classList.remove('o-isInFormSheetBg');
        }
    },
});
