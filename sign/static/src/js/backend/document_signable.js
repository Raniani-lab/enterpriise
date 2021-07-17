/** @odoo-module alias=sign.document_signing_backend **/

"use strict";

import core from "web.core";
import config from "web.config";
import { DocumentBackend } from "@sign/js/backend/document";
import { document_signable } from "@sign/js/common/document_signable";

const { _t } = core;
const { qweb } = core;

const NoPubThankYouDialog = document_signable.ThankYouDialog.extend({
  template: "sign.no_pub_thank_you_dialog",
  init: function (parent, RedirectURL, RedirectURLText, requestID, accessToken, options) {
    options = options || {};
    if (!options.buttons) {
      options.buttons = [{ text: _t("Ok"), close: true }];
    }
    this._super(parent, RedirectURL, RedirectURLText, requestID, accessToken, options);
  },

  on_closed: async function () {
    const action = await this._rpc({
      model: "sign.request",
      method: "go_to_document",
      args: [this.requestID],
    });

    this.do_action(action);
    this.destroy();
  },
});

const SignableDocument2 = document_signable.SignableDocument.extend({
  get_thankyoudialog_class: function () {
    return NoPubThankYouDialog;
  },
});

const SignableDocumentBackend = DocumentBackend.extend({
  get_document_class: function () {
    return SignableDocument2;
  },
  async start() {
    await this._super();
    if (this.template_editable && !config.device.isMobile) {
      this.$buttons.push($(qweb.render("sign.edit_mode_info"))[0]);
      this.updateControlPanel({ cp_content: { $buttons: this.$buttons } });
    }
  },
});

core.action_registry.add("sign.SignableDocument", SignableDocumentBackend);
