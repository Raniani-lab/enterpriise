/** @odoo-module **/

'use strict';
import AbstractAction from 'web.AbstractAction';
import core from 'web.core';
import { Document } from '@sign/js/common/document';
import framework from 'web.framework';

var _t = core._t;

export const DocumentBackend = AbstractAction.extend({
    hasControlPanel: true,

    destroy: function () {
        core.bus.off('DOM_updated', this, this._init_page);
        return this._super.apply(this, arguments);
    },
    go_back_to_kanban: function () {
        return this.do_action("sign.sign_request_action", {
            clear_breadcrumbs: true,
        });
    },

    init: function (parent, action) {
        this._super.apply(this, arguments);
        var context = action.context;
        if(context.id === undefined) {
            return;
        }

        this.documentID = context.id;
        this.token = context.token;
        this.create_uid = context.create_uid;
        this.state = context.state;
        this.requestStates = context.request_item_states;

        this.current_name = context.current_signor_name;
        this.token_list = context.token_list;
        this.name_list = context.name_list;
        this.cp_content = {};
    },
    /**
     * Callback to react to DOM_updated events. Loads the iframe and its contents
     * just after it is really in the DOM.
     *
     * @private
     * @returns {Promise|undefined}
     */
    _init_page: function () {
        var self = this;
        if(this.$el.parents('html').length) {
            return this.refresh_cp().then(function () {
                framework.blockUI({overlayCSS: {opacity: 0}, blockMsgClass: 'o_hidden'});
                if (!self.documentPage) {
                    self.documentPage = new (self.get_document_class())(self);
                    return self.documentPage.attachTo(self.$el);
                } else {
                    return self.documentPage.initialize_iframe();
                }
            }).then(function () {
                framework.unblockUI();
            });
        }
    },
    start: function () {
        var self = this;
        if(this.documentID === undefined) {
            return this.go_back_to_kanban();
        }
        var def = this._rpc({
            route: '/sign/get_document/' + this.documentID + '/' + this.token,
            params: {message: this.message}
        }).then(function(html) {

            var $html = $(html.trim());
            var $signDocumentButton = $html.find('.o_sign_sign_document_button').detach();

            self.$('.o_content').append($html);
            self.$('.o_content').addClass('o_sign_document');

            var $cols = self.$('.col-lg-4');
            var $buttonsContainer = $cols.first().remove();
            $cols.eq(1).toggleClass( 'col-lg-3 col-lg-4');
            $cols.eq(1).find('.o_sign_request_from').removeClass('d-flex justify-content-center flex-wrap');
            $cols.eq(2).toggleClass( 'col-lg-9 col-lg-4');

            var url = $buttonsContainer.find('.o_sign_download_document_button').attr('href');
            var logUrl = $buttonsContainer.find('.o_sign_download_log_button').attr('href');
            self.$buttons = (self.cp_content && self.cp_content.$buttons && self.cp_content.$buttons.length) ? self.cp_content.$buttons : $('');
            if (url) {
                self.$downloadButton = $('<a/>', {html: _t("Download Document")}).addClass('btn btn-primary mr-2');
                self.$downloadButton.attr('href', url);
                self.$buttons = self.$buttons.add(self.$downloadButton);
            }
            if (logUrl) {
                self.$downloadLogButton = $('<a/>', {html: _t("Certificate")}).addClass(url ? 'btn btn-secondary' : 'btn btn-primary');
                self.$downloadLogButton.attr('href', logUrl);
                self.$buttons = self.$buttons.add(self.$downloadLogButton);
            }
            if ($signDocumentButton)
                self.$buttons = $signDocumentButton.add(self.$buttons);

            if (self.$buttons.length){
                self.cp_content = {$buttons: self.$buttons};
            }
            core.bus.on('DOM_updated', self, self._init_page);
        });
        return Promise.all([this._super(), def]);
    },

    get_document_class: function () {
        return Document;
    },

    refresh_cp: function () {
        return this.updateControlPanel({
            cp_content: this.cp_content,
        });
    },
});
