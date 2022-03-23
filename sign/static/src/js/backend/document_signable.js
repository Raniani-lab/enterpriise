/** @odoo-module alias=sign.document_signing_backend **/

"use strict";

import core from "web.core";
import config from "web.config";
import { DocumentAction } from "@sign/js/backend/document";
import { document_signable } from "@sign/js/common/document_signable";

const { _t } = core;

const NoPubThankYouDialog = document_signable.ThankYouDialog.extend({
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

document_signable.SignableDocument.include({
  init: function () {
    this._super.apply(this, arguments);
    this.events = Object.assign(this.events || {}, {
      "click .o_sign_edit_button": 'toggleToolBar',
    });
  },

  get_thankyoudialog_class: function () {
    return NoPubThankYouDialog;
  },

  get_pdfiframe_class: function () {
    const PDFIframeWithToolbar = this._super.apply(this, arguments).extend({
      // Currently only Signature, Initials, Text are allowed to be added while signing
      getToolbarTypesArray: function() {
        return Object.values(this.types).filter((v) => ["Signature", "Initials", "Text"].includes(v["name"]));
      },

      postItemClone: function (signItems) {
        signItems.forEach(($signItem) => {
          this.postItemDrop($signItem);
        })
      },

      postItemDrop: function ($signItem) {
        this.registerCreatedSignItemEvents(
          $signItem,
          $signItem.data('typeData'),
          true
        );
        this.checkSignItemsCompletion();
      },

      _doPDFFullyLoaded: function () {
        this._super.apply(this, arguments);

        // add field type toolbar for edit mode while signing
        if (!this.readonlyFields &&
          this.templateEditable &&
          !config.device.isMobile
        ) {
          this.currentRole = this.role;
          this.parties = {};
          this.parties[this.role] = {'name': this.roleName};
          this.isSignItemEditable = true;

          this.$fieldTypeToolbar.toggleClass('d-flex d-none');
          this.$iframe.parents('.o_action').find('.o_sign_edit_button').toggleClass('d-none');
        }
      },

      enableCustom: function ($signatureItem) {
        // allow new added sign items to be deleted by the fa-times button
        const $configArea = $signatureItem.find(".o_sign_config_area");
        $configArea
          .find(".fa-times")
          .off("click").on("click", () => {
            delete this.signatureItems[$signatureItem.data("item-id")];
            this.deleteSignItem($signatureItem);
            this.checkSignItemsCompletion();
          });

        this._super.apply(this, arguments);
      },
    })
    return PDFIframeWithToolbar
  },

  toggleToolBar: function (e) {
    this.iframeWidget.$("#outerContainer").toggleClass("o_sign_field_type_toolbar_visible");
    this.iframeWidget.$fieldTypeToolbar.toggleClass('d-flex d-none');
    this.iframeWidget.signatureItemNav.$el.toggleClass("o_sign_field_type_toolbar_visible");
  },
});

const SignableDocumentAction = DocumentAction.extend({
  get_document_class: function () {
    return document_signable.SignableDocument;
  },
});

core.action_registry.add("sign.SignableDocument", SignableDocumentAction);
