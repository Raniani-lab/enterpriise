/** @odoo-module **/

'use strict';

import core from 'web.core';
import session from 'web.session';
import { DocumentBackend } from '@sign/js/backend/document_backend';
import multiFileUpload from 'sign.multiFileUpload';

var _t = core._t;

var EditableDocumentBackend = DocumentBackend.extend({
    events: {
        'click .o_sign_resend_access_button': function(e) {
            var $envelope = $(e.target);
            this._rpc({
                    model: 'sign.request.item',
                    method: 'resend_access',
                    args: [parseInt($envelope.parent('.o_sign_signer_status').data('id'))],
                    context: session.user_context,
                })
                .then(function() { $envelope.html(_t("Resent !")); });
        },
    },

    init: function(parent, action, options) {
        this._super.apply(this, arguments);

        var self = this;

        this.is_author = (this.create_uid === session.uid);
        this.is_sent = (this.state === 'sent');

        if (action && action.context && action.context.sign_token) {
            var $signButton = $('<button/>', {html: _t("Sign Document"), type: "button", 'class': 'btn btn-primary mr-2'});
            $signButton.on('click', function () {
                self.do_action({
                    type: "ir.actions.client",
                    tag: 'sign.SignableDocument',
                    name: _t('Sign'),
                }, {
                    additional_context: _.extend({}, action.context, {
                        token: action.context.sign_token,
                    }),
                });
            });
            if (this.cp_content) {
                this.cp_content.$buttons = $signButton.add(this.cp_content.$buttons);
            }
        }
    },

    start: function() {
        var self = this;
        const nextTemplate = multiFileUpload.getNext();

        if (nextTemplate && nextTemplate.template) {
            let nextDocumentButton = $('<button/>', {html: _t("Next Document"), type: "button", 'class': 'btn btn-primary mr-2'});
            nextDocumentButton.on('click', function () {
                multiFileUpload.removeFile(nextTemplate.template);
                self.do_action({
                    type: "ir.actions.client",
                    tag: 'sign.Template',
                    name: _.str.sprintf(_t('Template "%s"'), nextTemplate.name),
                    context: {
                        sign_edit_call: 'sign_send_request',
                        id: nextTemplate.template,
                        sign_directly_without_mail: false,
                    }
                }, {clear_breadcrumbs: true});
            });
            if (self.cp_content) {
                self.cp_content.$buttons = nextDocumentButton.add(self.cp_content.$buttons);
            }
        }

        return this._super.apply(this, arguments).then(function () {
            if(self.is_author && self.is_sent) {
                self.$('.o_sign_signer_status').not('.o_sign_signer_signed').each(function(i, el) {
                    $(el).append($('<button/>', {
                        type: 'button',
                        title: (self.requestStates && self.requestStates[this.dataset.id]) ? _t("Resend the invitation"): _t("Send the invitation"),
                        text: (self.requestStates && self.requestStates[this.dataset.id]) ? _t("Resend"): _t("Send"),
                        class: 'o_sign_resend_access_button btn btn-link ml-2 mr-2',
                        style: 'vertical-align: baseline;',
                    }));
                });
            }
        });
    },
});

core.action_registry.add('sign.Document', EditableDocumentBackend);
