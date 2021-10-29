/** @odoo-module alias=sign.document_edition **/

"use strict";

import core from "web.core";
import session from "web.session";
import { DocumentBackend } from "@sign/js/backend/document_backend";
import { multiFileUpload } from "@sign/js/common/multi_file_upload";
import { sprintf } from "@web/core/utils/strings";

const { _t } = core;

const EditableDocumentBackend = DocumentBackend.extend({
  events: {
    "click .o_sign_resend_access_button": function (e) {
      const $envelope = $(e.target);
      this._rpc({
        model: "sign.request.item",
        method: "resend_access",
        args: [parseInt($envelope.parent(".o_sign_signer_status").data("id"))],
        context: session.user_context,
      }).then(() => {
        $envelope.empty().append(_t("Resent !"));
      });
    },
  },

  init: function (parent, action, options) {
    this._super.apply(this, arguments);

    this.is_author = this.create_uid === session.uid;
    this.is_sent = this.state === "sent";

    if (action && action.context && action.context.sign_token) {
      const $signButton = $("<button/>", {
        html: _t("Sign Document"),
        type: "button",
        class: "btn btn-primary mr-2",
      });
      $signButton.on("click", () => {
        this.do_action(
          {
            type: "ir.actions.client",
            tag: "sign.SignableDocument",
            name: _t("Sign"),
          },
          {
            additional_context: Object.assign({}, action.context, {
              token: action.context.sign_token,
            }),
          }
        );
      });
      if (this.cp_content) {
        this.cp_content.$buttons = $signButton.add(this.cp_content.$buttons);
      }
    }
  },

  start: function () {
    const nextTemplate = multiFileUpload.getNext();

    if (nextTemplate && nextTemplate.template) {
      const nextDocumentButton = $("<button/>", {
        html: _t("Next Document"),
        type: "button",
        class: "btn btn-primary mr-2",
      });
      nextDocumentButton.on("click", () => {
        multiFileUpload.removeFile(nextTemplate.template);
        this.do_action(
          {
            type: "ir.actions.client",
            tag: "sign.Template",
            name: sprintf(_t('Template "%s"'), nextTemplate.name),
            context: {
              sign_edit_call: "sign_send_request",
              id: nextTemplate.template,
              sign_directly_without_mail: false,
            },
          },
          { clear_breadcrumbs: true }
        );
      });
      if (this.cp_content) {
        this.cp_content.$buttons = nextDocumentButton.add(
          this.cp_content.$buttons
        );
      }
    }

    return this._super.apply(this, arguments).then(() => {
      if (this.is_author && this.is_sent) {
        this.$(".o_sign_signer_status")
          .not(".o_sign_signer_signed")
          .each((i, el) => {
            $(el).append(
              $("<button/>", {
                type: "button",
                title:
                  this.requestStates && this.requestStates[el.dataset.id]
                    ? _t("Resend the invitation")
                    : _t("Send the invitation"),
                text:
                  this.requestStates && this.requestStates[el.dataset.id]
                    ? _t("Resend")
                    : _t("Send"),
                class: "o_sign_resend_access_button btn btn-link ml-2 mr-2",
                style: "vertical-align: baseline;",
              })
            );
          });
      }
    });
  },
});

core.action_registry.add("sign.Document", EditableDocumentBackend);
