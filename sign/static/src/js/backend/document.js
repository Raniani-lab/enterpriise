/** @odoo-module alias=sign.DocumentBackend **/

"use strict";
import AbstractAction from "web.AbstractAction";
import core from "web.core";
import { Document } from "@sign/js/common/document";
import framework from "web.framework";

const { _t } = core;

export const DocumentBackend = AbstractAction.extend({
  hasControlPanel: true,

  on_detach_callback: function () {
    core.bus.off("DOM_updated", this, this._init_page);
    return this._super.apply(this, arguments);
  },
  go_back_to_kanban: function () {
    return this.do_action("sign.sign_request_action", {
      clear_breadcrumbs: true,
    });
  },

  init: function (parent, action) {
    this._super.apply(this, arguments);
    const context = action.context;
    if (context.id === undefined) {
      return;
    }

    this.documentID = context.id;
    this.token = context.token;
    this.create_uid = context.create_uid;
    this.state = context.state;
    this.requestStates = context.request_item_states;

    this.token_list = context.token_list;
    this.name_list = context.name_list;
    this.cp_content = {};
    this.template_editable = context.template_editable;
  },
  /**
   * Callback to react to DOM_updated events. Loads the iframe and its contents
   * just after it is really in the DOM.
   *
   * @private
   */
  _init_page: async function () {
    if (this.$el.parents("html").length) {
      await this.refresh_cp();
      framework.blockUI({
        overlayCSS: { opacity: 0 },
        blockMsgClass: "o_hidden",
      });
      if (!this.documentPage) {
        this.documentPage = new (this.get_document_class())(this);
        await this.documentPage.attachTo(this.$el);
      } else {
        await this.documentPage.initialize_iframe();
      }
      await framework.unblockUI();
    }
  },
  start: async function () {
    if (this.documentID === undefined) {
      return this.go_back_to_kanban();
    }
    return Promise.all([this._super(), this.fetchDocument()]);
  },

  fetchDocument: async function () {
    const html = await this._rpc({
      route: "/sign/get_document/" + this.documentID + "/" + this.token,
      params: { message: this.message },
    });
    const $html = $(html.trim());
    const newButtons = $html
      .find(".o_sign_sign_document_button, .o_sign_refuse_document_button")
      .detach();

    this.$(".o_content").append($html);
    this.$(".o_content").addClass("o_sign_document");

    const $cols = this.$(".col-lg-4");
    const $buttonsContainer = $cols.first().remove();
    $cols.eq(1).toggleClass("col-lg-3 col-lg-4");
    $cols
      .eq(1)
      .find(".o_sign_request_from")
      .removeClass("d-flex justify-content-center flex-wrap");
    $cols.eq(2).toggleClass("col-lg-9 col-lg-4");

    const url = $buttonsContainer
      .find(".o_sign_download_document_button")
      .attr("href");
    const logUrl = $buttonsContainer
      .find(".o_sign_download_log_button")
      .attr("href");
    this.$buttons =
      this.cp_content &&
      this.cp_content.$buttons &&
      this.cp_content.$buttons.length
        ? this.cp_content.$buttons
        : $("");
    if (url) {
      this.$downloadButton = $("<a/>", {
        html: _t("Download Document"),
      }).addClass("btn btn-primary mr-2");
      this.$downloadButton.attr("href", url);
      this.$buttons = this.$buttons.add(this.$downloadButton);
    }
    if (logUrl) {
      this.$downloadLogButton = $("<a/>", {
        html: _t("Certificate"),
      }).addClass(url ? "btn btn-secondary" : "btn btn-primary");
      this.$downloadLogButton.attr("href", logUrl);
      this.$buttons = this.$buttons.add(this.$downloadLogButton);
    }

    this.$buttons = $.merge(this.$buttons, newButtons);

    if (this.$buttons.length) {
      this.cp_content = { $buttons: this.$buttons };
    }
  },

  on_attach_callback: function () {
    core.bus.on("DOM_updated", this, this._init_page);
    return this._super.apply(this, arguments);
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

export default DocumentBackend;
