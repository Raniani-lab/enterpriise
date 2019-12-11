odoo.define('base.settingsMobile', function (require) {
"use strict";

var config = require('web.config');
if (!config.device.isMobile) {
    return;
}

var core = require('web.core');
var BaseSetting = require('base.settings');

BaseSetting.Renderer.include({
    start: function () {
        var prom = this._super.apply(this, arguments);
        core.bus.on("DOM_updated", this, function () {
            this._moveToTab(this.currentIndex || this._currentAppIndex());
        });
        return prom;
    },
    /**
     * In mobile view behaviour is like swipe content left / right and apps tab will be shown on the top.
     * This method will set the required properties (styling and css).
     *
     * @private
     * @param {int} currentTab
     */
    _activateSettingMobileTab: function (currentTab) {
        var self = this;
        var moveTo = currentTab;
        var next = moveTo + 1;
        var previous = moveTo - 1;

        this.$(".settings .app_settings_block").removeClass("previous next current before after");
        this.$(".settings_tab .tab").removeClass("previous next current before after");
        _.each(this.modules, function (module, index) {
            var tab = self.$(".tab[data-key='" + module.key + "']");
            var view = module.settingView;

            if (index === previous) {
                tab.addClass("previous");
                tab.css("margin-left", "0px");
                view.addClass("previous");
            } else if (index === next) {
                tab.addClass("next");
                tab.css("margin-left", "-" + tab.outerWidth() + "px");
                view.addClass("next");
            } else if (index < moveTo) {
                tab.addClass("before");
                tab.css("margin-left", "-" + tab.outerWidth() + "px");
                view.addClass("before");
            } else if (index === moveTo) {
                var marginLeft = tab.outerWidth() / 2;
                tab.css("margin-left", "-" + marginLeft + "px");
                tab.addClass("current");
                view.addClass("current");
            } else if (index > moveTo) {
                tab.addClass("after");
                tab.css("margin-left", "0");
                view.addClass("after");
            }
        });
    },
    /**
     * Enables swipe navigation between settings pages
     *
     * @private
     */
    _enableSwipe: function () {
        var self = this;
        this.$('.settings').swipe({
            swipeLeft: function () {
                self._moveToTab(self.currentIndex + 1);
            },
            swipeRight: function () {
                self._moveToTab(self.currentIndex - 1);
            }
        });
    },
    /**
     * @override
     */
    _getTabWidth: function (column) {
        return this.$(".tab[data-key='" + column.key + "']").outerWidth();
    },
    /**
     * @override
     */
    _moveToTab: function (index) {
        this._super.apply(this, arguments);
        if (this.currentIndex !== -1) {
            this.activeTab.removeClass("selected");
            this._activateSettingMobileTab(this.currentIndex);
        }
    },
    _onKeyUpSearch: function (event) {
        this.$('.settings_tab').addClass('o_hidden');
        this.$('.settings').addClass('d-block');
        this._super.apply(this, arguments);
    },
    _resetSearch: function () {
        this._super.apply(this, arguments);
        this.$('.settings_tab').removeClass('o_hidden');
        this.$('.settings').removeClass('d-block');
    },
    _render: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function() {
            self._enableSwipe();
        });
    }
});

var view_registry = require('web.view_registry');
var BaseSettingsView = view_registry.get('base_settings');
BaseSettingsView.include({
    /**
     * Overrides to lazy-load touchSwipe library in mobile.
     *
     * @override
     */
    init: function () {
        this.jsLibs.push('/web/static/lib/jquery.touchSwipe/jquery.touchSwipe.js');
        this._super.apply(this, arguments);
    },
});
});
