/** @odoo-module **/

'use strict';

import config from 'web.config';
import core from 'web.core';
import KanbanController from "web.KanbanController";
import KanbanColumn from "web.KanbanColumn";
import KanbanRecord from "web.KanbanRecord";
import ListController from "web.ListController";
import utils from 'web.utils';
import session from 'web.session';
import multiFileUpload from 'sign.multiFileUpload';

const { _t } = core;

KanbanController.include(_make_custo("button.o-kanban-button-new"));
KanbanColumn.include({
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
KanbanRecord.include({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * On click of kanban open send signature wizard
     * @override
     * @private
     */
    _openRecord: function () {
        var self = this;
        if (this.modelName === 'sign.template' && this.$el.parents('.o_sign_template_kanban').length) {
            // don't allow edit on mobile
            if (config.device.isMobile) {
                return;
            }
            self._rpc({
                model: 'sign.template',
                method: 'go_to_custom_template',
                args: [self.recordData.id],
            }).then(function(action) {
                self.do_action(action);
            });
        } else if (this.modelName === 'sign.request' && this.$el.parents('.o_sign_request_kanban').length) {
            this._rpc({
                model: 'sign.request',
                method: 'go_to_document',
                args: [self.recordData.id],
            }).then(function(action) {
                self.do_action(action);
            });
        } else {
            this._super.apply(this, arguments);
        }
    },
    async _render() {
        await this._super(...arguments);
        if (config.device.isMobile &&
            (this.modelName === "sign.template" || this.modelName === "sign.request")) {
            // LPE to APP: data-mobile feature has been deprecated and removed
            // the dialog feature in mobile should be rethought with something like https://material.io/components/sheets-bottom
            this.$('.o_kanban_record_bottom .oe_kanban_bottom_left button:not(.o_kanban_sign_directly)')
                .attr('data-mobile', '{"fullscreen": true}');
        }
    }
});

ListController.include(_make_custo(".o_list_button_add"));

function _make_custo(selector_button) {
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
            var self = this;
            this.$buttons.find(selector_button).text(_t('UPLOAD A PDF TO SIGN')).off("click").on("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                _sign_upload_file.call(self, true, false, 'sign_send_request');
            });
            // don't allow template creation on mobile devices
            if (config.device.isMobile) {
                this.$buttons.find(selector_button).hide();
                return;
            }

            session.user_has_group('sign.group_sign_user').then(function (has_group) {
                if (has_group) {
                    self.$buttons.find(selector_button).after(
                        $('<button class="btn btn-link o-kanban-button-new ml8" type="button">'+ _t('UPLOAD A PDF TEMPLATE') +'</button>').off('click')
                            .on('click', function (e) {
                                e.preventDefault();
                                e.stopPropagation();
                                _sign_upload_file.call(self, false, false, 'sign_template_edit');
                            }));
                }
            });
        },

        _sign_create_request_button: function () {
            var self = this;
            this.$buttons.find(selector_button).text(_t('UPLOAD A PDF TO SIGN')).off("click").on("click", function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                _sign_upload_file.call(self, true, false, 'sign_send_request');
            });
            if (config.device.isMobile) {
                this.$buttons.find(selector_button).hide();
                return;
            }
        },
    };
}

function _sign_upload_file(inactive, sign_directly_without_mail, sign_edit_context) {
    var self = this;
    var sign_directly_without_mail =  sign_directly_without_mail || false;
    var $upload_input = $('<input type="file" name="files[]" accept="application/pdf, application/x-pdf, application/vnd.cups-pdf" multiple="true"/>');
    $upload_input.on('change', function (e) {
        let files = e.target.files;
        Promise.all(
            Array.from(files).map((file) => {
                return utils.getDataURLFromFile(file).then((result) => {
                    const args = [file.name, result, !inactive]

                    return self._rpc({
                        model: 'sign.template',
                        method: 'upload_template',
                        args: args,
                    });
                });
            })
        ).then(uploadedTemplateData => {
            let templates = uploadedTemplateData.map((template, index) => {
                return {
                    template: template.template,
                    name: files[index].name
                }
            })
            const file = templates.shift();
            if(templates.length) {
                multiFileUpload.addNewFiles(templates);
            }

            self.do_action({
                type: "ir.actions.client",
                tag: 'sign.Template',
                name: _.str.sprintf(_t('Template "%s"'), file.name),
                context: {
                    sign_edit_call: sign_edit_context,
                    id: file.template,
                    sign_directly_without_mail: sign_directly_without_mail,
                }
            });
        }).then(() => {
            $upload_input.removeAttr('disabled');
            $upload_input.val("");
        });
    });

    $upload_input.click();
}
