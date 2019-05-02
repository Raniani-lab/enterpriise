odoo.define('project_forecast.ForecastGanttController', function (require) {
'use strict';

var GanttController = require('web_gantt.GanttController');
var core = require('web.core');

var _t = core._t;
var confirmDialog = require('web.Dialog').confirm;

var QWeb = core.qweb;

var ForecastGanttController = GanttController.extend({
    events: _.extend({}, GanttController.prototype.events, {
        'click .o_gantt_button_duplicate_period': '_onDuplicateClicked',
    }),
    /**
     * @override
     * @param {jQueryElement} $node to which the buttons will be appended
     */
    renderButtons: function ($node) {
        if ($node) {
            var state = this.model.get();
            this.$buttons = $(QWeb.render('ForecastGanttView.buttons', {
                groupedBy: state.groupedBy,
                widget: this,
                SCALES: this.SCALES,
                activateScale: state.scale,
                allowedScales: this.allowedScales,
                activeScale: state.scale,
            }));
            this.$buttons.appendTo($node);
        }
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onDuplicateClicked: function (ev) {
        ev.preventDefault();
        var state = this.model.get();
        var self = this;
        var confirm = new Promise(function (resolve, reject) {
            var fullMessage = _t('This will duplicate all forecasts from this period to the next. Are you sure you want to continue?');
            confirmDialog(self, fullMessage, {
                confirm_callback: resolve,
                cancel_callback: reject,
            });
        });
        confirm.then(function(){
            self._rpc({
                model: self.modelName,
                method: 'action_duplicate_period',
                args: [
                    self.model.convertToServerTime(state.startDate),
                    self.model.convertToServerTime(state.stopDate),
                    state.scale,
                ],
                context: _.extend({}, self.context || {}),
            })
            .then(function(){
                self.reload();
            });
        });
    },
});

return ForecastGanttController;

});