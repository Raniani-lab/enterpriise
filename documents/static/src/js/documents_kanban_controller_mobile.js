odoo.define('documents.DocumentsKanbanControllerMobile', function (require) {
"use strict";

var config = require('web.config');
if (!config.device.isMobile) {
    return;
}

var core = require('web.core');
var DocumentsKanbanController = require('documents.DocumentsKanbanController');

var qweb = core.qweb;

DocumentsKanbanController.include({
    /**
     * Group ControlPanel's buttons into a dropdown.
     *
     * @override
     */
    renderButtons: function () {
        this._super.apply(this, arguments);
        var $buttons = this.$buttons.find('button');
        var $dropdownButton = $(qweb.render('documents.ControlPanelButtonsMobile'));
        $buttons.addClass('dropdown-item').appendTo($dropdownButton.find('.dropdown-menu'));
        $dropdownButton.replaceAll(this.$buttons);
    },
});

});
