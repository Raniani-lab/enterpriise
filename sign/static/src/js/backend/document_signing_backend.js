/** @odoo-module alias=sign.document_signing_backend **/

'use strict';

import core from 'web.core';
import config from 'web.config';
import { DocumentBackend } from '@sign/js/backend/document_backend';
import { document_signing } from '@sign/js/common/document_signing';

const { _t } = core;
const { qweb } = core;

var NoPubThankYouDialog = document_signing.ThankYouDialog.extend({
    template: "sign.no_pub_thank_you_dialog",
    init: function (parent, RedirectURL, RedirectURLText, requestID, options) {
        options = (options || {});
        if (!options.buttons) {
            options.buttons = [{text: _t("Ok"), close: true}];
        }
        this._super(parent, RedirectURL, RedirectURLText, requestID, options);
    },

    on_closed: function () {
        this._rpc({
            model: 'sign.request',
            method: 'go_to_document',
            args: [this.requestID],
        }).then((action) => {
            this.do_action(action);
            this.destroy();
        });
    },
});

var SignableDocument2 = document_signing.SignableDocument.extend({
    get_thankyoudialog_class: function () {
        return NoPubThankYouDialog;
    },
});

const SignableDocumentBackend = DocumentBackend.extend({
    get_document_class: function () {
        return SignableDocument2;
    },
    async start () {
        const [_, allowEdit] = await Promise.all([
            this._super(),
            this._rpc({
                model: 'sign.request',
                method: 'check_request_edit_during_sign',
                args: [this.documentID],
            })
        ])
        if(allowEdit && !config.device.isMobile) {
            this.$buttons.push($(qweb.render('sign.edit_mode_info'))[0]);
            this.updateControlPanel({cp_content: {$buttons: this.$buttons}});
        }
    }
});

core.action_registry.add('sign.SignableDocument', SignableDocumentBackend);
