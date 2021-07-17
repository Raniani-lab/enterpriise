/** @odoo-module alias=sign.template **/

"use strict";

import AbstractAction from "web.AbstractAction";
import config from "web.config";
import core from "web.core";
import { sprintf } from "@web/core/utils/strings";
import Dialog from "web.Dialog";
import framework from "web.framework";
import session from "web.session";
import Widget from "web.Widget";
import { PDFIframe } from "@sign/js/common/PDFIframe";
import { sign_utils } from "@sign/js/backend/utils";
import StandaloneFieldManagerMixin from "web.StandaloneFieldManagerMixin";
import {
  FormFieldMany2ManyTags,
  FieldSelection as FormFieldSelection
} from "web.relational_fields";
import SmoothScrollOnDrag from "web/static/src/js/core/smooth_scroll_on_drag.js";
import { multiFileUpload } from "@sign/js/common/multi_file_upload";

const { _t } = core;

PDFIframe.include({
  enableSignTemplateEdition: function () {
    this.$(".page")
      .off("click")
      .on("click", (e) => {
        if (e.ctrlKey) {
          this.handleControlClick(e);
        }
      });
  },
  handleControlClick: function (e) {
    const self = this;
    const editModeDropdown = $(core.qweb.render("sign.edit_mode_dropdown"));
    const $pageElement = $(e.currentTarget);

    $pageElement.find(".o_edit_mode_dropdown").remove();
    const targetPage = $pageElement.attr("data-page-number");
    const $dropdown = $(editModeDropdown)
      .appendTo($pageElement)
      .css({
        top: e.pageY - $pageElement.offset().top,
        left: e.pageX - $pageElement.offset().left,
      });

    $dropdown.find(".dropdown_close_icon").on("click", (e) => {
      $dropdown.remove();
    });

    $dropdown.find(".o_edit_mode_dropdown_item").on("click", (e) => {
      const posX =
        ($(e.target).offset().left -
          $pageElement.find(".textLayer").offset().left) /
        $pageElement.innerWidth();
      const posY =
        ($(e.target).offset().top -
          $pageElement.find(".textLayer").offset().top) /
        $pageElement.innerHeight();
      const type = $(e.target).attr("type");
      const [width, height] = [self.types[type].defaultWidth, self.types[type].defaultHeight];
      const signItem = self.createSignItem(
        self.types[type],
        true,
        self.role,
        posX,
        posY,
        width,
        height,
        "",
        [],
        "",
        "",
        "",
        true
      );

      const defineOrder = (pageElements) => {
        return pageElements.length
          ? pageElements.slice(-1)[0].data("order") + 1
          : 1;
      };

      signItem.data({
        "data-page-number": targetPage,
        posx: posX,
        posy: posY,
        isEditMode: true,
        itemId: Math.floor(Math.random() * self.minID) - 1,
        order: defineOrder(self.configuration[targetPage]),
      });
      self.signatureItems[signItem.data("item-id")] = signItem.data();

      self.configuration[targetPage].push(signItem);
      self.updateSignItem(signItem);
      self.refreshSignItems();

      signItem.prop("field-type", self.types[signItem.data("type")].item_type);
      signItem.prop("field-name", self.types[signItem.data("type")].name);
      const smoothScrollOptions = {
        scrollBoundaries: {
          right: false,
          left: false,
        },
        jQueryDraggableOptions: {
          containment: "parent",
          distance: 0,
          handle: ".o_sign_config_handle",
          scroll: false,
        },
      };
      self.signItemsDraggableComponent = new SmoothScrollOnDrag(
        self,
        signItem,
        self.$("#viewerContainer"),
        smoothScrollOptions
      );
      signItem
        .resizable({
          containment: "parent",
        })
        .css("position", "absolute");

      signItem
        .off("dragstart resizestart")
        .on("dragstart resizestart", function (e, ui) {
          if (!e.ctrlKey) {
            self.$(".o_sign_sign_item").removeClass("ui-selected");
          }
          signItem.addClass("ui-selected");
        });

      signItem.off("dragstop").on("dragstop", function (e, ui) {
        signItem.data({
          posx:
            Math.round(
              (ui.position.left / signItem.parent().innerWidth()) * 1000
            ) / 1000,
          posy:
            Math.round(
              (ui.position.top / signItem.parent().innerHeight()) * 1000
            ) / 1000,
        });
        signItem.removeClass("ui-selected");
      });

      signItem.off("resizestop").on("resizestop", function (e, ui) {
        signItem.data({
          width:
            Math.round(
              (ui.size.width / signItem.parent().innerWidth()) * 1000
            ) / 1000,
          height:
            Math.round(
              (ui.size.height / signItem.parent().innerHeight()) * 1000
            ) / 1000,
        });

        self.updateSignItem(signItem);
        signItem.removeClass("ui-selected");
      });

      signItem.find(".o_sign_config_area .fa-times").on("click", () => {
        delete self.signatureItems[signItem.data("item-id")];
        self.deleteSignItem(signItem);
        self.checkSignItemsCompletion();
      });
      $dropdown.remove();
      self.checkSignItemsCompletion();
    });
  },
});

const SignItemCustomPopover = Widget.extend({
  template: "sign.sign_item_custom_popover",
  events: {
    "click .o_sign_delete_field_button": function (e) {
      this.$currentTarget.popover("hide");
      this.$currentTarget.trigger("itemDelete");
    },
    "click .o_sign_align_button": function (e) {
      this.$(".o_sign_field_align_group .o_sign_align_button").removeClass(
        "btn-primary"
      );
      e.target.classList.add("btn-primary");
    },
    "click .o_sign_validate_field_button": function (e) {
      this.hide();
    },
  },

  init: function (parent, parties, options, select_options) {
    options = options || {};
    this._super(parent, options);
    //TODO: Add buttons for save, discard and remove.
    this.parties = parties;
    this.select_options = select_options;
    this.debug = config.isDebug();
  },

  start: function () {
    this.$responsibleSelect = this.$(".o_sign_responsible_select");
    this.$optionsSelect = this.$(".o_sign_options_select");
    sign_utils.resetResponsibleSelectConfiguration();
    sign_utils.resetOptionsSelectConfiguration();

    return this._super().then(() => {
      const fieldType = this.$currentTarget.prop("field-type");
      if (["text", "textarea"].includes(fieldType)) {
        this.$(
          '.o_sign_field_align_group button[data-align="' +
            this.$currentTarget.data("alignment") +
            '"]'
        ).addClass("btn-primary");
      } else {
        this.$(".o_sign_field_align_group").hide();
      }
      sign_utils.setAsResponsibleSelect(
        this.$responsibleSelect.find("select"),
        this.$currentTarget.data("responsible"),
        this.parties
      );
      sign_utils.setAsOptionsSelect(
        this.$optionsSelect.find("input"),
        this.$currentTarget.data("itemId"),
        this.$currentTarget.data("option_ids"),
        this.select_options
      );
      this.$('input[type="checkbox"]').prop(
        "checked",
        this.$currentTarget.data("required")
      );

      this.$("#o_sign_name").val(this.$currentTarget.data("name") || "");
      this.title = this.$currentTarget.prop("field-name");
      if (fieldType !== "selection") {
        this.$(".o_sign_options_group").hide();
      }
    });
  },

  create: function ($targetEl) {
    this.$currentTarget = $targetEl;
    this.$elPopover = $("<div class='o_sign_item_popover'/>");
    const buttonClose = '<button class="o_sign_close_button">&times;</button>';
    const isRTL = _t.database.parameters.direction === "rtl";

    this.appendTo(this.$elPopover).then(() => {
      const options = {
        title: this.title + buttonClose,
        content: () => {
          return this.$el;
        },
        html: true,
        placement: isRTL ? "left" : "right",
        trigger: "focus",
        container: ".o_sign_template",
      };
      this.$currentTarget.popover(options).one("inserted.bs.popover", (e) => {
        $(".popover").addClass("o_popover_offset");
        $(".o_sign_close_button").on("click", (e) => {
          this.$currentTarget.popover("hide");
        });
      });
      this.$currentTarget.popover("toggle");
      //  Don't display placeholders of checkboxes: empty element
      if (this.$currentTarget.prop("field-type") === "checkbox") {
        $(".o_popover_placeholder").text("");
      }
    });
  },
  hide: function () {
    const resp = parseInt(this.$responsibleSelect.find("select").val());
    const selected_options = this.$optionsSelect
      .find("#o_sign_options_select_input")
      .data("item_options");
    const required = this.$('input[type="checkbox"]').prop("checked");
    const alignment = this.$(
      ".o_sign_field_align_group .o_sign_align_button.btn-primary"
    ).data("align");
    let name = this.$("#o_sign_name").val();
    this.getParent().currentRole = resp;
    if (!name) {
      name = this.$currentTarget.prop("field-name");
    }
    if (this.$currentTarget.prop("field-type") != "checkbox") {
      this.$currentTarget.find(".o_placeholder").text(name);
    }
    this.$currentTarget
      .data({
        responsible: resp,
        alignment: alignment,
        required: required,
        name: name,
        option_ids: selected_options,
      })
      .trigger("itemChange");
    this.$currentTarget.popover("hide");
  },
});

const InitialAllPagesDialog = Dialog.extend({
  template: "sign.initial_all_pages_dialog",

  init: function (parent, parties, options) {
    options = options || {};

    options.title = options.title || _t("Add Initials");
    options.size = options.size || "medium";

    if (!options.buttons) {
      options.buttons = this.addDefaultButtons();
    }

    this._super(parent, options);

    this.parties = parties;
  },

  start: function () {
    this.$responsibleSelect = this.$(".o_sign_responsible_select_initials");
    return this._super.apply(this, arguments).then(() => {
      sign_utils.setAsResponsibleSelect(
        this.$responsibleSelect.find("select"),
        this.getParent().currentRole,
        this.parties
      );
    });
  },

  open: function ($signatureItem) {
    this.$currentTarget = $signatureItem;
    this._super.apply(this, arguments);
  },

  updateTargetResponsible: function () {
    const resp = parseInt(this.$responsibleSelect.find("select").val());
    this.getParent().currentRole = resp;
    this.$currentTarget.data("responsible", resp);
  },

  addDefaultButtons() {
    const buttons = [];
    buttons.push({
      text: _t("Add once"),
      classes: "btn-primary",
      close: true,
      click: (e) => {
        this.updateTargetResponsible();
        this.$currentTarget.trigger("itemChange");
      },
    });
    buttons.push({
      text: _t("Add to all pages"),
      classes: "btn-secondary",
      close: true,
      click: (e) => {
        this.updateTargetResponsible();
        this.$currentTarget.draggable("destroy").resizable("destroy");
        this.$currentTarget.trigger("itemClone");
      },
    });
    return buttons;
  },
});

const EditablePDFIframe = PDFIframe.extend({
  init: function () {
    this._super.apply(this, arguments);
    if (this.editMode) {
      document.body.classList.add("o_block_scroll");
    }
    this.customPopovers = {};
    this.events = Object.assign(this.events || {}, {
      "itemChange .o_sign_sign_item": function (e) {
        this.updateSignItem($(e.target));
        this.$iframe.trigger("templateChange");
      },

      "itemDelete .o_sign_sign_item": function (e) {
        this.deleteSignItem($(e.target));
        this.$iframe.trigger("templateChange");
      },

      "itemClone .o_sign_sign_item": function (e) {
        const $target = $(e.target);
        this.updateSignItem($target);

        for (let i = 1; i <= this.nbPages; i++) {
          const hasSignatureInPage = this.configuration[i].some(
            (item) => this.types[item.data("type")].item_type === "signature"
          );
          if (!hasSignatureInPage) {
            const $newElem = $target.clone(true);
            $newElem.data({itemId: Math.floor(Math.random() * this.minID) - 1});
            this.enableCustom($newElem);
            this.configuration[i].push($newElem);
          }
        }

        this.deleteSignItem($target);
        this.refreshSignItems();
        this.$iframe.trigger("templateChange");
      },

      "click .o_sign_rotate": function (e) {
        const button = $(e.target);
        button.prepend('<i class="fa fa-spin fa-circle-o-notch"/>');
        button.attr("disabled", true);
        this._rotateDocument();
      },
    });
  },

  destroy: function () {
    this._super(...arguments);
    if (this.editMode) {
      document.body.classList.remove("o_block_scroll");
    }
  },
  doPDFPostLoad: function () {
    const self = this;
    this.fullyLoaded.then(() => {
      if (self.editMode) {
        if (self.$iframe.prop("disabled")) {
          const $div = $("<div/>").css({
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            "z-index": 110,
            opacity: 0.75,
          });
          self.$("#viewer").css("position", "relative").prepend($div);
          $div.on("click mousedown mouseup mouveover mouseout", function (e) {
            return false;
          });
        } else {
          // In the edit mode, a side bar will be added to the left of the pdfviewer
          // "margin-left:14rem" will be added to the pdfviewer to leave space for the sidebar
          // So, a "resize" must be triggered for the pdfviewer after its new css is added.
          // If not, when a pdf is opened with "page-width" there might be a horizontal scrollbar on the bottom of the pdfviewer
          // Unfortunately, it is hard to know when the css will be added.
          // So we manually add the css here and trigger the "resize"
          // css in iframe.css:
          // #outerContainer.o_sign_field_type_toolbar_visible {
          //     margin-left: 14rem;
          //     width: auto;
          // }
          self.$("#outerContainer").css("width", "auto");
          self.$("#outerContainer").css("margin-left", "14rem");
          self.$iframe.get(0).contentWindow.dispatchEvent(new Event("resize"));

          const rotateButton = $(
            core.qweb.render("sign.rotate_pdf_button", {
              title: _t("Rotate Clockwise"),
            })
          );
          rotateButton.insertBefore(self.$("#print"));

          // set helper lines when dragging
          self.$hBarTop = $("<div/>");
          self.$hBarBottom = $("<div/>");
          self.$hBarTop
            .add(self.$hBarBottom)
            .addClass("o_sign_drag_helper o_sign_drag_top_helper");
          self.$vBarLeft = $("<div/>");
          self.$vBarRight = $("<div/>");
          self.$vBarLeft
            .add(self.$vBarRight)
            .addClass("o_sign_drag_helper o_sign_drag_side_helper");

          const typesArray = Object.values(self.types);
          const $fieldTypeButtons = $(
            core.qweb.render("sign.type_buttons", {
              sign_item_types: typesArray,
            })
          );
          self.$fieldTypeToolbar = $("<div/>").addClass(
            "o_sign_field_type_toolbar d-flex flex-column"
          );
          self.$fieldTypeToolbar.prependTo(self.$("body"));
          self
            .$("#outerContainer")
            .addClass("o_sign_field_type_toolbar_visible");
          const smoothScrollOptions = {
            scrollBoundaries: {
              right: false,
              left: false,
            },
            jQueryDraggableOptions: {
              cancel: false,
              distance: 0,
              cursorAt: { top: 5, left: 5 },
              helper: function (e) {
                const type = self.types[$(this).data("item-type-id")];
                const $signatureItem = self.createSignItem(
                  type,
                  true,
                  self.currentRole,
                  0,
                  0,
                  type.default_width,
                  type.default_height,
                  "",
                  []
                );
                if (!e.ctrlKey) {
                  self.$(".o_sign_sign_item").removeClass("ui-selected");
                }
                $signatureItem.addClass("o_sign_sign_item_to_add ui-selected");

                self.$(".page").first().append($signatureItem);
                self.updateSignItem($signatureItem);
                $signatureItem
                  .css("width", $signatureItem.css("width"))
                  .css("height", $signatureItem.css("height")); // Convert % to px
                self.updateSignItemFontSize($signatureItem, self.normalSize());
                $signatureItem.detach();

                return $signatureItem;
              },
            },
          };
          $fieldTypeButtons.appendTo(self.$fieldTypeToolbar);
          const $fieldTypeButtonItems = $fieldTypeButtons.children(
            ".o_sign_field_type_button"
          );
          self.buttonsDraggableComponent = new SmoothScrollOnDrag(
            this,
            $fieldTypeButtonItems,
            self.$("#viewerContainer"),
            smoothScrollOptions
          );
          $fieldTypeButtonItems.each(function (i, el) {
            self.enableCustomBar($(el));
          });

          self.$(".page").droppable({
            accept: "*",
            tolerance: "touch",
            drop: function (e, ui) {
              // the 'o_sign_sign_item_to_add' is added once a sign item is dragged.
              // two consecutive pages have overlaps borders,
              // we remove the o_sign_sign_item_to_add once the sign item is dropped
              // to make sure ths sign item will not be dropped into multiple pages
              if (!ui.helper.hasClass("o_sign_sign_item_to_add")) {
                return true;
              }
              ui.helper.removeClass("o_sign_sign_item_to_add");

              const $parent = $(e.target);
              const pageNo = parseInt($parent.data("page-number"));

              let $signatureItem;
              if (ui.draggable.hasClass("o_sign_sign_item")) {
                let pageNoOri = parseInt(
                  $(ui.draggable).parent().attr("data-page-number")
                );
                if (pageNoOri === pageNo) {
                  // if sign_item is dragged to its previous page
                  return true;
                }
                $signatureItem = $(ui.draggable);
                self.detachSignItem($signatureItem);
              } else {
                $signatureItem = ui.helper
                  .clone(true)
                  .removeClass()
                  .addClass("o_sign_sign_item o_sign_sign_item_required");
              }
              const posX =
                (ui.offset.left - $parent.find(".textLayer").offset().left) /
                $parent.innerWidth();
              const posY =
                (ui.offset.top - $parent.find(".textLayer").offset().top) /
                $parent.innerHeight();
              $signatureItem.data({ posx: posX, posy: posY });

              self.configuration[pageNo].push($signatureItem);
              self.refreshSignItems();
              self.enableCustom($signatureItem);

              // updateSignItem and trigger('templateChange') are done in "dragstop" for sign_items
              // trigger('templateChange)' twice may cause 'concurrent update' for server
              if (!ui.draggable.hasClass("o_sign_sign_item")) {
                self.updateSignItem($signatureItem);
                self.$iframe.trigger("templateChange");

                if (
                  self.types[$signatureItem.data("type")].item_type ===
                  "initial"
                ) {
                  new InitialAllPagesDialog(self, self.parties).open(
                    $signatureItem
                  );
                }
              }

              return false;
            },
          });

          self.$("#viewer").selectable({
            appendTo: self.$("body"),
            filter: ".o_sign_sign_item",
          });

          $(document)
            .add(self.$el)
            .on("keyup", (e) => {
              if (e.which !== 46) {
                return true;
              }

              self.$(".ui-selected").each(function (i, el) {
                self.deleteSignItem($(el));
                // delete the associated popovers. At this point, there should only be one popover
                const popovers = window.document.querySelectorAll(
                  '[id^="popover"]'
                );
                popovers.forEach((popover) => {
                  document.getElementById(popover.id).remove();
                });
              });
              self.$iframe.trigger("templateChange");
            });
        }

        self.$(".o_sign_sign_item").each(function (i, el) {
          self.enableCustom($(el));
        });
      }
    });

    this._super.apply(this, arguments);
  },

  enableCustom: function ($signatureItem) {
    const self = this;

    $signatureItem.prop(
      "field-type",
      this.types[$signatureItem.data("type")].item_type
    );
    $signatureItem.prop(
      "field-name",
      this.types[$signatureItem.data("type")].name
    );
    const itemId = $signatureItem.data("itemId");
    const $configArea = $signatureItem.find(".o_sign_config_area");

    $configArea
      .find(".o_sign_item_display")
      .off("mousedown")
      .on("mousedown", function (e) {
        e.stopPropagation();
        self.$(".ui-selected").removeClass("ui-selected");
        $signatureItem.addClass("ui-selected");

        Object.keys(self.customPopovers).forEach((keyId) => {
          if (
            keyId != itemId &&
            self.customPopovers[keyId] &&
            ((keyId && itemId) || (keyId != "undefined" && !itemId))
          ) {
            self.customPopovers[keyId].$currentTarget.popover("hide");
            self.customPopovers[keyId] = false;
          }
        });

        if (self.customPopovers[itemId]) {
          self._closePopover(itemId);
        } else {
          self.customPopovers[itemId] = new SignItemCustomPopover(
            self,
            self.parties,
            {
              field_name: $signatureItem[0]["field-name"],
              field_type: $signatureItem[0]["field-type"],
            },
            self.select_options
          );
          self.customPopovers[itemId].create($signatureItem);
        }
      });

    $configArea
      .find(".o_sign_config_handle")
      .off("mouseup")
      .on("mouseup", function (e) {
        if (!e.ctrlKey) {
          self
            .$(".o_sign_sign_item")
            .filter(function (i) {
              return this !== $signatureItem[0];
            })
            .removeClass("ui-selected");
        }
        $signatureItem.toggleClass("ui-selected");
      });
    const smoothScrollOptions = {
      scrollBoundaries: {
        right: false,
        left: false,
      },
      jQueryDraggableOptions: {
        containment: $("#viewerContainer"),
        distance: 0,
        classes: { "ui-draggable-dragging": "o_sign_sign_item_to_add" },
        handle: ".o_sign_config_handle",
        scroll: false,
      },
    };
    if (!$signatureItem.hasClass("ui-draggable")) {
      this.signItemsDraggableComponent = new SmoothScrollOnDrag(
        this,
        $signatureItem,
        self.$("#viewerContainer"),
        smoothScrollOptions
      );
    }
    if (!$signatureItem.hasClass("ui-resizable")) {
      $signatureItem
        .resizable({
          containment: "parent",
        })
        .css("position", "absolute");
    }

    $signatureItem
      .off("dragstart resizestart")
      .on("dragstart resizestart", function (e, ui) {
        if (!e.ctrlKey) {
          self.$(".o_sign_sign_item").removeClass("ui-selected");
        }
        $signatureItem.addClass("ui-selected");
      });

    $signatureItem.off("dragstop").on("dragstop", function (e, ui) {
      const $parent = $(e.target).parent();
      $signatureItem.data({
        posx:
          Math.round(
            ((ui.offset.left - $parent.find(".textLayer").offset().left) /
              $parent.innerWidth()) *
              1000
          ) / 1000,
        posy:
          Math.round(
            ((ui.offset.top - $parent.find(".textLayer").offset().top) /
              $parent.innerHeight()) *
              1000
          ) / 1000,
      });
    });

    $signatureItem.off("resizestop").on("resizestop", function (e, ui) {
      $signatureItem.data({
        width:
          Math.round(
            (ui.size.width / $signatureItem.parent().innerWidth()) * 1000
          ) / 1000,
        height:
          Math.round(
            (ui.size.height / $signatureItem.parent().innerHeight()) * 1000
          ) / 1000,
      });
    });

    $signatureItem.on("dragstop resizestop", function (e, ui) {
      self.updateSignItem($signatureItem);
      self.$iframe.trigger("templateChange");
      $signatureItem.removeClass("ui-selected");
    });

    this.enableCustomBar($signatureItem);
  },

  enableCustomBar: function ($item) {
    const self = this;

    const itemId = $item.data("itemId");
    $item.on("dragstart resizestart", function (e, ui) {
      const $target = $(e.target);
      if (
        !$target.hasClass("ui-draggable") &&
        !$target.hasClass("ui-resizable")
      ) {
        // The element itself is not draggable or resizable
        // Let the event propagate to its parents
        return;
      }
      if (self.customPopovers[itemId]) {
        self._closePopover(itemId);
      }
      start.call(self, ui.helper);
    });
    $item
      .find(".o_sign_config_area .o_sign_config_handle")
      .on("mousedown", function (e) {
        if (self.customPopovers[itemId]) {
          self._closePopover(itemId);
        }
        start.call(self, $item);
        process.call(self, $item);
      });
    $item.on("drag resize", function (e, ui) {
      const $target = $(e.target);
      if (
        !$target.hasClass("ui-draggable") &&
        !$target.hasClass("ui-resizable")
      ) {
        // The element itself is not draggable or resizable
        // Let the event propagate to its parents
        return;
      }
      process.call(self, ui.helper);
    });
    $item.on("dragstop resizestop", function (e, ui) {
      end.call(self);
    });
    $item
      .find(".o_sign_config_area .o_sign_config_handle")
      .on("mouseup", function (e) {
        end.call(self);
      });

    function start($helper) {
      this.$hBarTop.detach().insertAfter($helper).show();
      this.$hBarBottom.detach().insertAfter($helper).show();
      this.$vBarLeft.detach().insertAfter($helper).show();
      this.$vBarRight.detach().insertAfter($helper).show();
    }
    function process($helper) {
      const helperBoundingClientRect = $helper.get(0).getBoundingClientRect();
      this.$hBarTop.css("top", helperBoundingClientRect.top);
      this.$hBarBottom.css(
        "top",
        helperBoundingClientRect.top + parseFloat($helper.css("height")) - 1
      );
      this.$vBarLeft.css("left", helperBoundingClientRect.left);
      this.$vBarRight.css(
        "left",
        helperBoundingClientRect.left + parseFloat($helper.css("width")) - 1
      );
    }
    function end() {
      this.$hBarTop.hide();
      this.$hBarBottom.hide();
      this.$vBarLeft.hide();
      this.$vBarRight.hide();
    }
  },

  _closePopover(itemId) {
    this.customPopovers[itemId].$currentTarget.popover("hide");
    this.customPopovers[itemId] = false;
  },

  updateSignItem: function ($signatureItem) {
    this._super.apply(this, arguments);

    if (this.editMode) {
      const responsibleName = this.parties[$signatureItem.data("responsible")]
        .name;
      const colorIndex = this.parties[$signatureItem.data("responsible")].color;
      const currentColor = $signatureItem
        .attr("class")
        .match(/o_color_responsible_\d+/);
      $signatureItem.removeClass(currentColor && currentColor[0]);
      $signatureItem.addClass("o_color_responsible_" + colorIndex);
      $signatureItem
        .find(".o_sign_responsible_display")
        .text(responsibleName)
        .prop("title", responsibleName);
      const option_ids = $signatureItem.data("option_ids") || [];
      const $options_display = $signatureItem.find(
        ".o_sign_select_options_display"
      );
      this.display_select_options(
        $options_display,
        this.select_options,
        option_ids
      );
    }
  },

  _rotateDocument: function () {
    this._rpc({
      model: "sign.template",
      method: "rotate_pdf",
      args: [this.getParent().templateID],
    }).then((response) => {
      if (response) {
        this.$("#pageRotateCw").click();
        this.$("#rotateCw").text("");
        this.$("#rotateCw").attr("disabled", false);
        this.refreshSignItems();
      } else {
        Dialog.alert(
          this,
          _t("Somebody is already filling a document which uses this template"),
          {
            confirm_callback: () => {
              this.getParent().go_back_to_kanban();
            },
          }
        );
      }
    });
  },
});
//TODO refactor
const Template = AbstractAction.extend(StandaloneFieldManagerMixin, {
  hasControlPanel: true,
  events: {
    "click .fa-pencil": function (e) {
      this.$templateNameInput.focus().select();
    },

    "input .o_sign_template_name_input": function (e) {
      this.$templateNameInput.attr(
        "size",
        this.$templateNameInput.val().length + 1
      );
    },

    "change .o_sign_template_name_input": function (e) {
      this.saveTemplate();
      if (this.$templateNameInput.val() === "") {
        this.$templateNameInput.val(this.initialTemplateName);
      }
    },

    "keydown .o_sign_template_name_input": function (e) {
      if (e.keyCode === 13) {
        this.$templateNameInput.blur();
      }
    },

    "templateChange iframe.o_sign_pdf_iframe": function (e) {
      this.saveTemplate();
    },

    "click .o_sign_template_send": function (e) {
      this.do_action("sign.action_sign_send_request", {
        additional_context: {
          active_id: this.templateID,
          sign_directly_without_mail: false,
        },
      });
    },

    "click .o_sign_template_sign_now": function (e) {
      this.do_action("sign.action_sign_send_request", {
        additional_context: {
          active_id: this.templateID,
          sign_directly_without_mail: true,
        },
      });
    },

    "click .o_sign_template_share": function (e) {
      this._rpc({
        model: 'sign.template',
        method: 'open_shared_sign_request',
        args: [[this.templateID]],
      }).then((action) => {
        this.do_action(action);
      });
    },

    "click .o_sign_template_save": function (e) {
      return this.do_action("sign.sign_template_action", {
        clear_breadcrumbs: true,
      });
    },

    "click .o_sign_template_next": function (e) {
      const templateName = e.target.getAttribute("template-name");
      const templateId = parseInt(e.target.getAttribute("template-id"));
      multiFileUpload.removeFile(templateId);
      this.do_action({
        type: "ir.actions.client",
        tag: "sign.Template",
        name: sprintf(_t('Template "%s"'), templateName),
        context: {
          sign_edit_call: "sign_template_edit",
          id: templateId,
          sign_directly_without_mail: false,
        },
      });
    },

    "click .o_sign_template_duplicate": function (e) {
      this.duplicateTemplate();
    },
  },
  custom_events: Object.assign({}, StandaloneFieldManagerMixin.custom_events, {
    field_changed: "_onFieldChanged",
  }),

  go_back_to_kanban: function () {
    return this.do_action("sign.sign_template_action", {
      clear_breadcrumbs: true,
    });
  },

  init: function (parent, options) {
    this._super.apply(this, arguments);
    StandaloneFieldManagerMixin.init.call(this);

    if (options.context.id === undefined) {
      return;
    }

    this.templateID = options.context.id;
    this.actionType = options.context.sign_edit_call
      ? options.context.sign_edit_call
      : "";
    this.rolesToChoose = {};

    const nextTemplate = multiFileUpload.getNext();
    this.nextTemplate = nextTemplate ? nextTemplate : false;
  },

  renderButtons: function () {
    this.$buttons = $(
      core.qweb.render("sign.template_cp_buttons", {
        widget: this,
        action_type: this.actionType,
      })
    );
  },

  willStart: function () {
    if (this.templateID === undefined) {
      return this._super.apply(this, arguments);
    }
    return Promise.all([this._super(), this.perform_rpc()]);
  },
  // TODO: probably this can be removed
  createTemplateTagsField: function () {
    const self = this;
    const params = {
      modelName: "sign.template",
      res_id: self.templateID,
      fields: {
        id: {
          type: "integer",
        },
        name: {
          type: "char",
        },
        tag_ids: {
          relation: "sign.template.tag",
          type: "many2many",
          relatedFields: {
            id: {
              type: "integer",
            },
            display_name: {
              type: "char",
            },
            color: {
              type: "integer",
            },
          },
          fields: {
            id: {
              type: "integer",
            },
            display_name: {
              type: "char",
            },
            color: {
              type: "integer",
            },
          },
        },
        group_ids: {
          relation: "res.groups",
          type: "many2many",
          relatedFields: {
            id: {
              type: "integer",
            },
            display_name: {
              type: "char",
            },
            color: {
              type: "integer",
            },
          },
          fields: {
            id: {
              type: "integer",
            },
            display_name: {
              type: "char",
            },
            color: {
              type: "integer",
            },
          },
        },
        privacy: {
          type: "selection",
          selection: [
            ["employee", _t("All Users")],
            ["invite", _t("On Invitation")],
          ],
        },
      },
      fieldsInfo: {
        default: {
          id: {
            type: "integer",
          },
          name: {
            type: "char",
          },
          tag_ids: {
            relatedFields: {
              id: {
                type: "integer",
              },
              display_name: {
                type: "char",
              },
              color: {
                type: "integer",
              },
            },
            fieldsInfo: {
              default: {
                id: {
                  type: "integer",
                },
                display_name: {
                  type: "char",
                },
                color: {
                  type: "integer",
                },
              },
            },
            viewType: "default",
          },
          group_ids: {
            relatedFields: {
              id: {
                type: "integer",
              },
              display_name: {
                type: "char",
              },
              color: {
                type: "integer",
              },
            },
            fieldsInfo: {
              default: {
                id: {
                  type: "integer",
                },
                display_name: {
                  type: "char",
                },
                color: {
                  type: "integer",
                },
              },
            },
            viewType: "default",
          },
          privacy: {
            relatedFields: {
              id: {
                type: "selection",
              },
              display_name: {
                type: "char",
              },
            },
            fieldsInfo: {
              default: {
                id: {
                  type: "selection",
                },
                display_name: {
                  type: "char",
                },
              },
            },
            viewType: "default",
          },
        },
      },
    };

    return this.model.load(params).then(function (recordId) {
      self.handleRecordId = recordId;
      self.record = self.model.get(self.handleRecordId);

      self.tag_idsMany2Many = new FormFieldMany2ManyTags(
        self,
        "tag_ids",
        self.record,
        {
          mode: "edit",
          create: true,
          attrs: { options: { color_field: "color" } },
        }
      );
      self._registerWidget(
        self.handleRecordId,
        "tag_ids",
        self.tag_idsMany2Many
      );
      self.tag_idsMany2Many.appendTo(self.$(".o_sign_template_tags"));

      if (config.isDebug()) {
        self.privacy = new FormFieldSelection(self, "privacy", self.record, {
          mode: "edit",
        });
        self._registerWidget(self.handleRecordId, "privacy", self.privacy);
        self.privacy.appendTo(self.$(".o_sign_template_privacy"));

        self.group_idsMany2many = new FormFieldMany2ManyTags(
          self,
          "group_ids",
          self.record,
          {
            mode: "edit",
            create: false,
            attrs: { options: { color_field: "color" } },
          }
        );
        self._registerWidget(
          self.handleRecordId,
          "group_ids",
          self.group_idsMany2many
        );
        self.group_idsMany2many.appendTo(self.$(".o_sign_template_group_id"));
      }
    });
  },

  _onFieldChanged: function (event) {
    const $majInfo = this.$(event.target.$el)
      .parent()
      .next(".o_sign_template_saved_info");
    StandaloneFieldManagerMixin._onFieldChanged.apply(this, arguments);
    this.model
      .save(this.handleRecordId, { reload: true })
      .then((fieldNames) => {
        this.record = this.model.get(this.handleRecordId);
        this.tag_idsMany2Many.reset(this.record);
        $majInfo.stop().css("opacity", 1).animate({ opacity: 0 }, 1500);
      });
  },

  perform_rpc: function () {
    const self = this;
    const defTemplates = this._rpc({
      model: "sign.template",
      method: "read",
      args: [[this.templateID]],
    }).then(function prepare_template(template) {
      if (template.length === 0) {
        self.templateID = undefined;
        self.displayNotification({
          title: _t("Warning"),
          message: _t("The template doesn't exist anymore."),
        });
        return Promise.resolve();
      }
      template = template[0];
      self.sign_template = template;
      self.has_sign_requests = template.sign_request_ids.length > 0;

      const defSignItems = self
        ._rpc({
          model: "sign.item",
          method: "search_read",
          args: [[["template_id", "=", template.id]]],
          kwargs: { context: session.user_context },
        })
        .then(function (sign_items) {
          self.sign_items = sign_items;
          return self._rpc({
            model: "sign.item.option",
            method: "search_read",
            args: [[], ["id", "value"]],
            kwargs: { context: session.user_context },
          });
        });
      const defIrAttachments = self
        ._rpc({
          model: "ir.attachment",
          method: "read",
          args: [[template.attachment_id[0]], ["mimetype", "name"]],
          kwargs: { context: session.user_context },
        })
        .then(function (attachment) {
          attachment = attachment[0];
          self.sign_template.attachment_id = attachment;
          self.isPDF = attachment.mimetype.indexOf("pdf") > -1;
        });

      return Promise.all([defSignItems, defIrAttachments]);
    });

    const defSelectOptions = this._rpc({
      model: "sign.item.option",
      method: "search_read",
      args: [[]],
      kwargs: { context: session.user_context },
    }).then(function (options) {
      self.sign_item_options = options;
    });

    const defParties = this._rpc({
      model: "sign.item.role",
      method: "search_read",
      kwargs: { context: session.user_context },
    }).then(function (parties) {
      self.sign_item_parties = parties;
    });

    const defItemTypes = this._rpc({
      model: "sign.item.type",
      method: "search_read",
      kwargs: { context: session.user_context },
    }).then(function (types) {
      self.sign_item_types = types;
    });

    return Promise.all([
      defTemplates,
      defParties,
      defItemTypes,
      defSelectOptions,
    ]);
  },

  start: function () {
    if (this.templateID === undefined) {
      return this.go_back_to_kanban();
    }
    return this._super()
      .then(() => {
        this.renderButtons();
        const status = {
          cp_content: { $buttons: this.$buttons },
        };
        return this.updateControlPanel(status);
      })
      .then(() => {
        this.initialize_content();
        this.createTemplateTagsField();
        if (this.$("iframe").length) {
          core.bus.on("DOM_updated", this, init_iframe);
        }
        this.$(".o_content").addClass("o_sign_template");
      });
    function init_iframe() {
      if (
        this.$el.parents("html").length &&
        !this.$el.parents("html").find(".modal-dialog").length
      ) {
        framework.blockUI({
          overlayCSS: { opacity: 0 },
          blockMsgClass: "o_hidden",
        });
        this.iframeWidget = new EditablePDFIframe(
          this,
          "/web/content/" + this.sign_template.attachment_id.id,
          true,
          {
            parties: this.sign_item_parties,
            types: this.sign_item_types,
            signatureItems: this.sign_items,
            select_options: this.sign_item_options,
          }
        );
        return this.iframeWidget.attachTo(this.$("iframe")).then(() => {
          framework.unblockUI();
          this.iframeWidget.currentRole = this.sign_item_parties[0].id;
        });
      }
    }
  },

  initialize_content: function () {
    this.$(".o_content").empty();
    this.debug = config.isDebug();
    this.$(".o_content").append(
      core.qweb.render("sign.template", { widget: this })
    );

    this.$("iframe,.o_sign_template_name_input").prop(
      "disabled",
      this.has_sign_requests
    );

    this.$templateNameInput = this.$(".o_sign_template_name_input").first();
    this.$templateNameInput.trigger("input");
    this.initialTemplateName = this.$templateNameInput.val();
  },

  do_show: function () {
    this._super();

    // the iframe cannot be detached normally
    // we have to reload it entirely and re-apply the sign items on it
    return this.perform_rpc().then(() => {
      if (this.iframeWidget) {
        this.iframeWidget.destroy();
        this.iframeWidget = undefined;
      }
      this.$("iframe").remove();
      this.initialize_content();
    });
  },

  prepareTemplateData: function () {
    this.rolesToChoose = {};
    let updatedSignItems = {},
      Id2UpdatedItem = {};
    const configuration = this.iframeWidget
      ? this.iframeWidget.configuration
      : {};
    for (let page in configuration) {
      configuration[page].forEach((signItem) => {
        if (signItem.data('updated') !== true) {
          return;
        }
        const id = signItem.data('item-id');
        Id2UpdatedItem[id] = signItem;
        const resp = signItem.data("responsible");
        updatedSignItems[id] = {
          type_id: signItem.data("type"),
          required: signItem.data("required"),
          name: signItem.data("name"),
          alignment: signItem.data("alignment"),
          option_ids: signItem.data("option_ids"),
          responsible_id: resp,
          page: page,
          posX: signItem.data("posx"),
          posY: signItem.data("posy"),
          width: signItem.data("width"),
          height: signItem.data("height"),
        };
        if (id < 0) {
          updatedSignItems[id]["transaction_id"] = id;
        }
        this.rolesToChoose[resp] = this.iframeWidget.parties[resp];
      });
    }
    return [updatedSignItems, Id2UpdatedItem];
  },

  saveTemplate: function () {
    const [updatedSignItems, Id2UpdatedItem] = this.prepareTemplateData();
    const $majInfo = this.$(".o_sign_template_saved_info").first();
    const newTemplateName = this.$templateNameInput.val();
    this._rpc({
      model: "sign.template",
      method: "update_from_pdfviewer",
      args: [
        this.templateID,
        updatedSignItems,
        this.iframeWidget.deletedSignItemIds,
        newTemplateName == this.initialTemplateName ? "" : newTemplateName,
      ],
    }).then((result) => {
      if (!result) {
        Dialog.alert(
          this,
          _t("Somebody is already filling a document which uses this template"),
          {
            confirm_callback: () => {
              this.go_back_to_kanban();
            },
          }
        );
      }
      const newId2ItemIdMap = result;
      for (let [newId, itemId] of Object.entries(newId2ItemIdMap)) {
          Id2UpdatedItem[newId].data({'itemId': itemId});
      }
      Object.entries(Id2UpdatedItem).forEach(([id,item]) => {
          item.data({'updated': false});
      })
      this.iframeWidget.deletedSignItemIds = [];
      this.initialTemplateName = newTemplateName;
      $majInfo.stop().css("opacity", 1).animate({ opacity: 0 }, 1500);
    });
  },

  duplicateTemplate: function () {
    this._rpc({
      model: 'sign.template',
      method: 'copy',
      args: [[this.templateID]],
    })
    .then((templateID) => {
      this.do_action({
        type: "ir.actions.client",
        tag: 'sign.Template',
        name: _t("Duplicated Template"),
        context: {
            id: templateID,
        },
      });
    });
  },
});

core.action_registry.add("sign.Template", Template);
