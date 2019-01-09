odoo.define('mrp.pdf_viewer_no_reload', function (require) {
"use strict";

var fieldRegistry = require('web.field_registry');
var basicFields = require('web.basic_fields');

var FieldPdfViewer = basicFields.FieldPdfViewer;

/**
 * /!\/!\/!\ WARNING /!\/!\/!\
 * Do not use this widget else where
 * Due to limitation of the framework, a lot of hacks have been used
 * 
 * Override of the default PDF Viewer Widget to prevent reload of the iFrame content
 * on any action (typically, click on a button)
 */

var FieldPdfViewerNoReload = FieldPdfViewer.extend({
    supportedFieldTypes: ['binary'],
    template: 'FieldPdfViewer',
    formFixedHeight: '250px',

    /**
     * @override
     */
    init: function (parent, name, record, options) {
        this._super.apply(this, arguments);
        this.iFrameId = (record.id + '.' + name).replace(/\./g, "_");
        this.invisible = this._isInvisible(parent);
    },

    /**
     * Do not start the widget in the normal lifecycle
     * The first start will be called in the on_attach_callback
     * After that, this start will just update the active page
     *
     * @override
     */
    start: function () {
        this._superStart = this._super;
        var $existing = $('#' + this.iFrameId);

        if ($existing.length) {
            this.$el.hide();

            if (!this.invisible){
                this.pdfViewer = $existing.data('pdfViewer');
                this._goToPage(this.recordData[this.name + '_page'] || 1);
            }
            $existing.toggleClass('o_invisible_modifier', this.invisible);
        }

        this._fixFormHeight();

        return $.when();
    },

    /**
     * Gets called when parent is attached to DOM
     *
     * @override
     */
    on_attach_callback: function (){
        this._fixFormHeight();
        this._moveAndInitIFrame();
    },


    /**
     * Don't destroy this widget.
     *
     * @override
     */
    destroy: function () {},

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * After Goto page, it's possible that the PDFViewerApp will
     * still reset the page to last viewed. So this function will
     * check after a longer time if the page is still set to what
     * we want.
     *
     * @param {string} page
     * @private
     */
    _checkCorrectPage: function (page){
        var self = this;
        setTimeout(function (){
            if (self.pdfViewer && page !== self.pdfViewer.currentPageNumber){
                self._goToPage(page);
            }
        }, 500);
    },

    /**
     * Set Form top part to be fixed height to avoid flickers
     * If iFrame is hidden, show full height of form
     *
     * @private
     */
    _fixFormHeight: function (){
        var $form = $('.o_form_view.o_workorder_tablet');
        if ($form.length) {
            if (this.invisible) {
                $form.height('100%');
            } else {
                $form.css('height', this.formFixedHeight);
            }
        }
    },

    /**
     * Try to go to page
     * The PDFViewerApp will try to reset to the last viewed page
     * several times when the iFrame resizes, so we have to wait a few ms,
     * then try to scroll. Could be called several times.
     *
     * TODO: Find a better way to do this ...
     *
     * @param {string} page
     * @private
     */
    _goToPage: function (page){
        var self = this;
        if (self.pdfViewer && page !== self.pdfViewer.currentPageNumber){
            setTimeout(function (){
                self.pdfViewer.currentPageNumber = page;
                self._goToPage(page);
            }, 200);
        } else {
            this._checkCorrectPage(page);
        }
    },

    /**
     * We have to re_compute the value of the modifier because
     * it is not update yet by the rendered. So the state is the state
     * of the previous Widget. Usually, it's ok because the modifiers are applied
     * after the start(), but since we detached this widget from the framework, it's broken.
     *
     * @param {Object} parent
     * @private
     */
    _isInvisible: function (parent){
        var self = this;
        var invisible = false;
        _.forEach(parent.allModifiersData, function (item){
            if (item.node.attrs.name === self.name && item.node.attrs.widget === "mrp_pdf_viewer_no_reload") {
                invisible = item.evaluatedModifiers[self.record.id].invisible;
                return;
            }
        });
        return invisible;
    },

    /**
     * Move the iFrame out of the Odoo Form rendered
     * So that it will not be destroyed along the Form DOM
     * Also call _super.start after the DOM is moved to avoid double loading
     *
     * @private
     */
    _moveAndInitIFrame: function (){
        var $el = this.$el;
        var $iFrame = $el.find('iframe');
        var $controller = $el.closest('.content.o_workorder_tablet');

        // Save the PDFViewerApp on the DOM element since this widget will be destroyed on any action
        $iFrame.on('load', function () {
            if (this.contentWindow.window.PDFViewerApplication){
                $el.data('pdfViewer', this.contentWindow.window.PDFViewerApplication.pdfViewer);
            }
        });

        // Appended to the controller, since the controller DOM is not destroyed
        $el.appendTo($controller);

        // Add unique ID to get it back after the next destroy/start cycle
        // Wrap it in "div.workorder_pdf" to keep the CSS style
        $el.attr('id', this.iFrameId).wrap('<div class="workorder_pdf"/>');

        // Initialize the Widget only when it has been moved in the DOM
        this._superStart.apply(this, arguments);
    },
});

fieldRegistry.add('mrp_pdf_viewer_no_reload', FieldPdfViewerNoReload);

return FieldPdfViewerNoReload;
});