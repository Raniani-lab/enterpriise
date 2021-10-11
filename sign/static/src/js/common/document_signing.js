/** @odoo-module **/

// Signing part
'use strict';

import ajax from 'web.ajax';
import config from 'web.config';
import core from 'web.core';
import Dialog from 'web.Dialog';
import { Document } from '@sign/js/common/document';
import { NameAndSignature } from 'web.name_and_signature';
import { PDFIframe } from '@sign/js/common/PDFIframe';
import session from 'web.session';
import Widget from 'web.Widget';
import time from 'web.time';
import multiFileUpload from 'sign.multiFileUpload';

const _t = core._t;

// The goal of this override is to fetch a default signature if one was
// already set by the user for this request.
const SignNameAndSignature = NameAndSignature.extend({

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * Adds requestID and accessToken.
     *
     * @constructor
     * @param {Widget} parent
     * @param {Object} options
     * @param {number} requestID
     * @param {string} accessToken
     */
    init: function (parent, options, requestID, accessToken) {
        this._super.apply(this, arguments);

        this.requestID = requestID;
        this.accessToken = accessToken;

        this.defaultSignature = '';
        this.signatureChanged = false;
    },
    /**
     * Fetches the existing signature.
     *
     * @override
     */
    willStart: function () {
        var self = this;
        return Promise.all([
            this._super.apply(this, arguments),
            self._rpc({
                route: '/sign/get_signature/' + self.requestID + '/' + self.accessToken,
                params: {
                    signature_type: self.signatureType,
                },
            }).then(function (signature) {
                if (signature) {
                    signature = 'data:image/png;base64,' + signature;
                    self.defaultSignature = signature;
                }
            })
        ]);
    },
    /**
     * Sets the existing signature.
     *
     * @override
     */
    resetSignature: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            if (self.defaultSignature && self.defaultSignature !== self.emptySignature) {
                var settings = self.$signatureField.jSignature('getSettings');
                var decorColor = settings['decor-color'];
                self.$signatureField.jSignature('updateSetting', 'decor-color', null);
                self.$signatureField.jSignature('reset');
                self.$signatureField.jSignature("importData", self.defaultSignature);
                settings['decor-color'] = decorColor;

                return self._waitForSignatureNotEmpty();
            }
        });
    },
    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * Override: If a user clicks on load, we overwrite the signature in the server.
     * 
     * @see NameAndSignature._onChangeSignLoadInput()
     * @private
     */
    _onChangeSignLoadInput: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
    /**
     * If a user clicks on draw, we overwrite the signature in the server.
     * 
     * @override
     * @see NameAndSignature._onClickSignDrawClear()
     * @private
     */
    _onClickSignDrawClear: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
    /**
     * If a user clicks on auto, we overwrite the signature in the server.
     * 
     * @override
     * @see NameAndSignature._onClickSignAutoButton()
     * @private
     */
    _onClickSignAutoButton: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
    /**
     * If a user clicks on draw, we overwrite the signature in the server.
     * 
     * @override
     * @see NameAndSignature._onClickSignDrawButton()
     * @private
     */
    _onClickSignDrawButton: function () {
        this.signatureChanged = true;
        return this._super.apply(this, arguments);
    },
});

// The goal of this dialog is to ask the user a signature request.
// It uses @see SignNameAndSignature for the name and signature fields.
const SignatureDialog = Dialog.extend({
    template: 'sign.signature_dialog',

    custom_events: {
        'signature_changed': '_onChangeSignature',
    },

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * Allows options.
     *
     * @constructor
     * @param {Widget} parent
     * @param {Object} options
     * @param {string} [options.title='Adopt Your Signature'] - modal title
     * @param {string} [options.size='medium'] - modal size
     * @param {Object} [options.nameAndSignatureOptions={}] - options for
     *  @see NameAndSignature.init()
     * @param {number} requestID
     * @param {string} accessToken
     */
    init: function (parent, options, requestID, accessToken) {
        options = options || {};

        options.title = options.title || _t("Adopt Your Signature");
        options.size = options.size || 'medium';
        options.technical = false;
        if (config.device.isMobile) {
            options.technical = true;
            options.fullscreen = true;
        }

        if (!options.buttons) {
            options.buttons = [];
            options.buttons.push({text: _t("Cancel"), close: true});
            options.buttons.push({text: _t("Sign all"), classes: "btn-secondary", disabled: true, click: (e) => {
                //this.confirmAllFunction is undefined in documents with no sign items
                this.confirmAllFunction ? this.confirmAllFunction() : this.confirmFunction();
            }});
            options.buttons.push({text: _t("Adopt and Sign"), classes: "btn-primary", disabled: true, click: (e) => {
                this.confirmFunction();
            }});
        }

        this._super(parent, options);

        this.confirmFunction = function () {};

        this.nameAndSignature = new SignNameAndSignature(this, options.nameAndSignatureOptions, requestID, accessToken);
    },
    /**
     * Start the nameAndSignature widget and wait for it.
     *
     * @override
     */
        willStart: function () {
            return Promise.all([
                this.nameAndSignature.appendTo($('<div>')),
                this._super.apply(this, arguments)
            ]);
        },
    /**
     * Initialize the name and signature widget when the modal is opened.
     *
     * @override
     */
    start: function () {
        var self = this;
        this.$primaryButton = this.$footer.find('.btn-primary');
        this.$secondaryButton = this.$footer.find('.btn-secondary');
        this.opened().then(function () {
            self.$('.o_web_sign_name_and_signature').replaceWith(self.nameAndSignature.$el);
            // initialize the signature area
            self.nameAndSignature.resetSignature();
        });
        return this._super.apply(this, arguments);
    },

    onConfirm: function (fct) {
        this.confirmFunction = fct;
    },

    onConfirmAll: function (fct) {
        this.confirmAllFunction = fct;
    },

    /**
     * Gets the name currently given by the user.
     *
     * @see NameAndSignature.getName()
     * @returns {string} name
     */
    getName: function () {
        return this.nameAndSignature.getName();
    },
    /**
     * Gets the signature currently drawn.
     *
     * @see NameAndSignature.getSignatureImage()
     * @returns {string[]} Array that contains the signature as a bitmap.
     *  The first element is the mimetype, the second element is the data.
     */
    getSignatureImage: function () {
        return this.nameAndSignature.getSignatureImage();
    },
    /**
     * Gets the signature currently drawn, in a format ready to be used in
     * an <img/> src attribute.
     *
     * @see NameAndSignature.getSignatureImageSrc()
     * @returns {string} the signature currently drawn, src ready
     */
    getSignatureImageSrc: function () {
        return this.nameAndSignature.getSignatureImageSrc();
    },
    /**
     * Returns whether the drawing area is currently empty.
     *
     * @see NameAndSignature.isSignatureEmpty()
     * @returns {boolean} Whether the drawing area is currently empty.
     */
    isSignatureEmpty: function () {
        return this.nameAndSignature.isSignatureEmpty();
    },
    /**
     * Gets the current name and signature, validates them, and
     * returns the result. If they are invalid, it also displays the
     * errors to the user.
     *
     * @see NameAndSignature.validateSignature()
     * @returns {boolean} whether the current name and signature are valid
     */
    validateSignature: function () {
        return this.nameAndSignature.validateSignature();
    },

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * Toggles the submit button depending on the signature state.
     *
     * @private
     */
    _onChangeSignature: function () {
        var isEmpty = this.nameAndSignature.isSignatureEmpty();
        this.$primaryButton.prop('disabled', isEmpty);
        this.$secondaryButton.prop('disabled', isEmpty);
    },
    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
            // this trigger the adding of a custom css
            this.$modal.addClass('o_sign_signature_dialog');
        },
});

const SignItemNavigator = Widget.extend({
    className: 'o_sign_sign_item_navigator',

    events: {
        'click': 'onClick'
    },

    init: function(parent, types) {
        this._super(parent);

        this.types = types;
        this.started = false;
        this.isScrolling = false;
    },

    start: function() {
        this.$signatureItemNavLine = $('<div/>').addClass("o_sign_sign_item_navline").insertBefore(this.$el);
        this.setTip(_t("Click to start"));
        this.$el.focus();

        return this._super();
    },

    setTip: function(tip) {
        this.$el.text(tip);
    },

    onClick: function(e) {
        this.goToNextSignItem();
    },

    goToNextSignItem() {
        var self = this;

        if(!self.started) {
            self.started = true;

            self.getParent().$iframe.prev().animate({'height': '0px', 'opacity': 0}, {
                duration: 750,
                complete: function() {
                    self.getParent().$iframe.prev().hide();
                    self.getParent().refreshSignItems();

                    self.goToNextSignItem();
                }
            });

            return false;
        }

        var $toComplete = self.getParent().checkSignItemsCompletion().sort(function(a, b) {
            return ($(a).data('order') || 0) - ($(b).data('order') || 0);
        });
        if($toComplete.length > 0) {
            self.scrollToSignItem($toComplete.first());
        }
    },

    scrollToSignItem: function($item) {
        var self = this;
        if(!this.started) {
            return;
        }
        this._scrollToSignItemPromise($item).then(function () {
            const type = self.types[$item.data('type')];
            if(type.item_type === 'text') {
                $item.val = () => {return $item.find('input').val()}
                $item.focus = () => $item.find('input').focus()
            }

            if($item.val() === "" && !$item.data('signature')) {
                self.setTip(type.tip);
            }

            self.getParent().refreshSignItems();
            $item.focus();
            if (['signature', 'initial'].indexOf(type.item_type) > -1) {
                if($item.data("has-focus")) {
                    $item.click();
                } else {
                    $item.data("has-focus", true);
                }
            }
            self.isScrolling = false;
        });

        this.getParent().$('.ui-selected').removeClass('ui-selected');
        $item.addClass('ui-selected').focus();
    },

    _scrollToSignItemPromise($item) {
        if (config.device.isMobile) {
            return new Promise(resolve => {
                this.isScrolling = true;
                $item[0].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
                resolve();
            });
        }

        var $container = this.getParent().$('#viewerContainer');
        var $viewer = $container.find('#viewer');
        var containerHeight = $container.outerHeight();
        var viewerHeight = $viewer.outerHeight();

        var scrollOffset = containerHeight/4;
        var scrollTop = $item.offset().top - $viewer.offset().top - scrollOffset;
        if(scrollTop + containerHeight > viewerHeight) {
            scrollOffset += scrollTop + containerHeight - viewerHeight;
        }
        if(scrollTop < 0) {
            scrollOffset += scrollTop;
        }
        scrollOffset += $container.offset().top - this.$el.outerHeight()/2 + parseInt($item.css('height'))/2;

        var duration = Math.min(
            1000,
            5*(Math.abs($container[0].scrollTop - scrollTop) + Math.abs(parseFloat(this.$el.css('top')) - scrollOffset))
        );

        var self = this;
        this.isScrolling = true;
        var def1 = new Promise(function (resolve, reject) {
            $container.animate({'scrollTop': scrollTop}, duration, function () {
                resolve();
                core.bus.trigger("resize");
            })
        });
        var def2 = new Promise(function (resolve, reject) {
            self.$el.add(self.$signatureItemNavLine).animate({'top': scrollOffset}, duration, function() {
                resolve();
                core.bus.trigger("resize");
            })
        });
        return Promise.all([def1, def2]);
    },
});

const PublicSignerDialog = Dialog.extend({
    template: "sign.public_signer_dialog",

    init: function(parent, requestID, requestToken, RedirectURL, options) {
        var self = this;
        options = (options || {});

        options.title = options.title || _t("Final Validation");
        options.size = options.size || "medium";
        options.technical = false;

        if (config.device.isMobile) {
            options.technical = true;
            options.fullscreen = true;
        }

        if(!options.buttons) {
            options.buttons = [];
            options.buttons.push({text: _t("Validate & Send"), classes: "btn-primary", click: function(e) {
                var name = this.$inputs.eq(0).val();
                var mail = this.$inputs.eq(1).val();
                if(!name || !mail || mail.indexOf('@') < 0) {
                    this.$inputs.eq(0).closest('.form-group').toggleClass('o_has_error', !name).find('.form-control, .custom-select').toggleClass('is-invalid', !name);
                    this.$inputs.eq(1).closest('.form-group').toggleClass('o_has_error', !mail || mail.indexOf('@') < 0).find('.form-control, .custom-select').toggleClass('is-invalid', !mail || mail.indexOf('@') < 0);
                    return false;
                }

                ajax.jsonRpc("/sign/send_public/" + this.requestID + '/' + this.requestToken, 'call', {
                    name: name,
                    mail: mail,
                }).then(function() {
                    self.close();
                    self.sentResolve();
                });
            }});
            options.buttons.push({text: _t("Cancel"), close: true});
            this.options = options;
        }

        this._super(parent, options);

        this.requestID = requestID;
        this.requestToken = requestToken;
        this.sent = new Promise(function(resolve) {
            self.sentResolve = resolve;
        });
    },

    open: function(name, mail) {
        var self = this;
        this.opened(function() {
            self.$inputs = self.$('input');
            self.$inputs.eq(0).val(name);
            self.$inputs.eq(1).val(mail);
        });
        return this._super.apply(this, arguments);
    },
});

const SMSSignerDialog = Dialog.extend({
    template: "sign.public_sms_signer",

    events: {
        'click button.o_sign_resend_sms': function(e) {
            var $btn = this.$('.o_sign_resend_sms');
            $btn.attr('disabled', true);
            var route = '/sign/send-sms/' + this.requestID + '/' + this.requestToken + '/' + this.$('#o_sign_phone_number_input').val();
            session.rpc(route, {}).then(function(success) {
                if (!success) {
                    Dialog.alert(this, _t("Unable to send the SMS, please contact the sender of the document."), {
                        title: _t("Error"),
                    });
                }
                else {
                    $btn.html("<span><i class='fa fa-check'/> "+_t("SMS Sent")+"</span>");
                    setTimeout(function() {
                        $btn.removeAttr('disabled');
                        $btn.text(_t('Re-send SMS'));
                    }, 15000);
                }
            }).guardedCatch(function (error) {
                $btn.removeAttr('disabled');
                Dialog.alert(this, _t("Unable to send the SMS, please contact the sender of the document."), {
                    title: _t("Error"),
                });
            });
        }
    },

    _onValidateSMS: function () {
        var $btn = this.$('.o_sign_validate_sms');
        var input = this.$('#o_sign_public_signer_sms_input');
        if(!input.val()) {
            input.closest('.form-group').toggleClass('o_has_error').find('.form-control, .custom-select').toggleClass('is-invalid');
            return false;
        }
        var route = '/sign/sign/' + this.requestID + '/' + this.requestToken + '/' + input.val();
        var params = {
            signature: this.signature,
            new_sign_items: this.newSignItems
        };
        var self = this;
        $btn.attr('disabled', true);
        session.rpc(route, params).then(function(response) {
            if (!response) {
                Dialog.alert(self, _t("Your signature was not submitted. Ensure that all required field of the documents are completed and that the SMS validation code is correct."), {
                    title: _t("Error"),
                });
                $btn.removeAttr('disabled');
            }
            if (response === true) {
                (new (self.get_thankyoudialog_class())(self, self.RedirectURL, self.RedirectURLText,
                    self.requestID, {'nextSign': (self.name_list || []).length})).open();
                self.do_hide();
            }
        });
    },

    get_thankyoudialog_class: function () {
        return ThankYouDialog;
    },

    init: function(parent, requestID, requestToken, signature, newSignItems, signerPhone, RedirectURL, options) {
        options = (options || {});
        if (config.device.isMobile) {
            options.fullscreen = true;
        }
        options.title = options.title || _t("Final Validation");
        options.size = options.size || "medium";
        if(!options.buttons) {
            options.buttons = [{
                text: _t("Verify"),
                classes: "btn btn-primary o_sign_validate_sms",
                click: this._onValidateSMS
            }];
        }
        this._super(parent, options);
        this.requestID = requestID;
        this.requestToken = requestToken;
        this.signature = signature;
        this.newSignItems = newSignItems;
        this.signerPhone = signerPhone;
        this.RedirectURL = RedirectURL;
        this.sent = $.Deferred();
    },
});

const EncryptedDialog = Dialog.extend({
    template: "sign.public_password",

    _onValidatePassword: function () {
        var input = this.$('#o_sign_public_signer_password_input');
        if(!input.val()) {
            input.closest('.form-group').toggleClass('o_has_error').find('.form-control, .custom-select').toggleClass('is-invalid');
            return false;
        }
        var route = '/sign/password/' + this.requestID ;
        var params = {
            password: input.val()
        };
        var self = this;
        session.rpc(route, params).then(function(response) {
            if (!response) {
                Dialog.alert(self, _t("Password is incorrect."), {
                    title: _t("Error"),
                });
            }
            if (response === true) {
                self.close();
            }
        });
    },

    init: function(parent, requestID, options) {
        options = (options || {});
        if (config.device.isMobile) {
            options.fullscreen = true;
        }
        options.title = options.title || _t("PDF is encrypted");
        options.size = options.size || "medium";
        if(!options.buttons) {
            options.buttons = [{
                text: _t("Generate PDF"),
                classes: "btn btn-primary o_sign_validate_encrypted",
                click: this._onValidatePassword
            }];
        }
        this._super(parent, options);
        this.requestID = requestID;
    },

    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        this.$modal.find('button.close').addClass('invisible');
    },
});

const ThankYouDialog = Dialog.extend({
    events: {
        'click .o_go_to_document': 'on_closed',
    },

    get_passworddialog_class: function () {
        return EncryptedDialog;
    },

    init: function(parent, RedirectURL, RedirectURLText, requestID, options) {
        var self = this;
        options = (options || {});
        options.title = options.title || _t("Thank You !");
        options.subtitle = options.subtitle || _t("Your signature has been saved.");
        options.size = options.size || "medium";
        options.technical = false;
        options.buttons = [];
        if (RedirectURL) {
            // check if url contains http:// or https://
            if (!/^(f|ht)tps?:\/\//i.test(RedirectURL)) {
                RedirectURL = "http://" + RedirectURL;
                }
            options.buttons.push({text: RedirectURLText, classes: 'btn-primary', click: function (e) {
                window.location.replace(RedirectURL);
            }});
        }
        this.options = options;
        this.has_next_document = false;
        this.RedirectURL = RedirectURL;
        this.requestID = requestID;

        this._super(parent, options);

        this.on('closed', this, this.on_closed);
        this._rpc({
            route: '/sign/encrypted/' + requestID
        }).then(function (response) {
            if (response === true) {
                (new (self.get_passworddialog_class())(self, requestID)).open();
            }
        });

    },

    start: async function () {
        var self = this;
        var result = false;
        const nextTemplate = multiFileUpload.getNext();
        var canReadRequestItem = await session.user_has_group('sign.group_sign_user');
        if (canReadRequestItem) {
            result = await this._rpc({
                model: 'sign.request.item',
                method: 'search_read',
                domain: ['&','&', ['partner_id', '=', session.partner_id], ['state', '=', 'sent'], ['id', '!=', this.requestID]],
                fields: ['sign_request_id'],
                orderBy: [{name: 'create_date', desc: true}]
            });
        }

        var openDocumentButton = {
            text: _t('View Document'),
            click: function (e) {
                if (canReadRequestItem) {
                    self._rpc({
                        model: 'sign.request',
                        method: 'go_to_document',
                        args: [self.requestID],
                    }).then(function(action) {
                        self.do_action(action, {clear_breadcrumbs: true});
                    });
                } else {
                    window.location.reload();
                }
            }
        };

        if (nextTemplate && nextTemplate.template) {
            openDocumentButton.classes = 'btn-secondary';
            this.options.buttons.push(openDocumentButton);

            this.options.buttons.push({
                text: _t('Next Document'), classes: 'btn-primary', click: function (e) {
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
                }
            });

        } else if (result && result.length) {
            this.has_next_document = true;

            openDocumentButton.classes = 'btn-secondary';
            this.options.buttons.push(openDocumentButton);

            this.next_document = result.reduce(function (prev, curr) {
                return (Math.abs(curr.sign_request_id[0] - self.requestID) <= Math.abs(prev.sign_request_id[0] - self.requestID) ? curr : prev);
            });
            this.options.buttons.push({
                text: _t('Sign Next Document'), classes: 'btn-primary', click: function (e) {
                    self._rpc({
                        model: 'sign.request',
                        method: 'go_to_document',
                        args: [self.next_document.sign_request_id[0]],
                    }).then(function(action) {
                        self.do_action(action, {clear_breadcrumbs: true});
                    });
                }
            });
        } else {
            openDocumentButton.classes = 'btn-primary';
            if (!this.RedirectURL) {
                this.options.buttons.push(openDocumentButton);
            }
        }
        this.setElement($(core.qweb.render('sign.thank_you_dialog', {widget: this})));
        this.set_buttons(this.options.buttons);
        await this.renderElement();
    },

    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        // this trigger the adding of a custom css
        this.$modal.addClass('o_sign_thank_you_dialog');
        this.$modal.find('button.close').addClass('invisible');
        this.$modal.find('.modal-header .o_subtitle').before('<br/>');
    },

    on_closed: function () {
        window.location.reload();
    },
});

const NextDirectSignDialog = Dialog.extend({
    template: "sign.next_direct_sign_dialog",
    events: {
        'click .o_go_to_document': 'on_closed',
        'click .o_nextdirectsign_link': 'on_click_next',
    },

    init: function(parent, RedirectURL, requestID, options) {
        this.token_list = (parent.token_list || {});
        this.name_list = (parent.name_list || {});
        this.requestID = parent.requestID;
        this.create_uid = parent.create_uid;
        this.state = parent.state;

        options = (options || {});
        options.title = options.title || _t("Thank You !") + "<br/>";
        options.subtitle = options.subtitle || _t("Your signature has been saved.") + " " +_.str.sprintf(_t("Next signatory is %s"), this.name_list[0]);
        options.size = options.size || "medium";
        options.technical = false;
        if (config.device.isMobile) {
            options.technical = true;
            options.fullscreen = true;
        }
        options.buttons = [{text: _.str.sprintf(_t("Next signatory (%s)"), this.name_list[0]), click: this.on_click_next}],
        this.options = options;
        this.RedirectURL = "RedirectURL";
        this.requestID = requestID;
        this._super(parent, options);
    },

    /**
     * @override
     */
    renderElement: function () {
        this._super.apply(this, arguments);
        this.$modal.addClass('o_sign_next_dialog');
        this.$modal.find('button.close').addClass('invisible');
    },

    on_click_next: function () {

        var newCurrentToken = this.token_list[0];
        var newCurrentName = this.name_list[0];
        var self = this;
        this.token_list.shift();
        this.name_list.shift();

        self.do_action({
            type: "ir.actions.client",
            tag: 'sign.SignableDocument',
            name: _t("Sign"),
        }, {
            additional_context: {
                id: this.requestID,
                create_uid: this.create_uid,
                state: this.state,
                token: newCurrentToken,
                sign_token: newCurrentToken,
                token_list: this.token_list,
                name_list: this.name_list,
                current_signor_name: newCurrentName,
            },
            replace_last_action: true,
        });

        this.destroy();
    },
});

const SignablePDFIframe = PDFIframe.extend({
    init: function() {
        this._super.apply(this, arguments);

        this.events = _.extend(this.events || {}, {
            'keydown .page .ui-selected': function(e) {
                if((e.keyCode || e.which) !== 13) {
                    return true;
                }
                e.preventDefault();
                this.signatureItemNav.goToNextSignItem();
            },
        });
        this.nextSignature = '';
        this.nextInitial = '';
    },

    fetchSignature: function (signatureType='signature') {
        var self = this;
        const shouldRequestSignature = Object.values(self.signatureItems).some((currentSignature) => {
            return self.types[currentSignature.type].item_type === signatureType
        });

        if (shouldRequestSignature) {
            return self._rpc({
                route: '/sign/get_signature/' + self.getParent().requestID + '/' + self.getParent().accessToken,
                params: {
                    signature_type: signatureType,
                },
            }).then(function (signature) {
                if (signature) {
                    signature = 'data:image/png;base64,' + signature;
                    if (signatureType === 'signature') {
                        self.nextSignature = signature;
                    } else {
                        self.nextInitial = signature
                    }
                }
            });
        }
    },

    doPDFPostLoad: function() {
        var self = this;

        Promise.all([
            this.fullyLoaded,
            this.fetchSignature('signature'),
            this.fetchSignature('initial')
        ]).then(function() {
            self.signatureItemNav = new SignItemNavigator(self, self.types);
            return self.signatureItemNav.prependTo(self.$('#viewerContainer')).then(function () {

                self.checkSignItemsCompletion();

                self.$('#viewerContainer').on('scroll', function(e) {
                    if(!self.signatureItemNav.isScrolling && self.signatureItemNav.started) {
                        self.signatureItemNav.setTip(_t('next'));
                    }
                });
            });
        });

        this._super.apply(this, arguments);
    },

    createSignItem: function(type, required, responsible, posX, posY, width, height, value, options, name, tooltip, alignment, isSignItemEditable) {
        // jQuery.data parse 0 as integer, but 0 is not considered falsy for signature item
        if (value === 0) {
            value = "0";
        }
        var self = this;
        var $signatureItem = this._super.apply(this, arguments);
        var readonly = this.readonlyFields || (responsible > 0 && responsible !== this.role) || !!value;
        if(!readonly) {
            // Do not display the placeholder of Text and Multiline Text if the name of the item is the default one.
            if ([_t('Text'), _t('Multiline Text')].includes(type.name) && type.placeholder === $signatureItem.prop('placeholder')) {
                $signatureItem.attr('placeholder', ' ');
                $signatureItem.find(".o_placeholder").text(" ");
            }
            if (type.name === _t("Date")) {
                $signatureItem.on('focus', function(e) {
                    if($signatureItem.val() === "") {
                        $signatureItem.val(moment().format(time.getLangDateFormat()));
                        $signatureItem.trigger('input');
                    }
                });
            }
            if (type.item_type === "signature" || type.item_type === "initial") {
                // in edit while signing mode, both edit and sign are possible.
                // So we sign when .o_sign_item_display is clicked, instead of a click in the signatureItem
                const clickableSignItem = isSignItemEditable ? $signatureItem.find('.o_sign_item_display') : $signatureItem;
                clickableSignItem.on('click', function(e) {
                    self.refreshSignItems();
                    /** Logic for wizard/mark behavior is: 
                     * If type is signature, nextSignature is defined and the item is not marked yet, the default signature is used
                     * Else, wizard is opened.
                     * If type is initial, other initial items were already signed and item is not marked yet, the previous initial is used
                     * Else, wizard is opened.
                     * */
                    if (type.item_type === "signature" && self.nextSignature && !$signatureItem.data('signature')) {
                        self.adjustSignatureSize(self.nextSignature, $signatureItem).then(data => {
                            $signatureItem.data('signature', data)
                                .empty().append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: $signatureItem.data('signature')}));
                            $signatureItem.trigger('input');
                        });
                    } else if (type.item_type === "initial" && self.nextInitial && !$signatureItem.data('signature')) {
                        self.adjustSignatureSize(self.nextInitial, $signatureItem).then(data => {
                            $signatureItem.data('signature', data)
                                .empty().append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: $signatureItem.data('signature')}));
                            $signatureItem.trigger('input');
                        })
                    } else {
                        var nameAndSignatureOptions = {
                            defaultName: self.getParent().signerName || "",
                            fontColor: 'DarkBlue',
                            signatureType: type.item_type,
                            displaySignatureRatio: parseFloat($signatureItem.css('width')) / parseFloat($signatureItem.css('height')),
                        };
                        var signDialog = new SignatureDialog(self, {nameAndSignatureOptions: nameAndSignatureOptions}, self.getParent().requestID, self.getParent().accessToken);

                        signDialog.open().onConfirm(function () {
                            if (!signDialog.isSignatureEmpty()) {
                                var name = signDialog.getName();
                                var signature = signDialog.getSignatureImageSrc();
                                self.getParent().signerName = name;

                                self.updateNextSignatureOrInitial(type.item_type, signature);

                                if(signDialog.nameAndSignature.signatureChanged) {
                                    self.updateUserSignature(type.item_type, signature);
                                }

                                $signatureItem.data({
                                    'signature': signature,
                                }).empty().append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: $signatureItem.data('signature')}));
                            } else {
                                $signatureItem.removeData('signature')
                                                .empty()
                                                .append($('<span/>').addClass("o_sign_helper"), type.placeholder);
                            }

                            $signatureItem.trigger('input').focus();
                            signDialog.close();
                        });

                        signDialog.onConfirmAll(async function () {
                            for (const pageNumber of Object.keys(self.configuration)) {
                                const page = self.configuration[pageNumber];
                                const name = signDialog.getName();
                                const signature = signDialog.getSignatureImageSrc();
                                self.getParent().signerName = name;

                                self.updateNextSignatureOrInitial(type.item_type, signature);

                                if(signDialog.nameAndSignature.signatureChanged) {
                                    self.updateUserSignature(type.item_type, signature)
                                }

                                await Promise.all(page.reduce((promise, item) => {
                                    if (item.data('type') === type.id && item.data('responsible') === self.role) {
                                        promise.push(self.adjustSignatureSize(signature, item).then(data => {
                                            item.data('signature', data)
                                            .empty()
                                            .append($('<span/>').addClass("o_sign_helper"), $('<img/>', {src: item.data('signature')}));
                                        }));
                                    }
                                    return promise;
                                }, []))
                            }
                            $signatureItem.trigger('input').focus();
                            signDialog.close();
                        })
                    }
                });
            }

            if(type.auto_field) {
                $signatureItem.on('focus', function(e) {
                    if($signatureItem.val() === "") {
                        $signatureItem.val(type.auto_field);
                        $signatureItem.trigger('input');
                    }
                });
            }

            if (config.device.isMobile && ['text', 'textarea'].includes(type.item_type)) {
                const inputBottomSheet = new InputBottomSheet(self, {
                    type: type.item_type,
                    value: $signatureItem.val(),
                    label: `${type.tip}: ${type.placeholder}`,
                    placeholder: $signatureItem.attr('placeholder'),
                    onTextChange: (value) => {
                        $signatureItem.val(value);
                    },
                    onValidate: (value) => {
                        $signatureItem.val(value);
                        $signatureItem.trigger('input');
                        inputBottomSheet.hide();
                        this.signatureItemNav.goToNextSignItem();
                    },
                });
                inputBottomSheet.appendTo(document.body);

                $signatureItem.on('focus', () => {
                    inputBottomSheet.updateInputText($signatureItem.val());
                    inputBottomSheet.show();
                });
            }

            $signatureItem.on('input', function(e) {
                self.checkSignItemsCompletion(self.role);
                self.signatureItemNav.setTip(_t('next'));
            });
        } else {
            $signatureItem.val(value);
        }
        return $signatureItem;
    },

    updateNextSignatureOrInitial (type, signature) {
        if (type === 'signature') {
            this.nextSignature = signature
        } else {
            this.nextInitial = signature
        }
    },

    updateUserSignature (type, signature) {
        this._rpc({
            route: '/sign/update_user_signature/',
            params: {
                sign_request_id: this.getParent().requestID,
                role: this.role,
                signature_type: type === 'signature' ? 'sign_signature' : 'sign_initials',
                datas: signature
            }
        })
    },

    adjustSignatureSize: function (data, signatureItem) {
        return new Promise(function (resolve, _) {
            var img = new Image()
            , c = document.createElement('canvas');

            c.height = signatureItem.height();
            c.width = signatureItem.width();

            img.onload = function () {
                var ctx = c.getContext("2d");
                var oldShadowColor = ctx.shadowColor;
                ctx.shadowColor = "transparent";
                var ratio = ((img.width / img.height) > (c.width / c.height)) ? c.width / img.width : c.height / img.height;

                ctx.drawImage( 
                    img,
                    (c.width / 2) - (img.width * ratio / 2),
                    (c.height / 2) - (img.height * ratio / 2)
                    , img.width * ratio
                    , img.height * ratio
                );
                ctx.shadowColor = oldShadowColor;
                resolve(c.toDataURL())
            };
            img.src = data;
        })
    },

    checkSignItemsCompletion: function() {
        this.refreshSignItems();
        var $toComplete = this.$('.o_sign_sign_item.o_sign_sign_item_required:not(.o_sign_sign_item_pdfview)').filter(function(i, el) {
            var $elem = $(el);
            /* in edit mode, the text sign item has a different html structure due to the form and resize/close icons
            for this reason, we need to check the input field inside the element to check if it has a value */
            $elem = $elem.data('isEditMode') && $elem.attr('type') === 'text' ? $elem.find('input') : $elem;
            var unchecked_box = $elem.val() == 'on' && !$elem.is(":checked");
            return !(($elem.val() && $elem.val().trim()) || $elem.data('signature')) || unchecked_box;
        });

        this.signatureItemNav.$el.add(this.signatureItemNav.$signatureItemNavLine).toggle($toComplete.length > 0);
        this.$iframe.trigger(($toComplete.length > 0)? 'pdfToComplete' : 'pdfCompleted');

        return $toComplete;
    },
});
const InputBottomSheet = Widget.extend({
    events: {
        'blur .o_sign_item_bottom_sheet_field': '_onBlurField',
        'keyup .o_sign_item_bottom_sheet_field': '_onKeyUpField',
        'click .o_sign_next_button': '_onClickNext',
    },
    template: 'sign.item_bottom_sheet',

    init(parent, options) {
        this._super(...arguments);

        this.type = options.type || 'text';
        this.placeholder = options.placeholder || '';
        this.label = options.label || this.placeholder;
        this.value = options.value || '';
        this.buttonText = options.buttonText || _t('next');
        this.onTextChange = options.onTextChange || function () {};
        this.onValidate = options.onValidate || function () {};
    },

    updateInputText(text) {
        this.value = text;
        this.el.querySelector('.o_sign_item_bottom_sheet_field').value = text;
        this._toggleButton();
    },

    show() {
        // hide previous bottom sheet
        const bottomSheet = document.querySelector('.o_sign_item_bottom_sheet.show');
        if (bottomSheet) {
            bottomSheet.classList.remove('show');
        }

        this._toggleButton();
        this.el.style.display = 'block';
        setTimeout(() => this.el.classList.add('show'));
        this.el.querySelector('.o_sign_item_bottom_sheet_field').focus();
    },

    hide() {
        this.el.classList.remove('show');
        this.el.addEventListener('transitionend', () => this.el.style.display = 'none', {once: true});
    },

    _toggleButton() {
        const buttonNext = this.el.querySelector('.o_sign_next_button');
        if (this.value.length) {
            buttonNext.removeAttribute('disabled');
        } else {
            buttonNext.setAttribute('disabled', 'disabled');
        }
    },

    _updateText() {
        this.value = this.el.querySelector('.o_sign_item_bottom_sheet_field').value;
        this.onTextChange(this.value);
        this._toggleButton();
    },

    _onBlurField() {
        this._updateText();
    },

    _onClickNext() {
        this.onValidate(this.value);
    },

    _onKeyUpField() {
        this._updateText();
    },
});
const SignableDocument = Document.extend({
    events: {
        'pdfToComplete .o_sign_pdf_iframe': function(e) {
            this.$validateBanner.hide().css('opacity', 0);
        },

        'pdfCompleted .o_sign_pdf_iframe': function(e) {
            if (this.name_list && this.name_list.length > 0) {
                var next_name_signatory = this.name_list[0];
                var next_signatory = _.str.sprintf(_t("Validate & the next signatory is %s"), next_name_signatory);
                this.$validateBanner.find('.o_validate_button').prop('textContent', next_signatory);
            }
            this.$validateBanner.show().animate({'opacity': 1}, 500, () => {
                if (config.device.isMobile) {
                    this.$validateBanner[0].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
                }
            });
        },

        'click .o_sign_validate_banner button': 'signItemDocument',
        'click .o_sign_sign_document_button': 'signDocument',
    },

    custom_events: { // do_notify is not supported in backend so it is simulated with a bootstrap alert inserted in a frontend-only DOM element
        'notification': function (e) {
            $('<div/>', {html: e.data.message}).addClass('alert alert-success').insertAfter(this.$('.o_sign_request_reference_title'));
        },
    },

    init: function (parent, options) {
        this._super(parent, options);
        if (parent) {
            this.token_list = (parent.token_list || {});
            this.name_list = (parent.name_list || {});
            this.create_uid = parent.create_uid;
            this.state = parent.state;
            this.current_name = parent.current_name;
            this.documentID = parent.documentID;
        }

        if (this.current_name) {
            $('<div class="col-lg-2">')
                .append(
                    $('<div class="o_sign_request_signer text-center text-secondary">')
                        .text(_t('Signing as '))
                        .append('<b>', {text: this.current_name}))
                .appendTo(parent.$('div.container-fluid .col-lg-3').first());
            parent.$('div.container-fluid .col-lg-3').first().removeClass('col-lg-3').addClass('col-lg-5');
            parent.$('div.container-fluid .col-lg-9').first().removeClass('col-lg-9').addClass('col-lg-5');
        }
    },

    get_pdfiframe_class: function () {
        return SignablePDFIframe;
    },

    get_thankyoudialog_class: function () {
        return ThankYouDialog;
    },

    get_nextdirectsigndialog_class: function () {
        return NextDirectSignDialog;
    },

    signItemDocument: function(e) {
        var $btn = this.$('.o_sign_validate_banner button');
        var init_btn_text = $btn.text();
        $btn.prepend('<i class="fa fa-spin fa-circle-o-notch" />');
        $btn.attr('disabled', true);
        var mail = "";
        this.iframeWidget.$('.o_sign_sign_item').each(function(i, el) {
            var value = $(el).val();
            if(value && value.indexOf('@') >= 0) {
                mail = value;
            }
        });

        if(this.$('#o_sign_is_public_user').length > 0) {
            (new PublicSignerDialog(this, this.requestID, this.requestToken, this.RedirectURL))
                .open(this.signerName, mail).sent.then(_.bind(_sign, this));
        } else {
            _sign.call(this);
        }

        function _sign() {
            var signatureValues = {};
            var newSignItems = {};
            for(var page in this.iframeWidget.configuration) {
                for(var i = 0 ; i < this.iframeWidget.configuration[page].length ; i++) {
                    var $elem = this.iframeWidget.configuration[page][i];
                    var resp = parseInt($elem.data('responsible')) || 0;
                    if(resp > 0 && resp !== this.iframeWidget.role) {
                        continue;
                    }
                    let value = ($elem.val() && $elem.val().trim())? $elem.val() : ($elem.find('input').val() || false);
                    if($elem.data('signature')) {
                        value = $elem.data('signature');
                    }
                    if($elem[0].type === 'checkbox') {
                        value = false ;
                        if ($elem[0].checked) {
                            value = 'on';
                        } else {
                            if (!$elem.data('required')) value = 'off';
                        }
                    } else if($elem[0].type === 'textarea') {
                        value = this.textareaApplyLineBreak($elem[0]);
                    }
                    if(!value) {
                        if($elem.data('required')) {
                            this.iframeWidget.checkSignItemsCompletion();
                            Dialog.alert(this, _t("Some fields have still to be completed !"), {title: _t("Warning")});
                            $btn.removeAttr('disabled', true);
                            return;
                        }
                        continue;
                    }

                    signatureValues[parseInt($elem.data('item-id'))] = value;

                    if ($elem.data('isEditMode')) {
                        const id = $elem.data('item-id');
                        newSignItems[id] = {
                            'type_id': $elem.data('type'),
                            'required': $elem.data('required'),
                            'name': $elem.data('name') || false,
                            'option_ids': $elem.data('option_ids'),
                            'responsible_id': resp,
                            'page': page,
                            'posX': $elem.data('posx'),
                            'posY': $elem.data('posy'),
                            'width': $elem.data('width'),
                            'height': $elem.data('height'),
                        };
                    }
                }
            }
            var route = '/sign/sign/' + this.requestID + '/' + this.accessToken;
            var params = {
                signature: signatureValues,
                new_sign_items: newSignItems,
            };
            var self = this;
            session.rpc(route, params).then(function(response) {
                $btn.text(init_btn_text);
                if (!response) {
                    Dialog.alert(self, _t("Sorry, an error occured, please try to fill the document again."), {
                        title: _t("Error"),
                        confirm_callback: function() {
                            window.location.reload();
                        },
                    });
                }
                if (response === true) {
                    $btn.removeAttr('disabled', true);
                    self.iframeWidget.disableItems();
                    if (self.name_list && self.name_list.length > 0) {
                        (new (self.get_nextdirectsigndialog_class())(self, self.RedirectURL, self.requestID,
                            {'nextSign': self.name_list.length})).open();
                    }
                    else {
                        (new (self.get_thankyoudialog_class())(self, self.RedirectURL, self.RedirectURLText, self.requestID,
                            {'nextSign': 0})).open();
                    }
                }
                if (typeof response === 'object') {
                    $btn.removeAttr('disabled', true);
                    if (response.sms) {
                        (new SMSSignerDialog(self, self.requestID, self.accessToken, signatureValues,
                            newSignItems, self.signerPhone, self.RedirectURL,
                            {'nextSign': self.name_list.length})).open();
                    }
                    if (response.credit_error) {
                        Dialog.alert(self, _t("Unable to send the SMS, please contact the sender of the document."), {
                            title: _t("Error"),
                            confirm_callback: function() {
                                window.location.reload();
                            },
                        });
                    }
                    if (response.url) {
                        document.location.pathname = response.url;
                    }
                }
            });
        }
    },

    signDocument: function (e) {
        var self = this;
        if (self.iframeWidget && self.iframeWidget.signatureItems && Object.keys(self.iframeWidget.signatureItems).length > 0) {
            return this.signItemDocument();
        }
        var nameAndSignatureOptions = {
            fontColor: 'DarkBlue',
            defaultName: this.signerName
        };
        var options = {nameAndSignatureOptions: nameAndSignatureOptions};
        var signDialog = new SignatureDialog(this, options, self.requestID, self.accessToken);

        signDialog.open().onConfirm(function () {
            if (!signDialog.validateSignature()) {
                return false;
            }

            var name = signDialog.getName();
            var signature = signDialog.getSignatureImage()[1];

            signDialog.$('.modal-footer .btn-primary').prop('disabled', true);
            signDialog.close();

            if (self.$('#o_sign_is_public_user').length > 0) {
                (new PublicSignerDialog(self, self.requestID, self.requestToken, this.RedirectURL,
                    {'nextSign': self.name_list.length})).open(name, "").sent.then(_sign);
            } else {
                _sign();
            }

            function _sign() {
                ajax.jsonRpc('/sign/sign/' + self.requestID + '/' + self.accessToken, 'call', {
                    signature: signature,
                }).then(function(success) {
                    if(!success) {
                        setTimeout(function() { // To be sure this dialog opens after the thank you dialog below
                            Dialog.alert(self, _t("Sorry, an error occured, please try to fill the document again."), {
                                title: _t("Error"),
                                confirm_callback: function() {
                                    window.location.reload();
                                },
                            });
                        }, 500);
                    }
                });
                (new (self.get_thankyoudialog_class())(self, self.RedirectURL, self.RedirectURLText,
                    self.requestID, {'nextSign': self.name_list.length})).open();
            }
        });
    },

    textareaApplyLineBreak: function (oTextarea) {
        // Removing wrap in order to have scrollWidth > width
        oTextarea.setAttribute('wrap', 'off');

        var strRawValue = oTextarea.value;
        oTextarea.value = "";

        var nEmptyWidth = oTextarea.scrollWidth;
        var nLastWrappingIndex = -1;

        // Computing new lines
        for (var i = 0; i < strRawValue.length; i++) {
            var curChar = strRawValue.charAt(i);
            oTextarea.value += curChar;

            if (curChar === ' ' || curChar === '-' || curChar === '+') {
                nLastWrappingIndex = i;
            }

            if (oTextarea.scrollWidth > nEmptyWidth) {
                var buffer = '';
                if (nLastWrappingIndex >= 0) {
                    for (var j = nLastWrappingIndex + 1; j < i; j++) {
                        buffer += strRawValue.charAt(j);
                    }
                    nLastWrappingIndex = -1;
                }
                buffer += curChar;
                oTextarea.value = oTextarea.value.substr(0, oTextarea.value.length - buffer.length);
                oTextarea.value += '\n' + buffer;
            }
        }
        oTextarea.setAttribute('wrap', '');
        return oTextarea.value;
    }
});

function initDocumentToSign(parent) {
    return session.is_bound.then(function () {
        // Manually add 'sign' to module list and load the
        // translations.
        const modules = ['sign', 'web'];
        return session.load_translations(modules).then(function () {
            var documentPage = new SignableDocument(parent);
            return documentPage.attachTo($('body')).then(function() {
                // Geolocation
                var askLocation = ($('#o_sign_ask_location_input').length > 0);
                if(askLocation && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        var coords = _.pick(position.coords, ['latitude', 'longitude']);
                        ajax.jsonRpc('/sign/save_location/' + documentPage.requestID + '/' + documentPage.accessToken, 'call', coords);
                    });
                }
            });
        });
    });
}

export const document_signing = {
    EncryptedDialog,
    ThankYouDialog,
    initDocumentToSign,
    SignableDocument,
    SignNameAndSignature,
    SMSSignerDialog,
};
