odoo.define('quality_control_iot.iot_mesaure', function (require) {
    "use strict";

var core = require('web.core');
var Dialog = require('web.Dialog');
var Widget = require('web.Widget');
var widget_registry = require('web.widget_registry');

var _t = core._t;


var IotTakeMeasureButton = Widget.extend({

    start: function () {
        var $content = $('<div/>')
            .append($('<p/>').text(_t('Some improvements have been made on the IoT App that require some manual actions from your side:')))
            .append($('<p/>').text(_t('1. To upgrade the IoT and Manufacturing modules, go in Apps, search for the App and click on Upgrade')))
            .append($('<p/>').text(_t('2. To update the image, go on the IoT Box\'s homepage and click on Update (you may also need to reload the drivers)')))
            .append($('<p/>').text(_t('Thank you for your understanding.')))
            .append($('<p/>').text(_t('Have a great day!')));

        var dialog = new Dialog(this, {
            title: _t('Update IoT App.'),
            $content: $content,
            buttons: [
                {
                    text: _t('Close'),
                    classes: 'btn-secondary o_form_button_cancel',
                    close: true,
                }
            ],
        });
        dialog.open();
    },
});

widget_registry.add('iot_take_measure_button', IotTakeMeasureButton);

return {
    IotTakeMeasureButton: IotTakeMeasureButton,
};

});
