odoo.define('web_enterprise.view_dialogs', function (require) {
"use strict";

var config = require('web.config');
if (!config.device.isMobile) {
    return;
}

var core = require('web.core');
var view_dialogs = require('web.view_dialogs');

var _t = core._t;

view_dialogs.SelectCreateDialog.include({
    init: function () {
        this._super.apply(this,arguments);
        this.on_clear = this.options.on_clear || (function () {});
        this.viewType = 'kanban';
    },
    /**
     * @override
     */
    _prepareButtons: function () {
        this._super.apply(this, arguments);
        if (this.options.selectionMode) {
            this.__buttons.unshift({
                text: _t("Clear"),
                classes: 'btn-secondary o_clear_button',
                close: true,
                click: function () {
                    this.on_clear();
                },
            });
        }
    },
});

});
