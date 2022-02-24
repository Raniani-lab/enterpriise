/** @odoo-module **/

"use strict";

import config from "web.config";
import core from "web.core";
import Dialog from "web.Dialog";
import { sprintf } from "@web/core/utils/strings";
import KanbanController from "web.KanbanController";
import KanbanColumn from "web.KanbanColumn";
import KanbanView from "web.KanbanView";
import KanbanRenderer from 'web.KanbanRenderer';
import KanbanRecord from "web.KanbanRecord";
import ListController from "web.ListController";
import ListView from "web.ListView";
import utils from "web.utils";
import session from "web.session";
import { multiFileUpload } from "@sign/js/backend/multi_file_upload";
import viewRegistry from 'web.view_registry';

const { _t } = core;

const SignKanbanController = KanbanController.extend(makeCusto("button.o-kanban-button-new"));
const SignKanbanColumn = KanbanColumn.extend({
  /**
   * @override
   */
  init: function () {
    this._super.apply(this, arguments);
    if (this.modelName === "sign.request") {
      this.draggable = false;
    }
  },
});
const SignKanbanRecord = KanbanRecord.extend({
  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  /**
   * On click of kanban open send signature wizard
   * @override
   * @private
   */
  _openRecord: function () {
    if (
      this.modelName === "sign.template" &&
      this.$el.parents(".o_sign_template_kanban").length
    ) {
      // don't allow edit on mobile
      if (config.device.isMobile) {
        return;
      }
      this._rpc({
        model: this.modelName,
        method: "go_to_custom_template",
        args: [this.recordData.id],
      }).then((action) => {
        this.do_action(action);
      });
    } else if (
      this.modelName === "sign.request" &&
      this.$el.parents(".o_sign_request_kanban").length
    ) {
      this._rpc({
        model: this.modelName,
        method: "go_to_document",
        args: [this.recordData.id],
      }).then((action) => {
        this.do_action(action);
      });
    } else {
      this._super.apply(this, arguments);
    }
  },
  async _render() {
    await this._super(...arguments);
    if (
      config.device.isMobile &&
      (this.modelName === "sign.template" || this.modelName === "sign.request")
    ) {
      // LPE to APP: data-mobile feature has been deprecated and removed
      // the dialog feature in mobile should be rethought with something like https://material.io/components/sheets-bottom
      this.$(
        ".o_kanban_record_bottom .oe_kanban_bottom_left button"
      ).attr("data-mobile", '{"fullscreen": true}');
    }
  },
});

const SignKanbanRenderer = KanbanRenderer.extend({
  config: Object.assign({}, KanbanRenderer.prototype.config, {
      KanbanColumn: SignKanbanColumn,
      KanbanRecord: SignKanbanRecord,
  }),
});

var SignKanbanView = KanbanView.extend({
  config: _.extend({}, KanbanView.prototype.config, {
      Controller: SignKanbanController,
      Renderer: SignKanbanRenderer
  }),
});

viewRegistry.add('sign_kanban', SignKanbanView);

const SignListController = ListController.extend(makeCusto(".o_list_button_add"));
const SignListView = ListView.extend({
  config: _.extend({}, ListView.prototype.config, {
      Controller: SignListController,
  }),
});

viewRegistry.add('sign_list', SignListView);

function makeCusto(selector_button) {
  return {
    renderButtons: function () {
      this._super.apply(this, arguments);
      if (!this.$buttons) {
        return; // lists in modal don't have buttons
      }
      if (this.modelName === "sign.template") {
        this._sign_upload_file_button();
      } else if (this.modelName === "sign.request") {
        if (this.$buttons) {
          this._sign_create_request_button();
        }
      }
    },

    _sign_upload_file_button: function () {
      this.$buttons
        .find(selector_button)
        .text(_t("UPLOAD A PDF TO SIGN"))
        .off("click")
        .on("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          _sign_upload_file.bind(this)(true, "sign_send_request");
        });
      // don't allow template creation on mobile devices
      if (config.device.isMobile) {
        this.$buttons.find(selector_button).hide();
        return;
      }

      session.user_has_group("sign.group_sign_user").then((has_group) => {
        if (has_group) {
          this.$buttons.find(selector_button).after(
            $(
              '<button class="btn btn-link o-kanban-button-new ml8" type="button">' +
                _t("UPLOAD A PDF TEMPLATE") +
                "</button>"
            )
              .off("click")
              .on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                _sign_upload_file.bind(this)(false,"sign_template_edit");
              })
          );
        }
      });
    },

    _sign_create_request_button: function () {
      this.$buttons
        .find(selector_button)
        .text(_t("UPLOAD A PDF TO SIGN"))
        .off("click")
        .on("click", (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          _sign_upload_file.bind(this)(true, "sign_send_request");
        });
      if (config.device.isMobile) {
        this.$buttons.find(selector_button).hide();
        return;
      }
    },
  };
}

/**
 * Handles template file upload logic
 * @param { Boolean } inactive - whether the created template should be archived or not
 * @param { String } sign_edit_context - sign edit context to be used when redirecting the user to the created template
 */
function _sign_upload_file(inactive, sign_edit_context) {
  const $upload_input = $(
    '<input type="file" name="files[]" accept="application/pdf, application/x-pdf, application/vnd.cups-pdf" multiple="true"/>'
  );
  $upload_input.on("change", (e) => {
    let files = e.target.files;
    Promise.all(
      Array.from(files).map((file) => {
        return utils.getDataURLFromFile(file).then((result) => {
          const args = [file.name, result.split(',')[1], !inactive];

          return this._rpc({
            model: "sign.template",
            method: "create_with_attachment_data",
            args: args,
          });
        });
      })
    ).then((uploadedTemplates) => {
        const handleTemplates = (templates) => {
          if(templates && templates.length > 0) {
            const file = templates.shift();
            if (templates.length) {
              multiFileUpload.addNewFiles(templates)
            }
            this.do_action({
              type: "ir.actions.client",
              tag: "sign.Template",
              name: sprintf(_t('Template "%s"'), file.name),
              context: {
                sign_edit_call: sign_edit_context,
                id: file.template,
                sign_directly_without_mail: false,
              },
            });
          }
        }

        const groupBy = (array, key) => {
          const res = {}
          array.forEach(item => {
            res[key(item)] = (res[key(item)] || []);
            res[key(item)].push(item);
          });
          return res;
        };

        const templates = uploadedTemplates.map((template, index) => {
          return {
            template,
            name: files[index].name,
          };
        });

        let {true: succesfulTemplates, false: failedTemplates} = groupBy(templates, (item) => Boolean(item.template));

        if (failedTemplates && failedTemplates.length) {
          const errorMessage = 
            core.qweb.render("sign.upload_template_error", {
              'failedTemplates': failedTemplates,
              'uploadedTemplatesCount': uploadedTemplates.length
            });
          Dialog.alert(this, '', {
            $content: $('<div/>', {
                role: 'alert',
                html: errorMessage
              }),
            title: _t("File Error"),
            confirm_callback: () => {
              handleTemplates.bind(this)(succesfulTemplates);
            },
          })
        } else {
          handleTemplates.bind(this)(succesfulTemplates);
        }
      })
      .then(() => {
        $upload_input.removeAttr("disabled");
        $upload_input.val("");
      });
  });

  $upload_input.click();
}
