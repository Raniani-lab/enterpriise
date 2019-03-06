odoo.define('voip.dialing_tab', function (require) {
"use strict";

var Phonecall = require('voip.phonecall');

var core = require('web.core');
var FieldUtils = require('web.field_utils');
var Widget = require('web.Widget');

var PhonecallTab = Widget.extend({
    template: "voip.DialingTab",
    events:{
    },
    /**
     * @constructor
     */
    init: function () {
        this._super.apply(this, arguments);
        this.phonecalls = [];
        this.selectedPhonecall = null;
        this.currentPhonecall = null;
    },
    /**
     * @override
     */
    start: function () {
        this._super.apply(this, arguments);
    },
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * When the user clicks on the call button and the details are displayed,
     * the first number is called.
     */
    callFirstNumber: function () {
        var number = this.selectedPhonecall.phone || this.selectedPhonecall.mobile;
        if (number) {
            this.currentPhonecall = this.selectedPhonecall;
            this.trigger_up('callNumber', {number: number});
        }
    },
    /**
     * When the user clicks on the call button when on a tab, without details open
     * Forces a switch to the keypad in the parent panel.
     */
    callFromTab: function () {
        this.trigger_up('switch_keypad');
    },
    /**
     * Triggers the hangup process then refreshes the tab.
     */
    hangupPhonecall: function (done) {
        var self = this;
        return this.currentPhonecall.hangUp(done).then(function () {
            self.phonecallDetails.hideCallDisplay();
            return self.refreshPhonecallsStatus();
        });
    },
    /**
     * Function overriden by each tab. Called when a phonecall starts.
     */
    initPhonecall: function () {
        this.phonecallDetails.showCallDisplay();
        this.trigger_up('toggleHangupButton');
    },
    /**
     * Called when the call is answered and then no more ringing.
     */
    onCallAccepted: function () {
        this.phonecallDetails.activateInCallButtons();
    },
    /**
     * Called when the user accepts an incoming call.
     *
     * @param {Object} params
     * @param {String} params.number
     * @param {Int} params.partnerId
     */
    onIncomingCallAccepted: function (params) {
        var self = this;
        this._rpc({
            model: 'voip.phonecall',
            method: 'create_from_incoming_call',
            args: [params.number, params.partnerId],
        }).then(function (phonecall) {
            self._displayInQueue(phonecall).then(function (phonecallWidget) {
                self.currentPhonecall = phonecallWidget;
                self._selectCall(phonecallWidget);
                self.phonecallDetails.showCallDisplay();
                self.phonecallDetails.activateInCallButtons();
            });
        });
    },
    /**
     * Performs a rpc to get the phonecalls then call the parsing method.
     *
     * @return {Promise}
     */
    refreshPhonecallsStatus: function () {
        return this._rpc({model: 'voip.phonecall', method: 'get_next_activities_list'})
            .then(_.bind(this._parsePhonecalls, this));
    },
    /**
     * Called when the current phonecall is rejected by the callee.
     */
    rejectPhonecall: function () {
        if (this.currentPhonecall) {
            var self = this;
            this.currentPhonecall.rejectPhonecall().then(function () {
                self.phonecallDetails.hideCallDisplay();
                self.refreshPhonecallsStatus().then(function () {
                    if (self.autoCallMode) {
                        self._autoCall();
                    }
                });
            });
        }
    },
    /**
     * Hides the phonecall that doesn't match the search. Overriden in each tab.
     *
     * @param  {String} search
     */
    searchPhonecall: function (search) {
        return;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Binds the scroll event to the tab.
     *
     * @private
     */
    _bindScroll: function () {
        var self = this;
        this.offset = 0;
        this.lazyLoadFinished = false;
        this.isLazyLoading = false;
        this.$container = this.$el.closest('.tab-content');
        this.$phonecalls = this.$('.o_dial_phonecalls');
        this.$container.scroll(function () {
            if (!self.lazyLoadFinished && self.maxScrollHeight && self.scrollLimit) {
                var position = self.$container.scrollTop();
                if (!self.isLazyLoading && self.maxScrollHeight - position < self.scrollLimit) {
                    self.offset += self.limit;
                    self._lazyLoadPhonecalls();
                }
            }
        });
    },
    /**
     * @private
     */
    _closePhoneDetails: function () {
        this.replace(this.phonecallDetails.$el);
        this.selectedPhonecall = false;
        this.trigger_up('showPanelHeader');
        this.refreshPhonecallsStatus();
    },
    /**
     * Computes the scroll limit before triggering the lazy loading of the
     * phonecalls.
     *
     * @private
     */
    _computeScrollLimit: function () {
        var height = this.$el.outerHeight();
        var tabHeight = this.$container.height();
        this.maxScrollHeight =  height - tabHeight;
        if (this.maxScrollHeight > 0) {
            this.scrollLimit = this.maxScrollHeight/3;
        }
    },
    /**
     * Creates a phonecall widget
     *
     * @private
     * @param  {Object} phonecall
     * @return {Widget}
     */
    _createPhonecallWidget: function (phonecall) {
        if (phonecall.call_date) {
            var utcTime = FieldUtils.parse.datetime(phonecall.call_date, false, {isUTC: true});
            phonecall.call_date = utcTime.local().format("YYYY-MM-DD HH:mm:ss");
        }
        var widget = new Phonecall.PhonecallWidget(this, phonecall);
        widget.on("selectCall", this, this._onSelectCall);
        widget.on("removePhonecall", this, this._onRemovePhonecall);
        return widget;
    },
    /**
     * Diplays the phonecall in the tab list.
     *
     * @private
     * @param {Object} phonecall
     * @return {Promise}
     */
    _displayInQueue: function (phonecall) {
        var widget = this._createPhonecallWidget(phonecall);
        this.phonecalls.push(widget);
        return widget.appendTo(this.$(".o_dial_phonecalls")).then(function () {
            return widget;
        });
    },
    /**
     * Goes through the phonecalls sent by the server and creates
     * a phonecall widget for each.
     *
     * @private
     * @param {Array[Object]} phonecalls
     */
    _parsePhonecalls: function (phonecallsData) {
        var self = this;
        var callTries = [];
        _.each(this.phonecalls, function (w) {
            callTries[w.id] = w.callTries;
            w.destroy();
        });
        this.phonecalls = [];
        _.each(phonecallsData, function (phonecall) {
            phonecall.callTries = callTries[phonecall.id];
            self._displayInQueue(phonecall);
        });
        //Select again the selected phonecall before the refresh
        var previousSelection = this.selectedPhonecall &&
            _.findWhere(this.phonecalls, {id: this.selectedPhonecall.id});
        if (previousSelection) {
            this._selectCall(previousSelection);
        }
    },
    /**
     * Opens the details of a phonecall widget.
     *
     * @private
     * @param {Widget} phonecall
     */
    _selectCall: function (phonecall) {
        var $el = this.$el;
        if (this.selectedPhonecall) {
            $el = this.phonecallDetails.$el;
        }
        this.phonecallDetails = new Phonecall.PhonecallDetails(this, phonecall);
        this.phonecallDetails.replace($el);
        this.selectedPhonecall = phonecall;
        this.trigger_up('hidePanelHeader');
        this.phonecallDetails.on('closePhonecallDetails', this, function () {
            this._closePhoneDetails();
        });
        this.phonecallDetails.on('clickOnNumber', this, function (ev) {
            this.currentPhonecall = this.selectedPhonecall;
            this.trigger_up('callNumber', {number: ev.data.number});
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Integer} phonecallId
     */
    _onRemovePhonecall: function (phonecallId) {
        var self = this;
        this._rpc({
            model: 'voip.phonecall',
            method: 'remove_from_queue',
            args: [phonecallId],
        }).then(function (resID) {
            self.refreshPhonecallsStatus();
            core.bus.trigger('voip_widget_refresh', resID);
        });
    },
    /**
     * @private
     * @param {Integer} phonecallId
     */
    _onSelectCall: function (phonecall) {
        this._selectCall(phonecall);
    },
});

var ActivitiesTab = PhonecallTab.extend({

    /**
     * @override
     * @param {Integer} phonecallId
     */
    init: function () {
        this._super.apply(this, arguments);
        this.autoCallMode = false;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * When the user clicks on the call button when on activity tab, enter autocall mode
     * @override
     */
    callFromTab: function () {
         this._autoCall();
    },

    /**
     * Function called when a phonenumber is clicked in the activity widget.
     * If the phonecall with the activityId given in the parameter
     * can't be found in the displayed list, we make a rpc to get the
     * related phonecall.
     *
     * @param {Object} params
     * @param  {String} params.number
     * @param  {Integer} params.activityId
     */
    callFromActivityWidget: function (params) {
        var self = this;
        this.autoCallMode = false;
        return new Promise(function (resolve, reject) {
            this.currentPhonecall = _.find(this.phonecalls, function (phonecall) {
                return phonecall.activity_id === params.activityId;
            });
            if (this.currentPhonecall) {
                this._selectCall(this.currentPhonecall);
                resolve();
            } else {
                this._rpc({
                    model: 'voip.phonecall',
                    method: 'get_from_activity_id',
                    args: [params.activityId]
                }).then(function (phonecall) {
                    self._displayInQueue(phonecall).then(function (phonecallWidget) {
                        self.currentPhonecall = phonecallWidget;
                        self._selectCall(phonecallWidget);
                        resolve();
                    });
                });
            }
        });
    },
    /**
     * @override
     * @return {Promise}
     */
    hangupPhonecall: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            if (self.autoCallMode) {
                self._autoCall();
            }
        });
    },
    /**
     * @override
     */
    initPhonecall: function () {
        if (!this.currentPhonecall.id) {
            return;
        }
        this.currentPhonecall.callTries += 1;
        this._rpc({
            model: 'voip.phonecall',
            method: 'init_call',
            args: [this.currentPhonecall.id],
        }).then(this._super.bind(this));
    },
    /**
     * @override
     */
    searchPhonecall: function (search) {
        // regular expression used to do a case insensitive search
        var escSearch = this.escapeRegExp(search);
        var expr = new RegExp(escSearch, 'i');
        // for each phonecall, check if the search is in phonecall name or the partner name
        _.each(this.phonecalls, function (phonecall) {
            var flagPartner = phonecall.partner_name &&
                phonecall.partner_name.search(expr) > -1;
            var flagName = false;
            if (phonecall.name) {
                flagName = phonecall.name.search(expr) > -1;
            }
            phonecall.$el.toggle(flagPartner || flagName);
        });
    },
    /**
     * Escape string in order to use it in a regex
     * source: https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
     * 
     * @param {String} string
     */
    escapeRegExp: function (string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Select the next call to do
     * @private
     */
    _autoCall: function () {
        this.autoCallMode = true;
        var todoPhonecalls = _.reject(this.phonecalls, function (phonecall) {
            return phonecall.state === 'done';
        });
        if (todoPhonecalls.length > 0) {
            var nextCall = _.min(todoPhonecalls, function (phonecall) {
                return phonecall.callTries;
            });
            this._selectCall(nextCall);
        }
        else {
            this.autoCallMode = false;
            if (this.selectedPhonecall) {
                this._closePhoneDetails();
            }
        }
    },
    /**
     * @private
     * @override
     */
    _closePhoneDetails: function () {
        this.autoCallMode = false;
        this._super.apply(this, arguments);
    },
    /**
     * @private
     * @override
     */
    _selectCall: function () {
        this._super.apply(this, arguments);
        var self = this;
        this.phonecallDetails.on('cancelActivity', this, function () {
            if (this.autoCallMode) {
                this.refreshPhonecallsStatus().then(function () {
                    self._autoCall();
                });
            } else {
                this._closePhoneDetails();
            }
        });
        this.phonecallDetails.on('markActivityDone', this, function () {
            if (this.autoCallMode) {
                this.refreshPhonecallsStatus().then(function () {
                    self._autoCall();
                });
            }
        });
    }
});

var RecentTab = PhonecallTab.extend({
    /**
     * @override
     */
    start: function () {
        this.limit = 10;
        this._bindScroll();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Creates a new phonecall in the db and in the tab list based on a number.
     *
     * @param  {String} number
     * @return {Promise}
     */
    callFromNumber: function (number) {
        var self = this;
        return this._rpc({
            model: 'voip.phonecall',
            method: 'create_from_number',
            args: [number],
        }).then(function (phonecall) {
            return self._displayInQueue(phonecall).then(function (phonecallWidget) {
                self.currentPhonecall = phonecallWidget;
                self._selectCall(phonecallWidget);
                return phonecallWidget;
            });
        });
    },
    /**
     * Function called when widget phone is clicked.
     *
     * @param {Object} params
     * @param  {String} params.number
     * @param  {String} params.resModel
     * @param  {Integer} params.resId
     * @return {Promise}
     */
    callFromPhoneWidget: function (params) {
        var self = this;
        return this._rpc({
            model: 'voip.phonecall',
            method: 'create_from_phone_widget',
            args: [
                params.resModel,
                params.resId,
                params.number,
            ],
        }).then(function (phonecall) {
            return self._displayInQueue(phonecall).then(function (phonecallWidget) {
                self.currentPhonecall = phonecallWidget;
                self._selectCall(phonecallWidget);
                 return phonecallWidget;
            });
        });
    },
    /**
     * @override
     *
     * @param {Object} phonecall if given the functiondoesn't have to create a
     *                           new phonecall
     */
    initPhonecall: function (phonecall) {
        var self = this;
        var _super = this._super.bind(this);
        if (!phonecall) {
            this._rpc({
                model: 'voip.phonecall',
                method: 'create_from_recent',
                args: [
                    this.currentPhonecall.id,
                ],
            }).then(function (phonecall) {
                self._displayInQueue(phonecall).then(function (phonecallWidget) {
                    self.currentPhonecall = phonecallWidget;
                    self._selectCall(phonecallWidget);
                    _super();
                });
            });
        } else {
            _super();
        }
    },
    /**
     * @override
     */
    refreshPhonecallsStatus: function () {
        this.lazyLoadFinished = false;
        return this._rpc({
            model: 'voip.phonecall',
            method: 'get_recent_list',
            args: [false, 0, 10],
        }).then(_.bind(this._parsePhonecalls, this));
    },
    /**
     * @override
     */
    searchPhonecall: function (search) {
        if (search) {
            var self = this;
            this.searchExpr = search;
            this.offset = 0;
            this.lazyLoadFinished = false;
            this._rpc({
                model: 'voip.phonecall',
                method: 'get_recent_list',
                args: [search, this.offset, this.limit],
            }).then(function (phonecalls) {
                self._parsePhonecalls(phonecalls);
            });
        } else {
            this.searchExpr = false;
            this.refreshPhonecallsStatus();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Gets the next phonecalls to display with the current offset
     *
     * @private
     */
    _lazyLoadPhonecalls: function () {
        var self = this;
        this.isLazyLoading = true;
        var search = this.searchExpr ? this.searchExpr : false;
        this._rpc({
            model: 'voip.phonecall',
            method: 'get_recent_list',
            args: [search, this.offset, this.limit],
        }).then(function (phonecalls) {
            if (!phonecalls.length) {
                self.lazyLoadFinished = true;
            }
            var promises = [];
            _.each(phonecalls, function (phonecall) {
                promises.push(self._displayInQueue(phonecall));
            });
            Promise.all(promises).then( function () {
                self._computeScrollLimit();
                self.isLazyLoading = false;
            });
        });
    },
    /**
     * @override
     */
    _parsePhonecalls: function (phonecallsData) {
        _.each(phonecallsData, function (phonecall) {
            phonecall.isRecent = true;
        });
        this._super.apply(this, arguments);
        this._computeScrollLimit();
    },
});

var ContactsTab = PhonecallTab.extend({
    /**
     * @constructor
     */
    init: function () {
        this._super.apply(this, arguments);
        this.contacts = [];
    },
    /**
     * @override
     */
    start: function () {
        this.limit = 9;
        this._bindScroll();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    initPhonecall: function () {
        var self = this;
        var _super = this._super.bind(this);
        this._rpc({
            model: 'voip.phonecall',
            method: 'create_from_contact',
            args: [
                this.currentPhonecall.partner_id,
            ],
        }).then(function (phonecall) {
            self.currentPhonecall = self._createPhonecallWidget(phonecall);
            self._selectCall(self.currentPhonecall);
            _super();
        });
    },
    /**
     * @override
     */
    refreshPhonecallsStatus: function () {
        this.offset = 0;
        this.lazyLoadFinished = false;
        return this._rpc({
            model: 'res.partner',
            method: 'search_read',
            fields: ['id', 'display_name', 'phone', 'mobile', 'email', 'image_small'],
            limit: this.limit,
        }).then(_.bind(this._parseContacts, this));
    },
    /**
     * @override
     */
    searchPhonecall: function (search) {
        if (search) {
            var self = this;
            this.searchDomain = [
                '|',
                ['display_name', 'ilike', search],
                ['email', 'ilike', search]
            ];
            this.offset = 0;
            this.lazyLoadFinished = false;
            this._rpc({
                model: 'res.partner',
                method: 'search_read',
                domain: this.searchDomain,
                fields: ['id', 'display_name', 'phone', 'mobile', 'email', 'image_small'],
                limit: this.limit,
                offset: this.offset,
            }).then(function (contacts) {
                self._parseContacts(contacts);
            });
        } else {
            this.searchDomain = false;
            this.refreshPhonecallsStatus();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Since the contact tab is based on res_partner and not voip_phonecall,
     * this method make the convertion between the models.
     *
     * @param  {Array[Object]} contacts
     * @return {Array[Object]}
     */
    _contactToPhonecall: function (contacts) {
        var phonecallsData = [];
        _.each(contacts, function (contact) {
            phonecallsData.push({
                partner_id: contact.id,
                partner_name: contact.display_name,
                partner_image_small: contact.image_small,
                partner_email: contact.email,
                phone: contact.phone,
                mobile: contact.mobile,
                isContact: true,
            });
        });
        return phonecallsData;
    },
    /**
     * Gets the next phonecalls to display with the current offset
     *
     * @private
     */
    _lazyLoadPhonecalls: function () {
        var self = this;
        this.isLazyLoading = true;
        this._rpc({
            model: 'res.partner',
            method: 'search_read',
            domain: this.searchDomain ? this.searchDomain : false,
            fields: ['id', 'display_name', 'phone', 'mobile', 'email', 'image_small'],
            limit: this.limit,
            offset: this.offset
        }).then(function (contacts) {
            if (!contacts.length) {
                self.lazyLoadFinished = true;
            }
            var phonecalls = self._contactToPhonecall(contacts);
            var promises = [];
            _.each(phonecalls, function (phonecall) {
                promises.push(self._displayInQueue(phonecall));
            });
            Promise.all(promises).then( function () {
                self._computeScrollLimit();
                self.isLazyLoading = false;
            });
        });
    },
    /**
     * Parses the contacts to convert them and then calls the _parsePhonecalls.
     *
     * @param  {Array[Object]} contacts
     */
    _parseContacts: function (contacts) {
        var phonecallsData = this._contactToPhonecall(contacts);
        this._parsePhonecalls(phonecallsData);
        this._computeScrollLimit();
    },
});

return {
    ContactsTab: ContactsTab,
    ActivitiesTab: ActivitiesTab,
    RecentTab: RecentTab,
};

});