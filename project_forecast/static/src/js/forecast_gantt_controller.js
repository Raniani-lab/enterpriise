odoo.define('project_forecast.ForecastGanttController', function (require) {
'use strict';

var GanttController = require('web_gantt.GanttController');
var core = require('web.core');
var _t = core._t;
var confirmDialog = require('web.Dialog').confirm;
var dialogs = require('web.view_dialogs');

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
            }));
            this.$buttons.appendTo($node);
        }
    },
    /**
     * Creates the handler called when clickig on the save
     * button in the create/edit/view dialog
     * Reload the view and close the dialog
     *
     * @returns {function}
     */
    _onDialogSaveClicked: function () {
        var controller = this;
        return function(ev){
            var self = this;
            return self.form_view.saveRecord(this.form_view.handle, {
                stayInEdit: true,
                reload: false,
                savePoint: this.shouldSaveLocally,
                viewType: 'form',
            })
            .then(function(){
                return controller.reload();
            })
            .then(function() {
                return self.close();
            });
        };
    },
    /**
     * returns the handler for the save and send action in a dialog
     * @param {object} rpcArgs
     * @returns {function}
     */
    _saveAndSendHandler: function (rpcArgs){
        return function () {
            var self = this;
            return self.form_view.saveRecord(this.form_view.handle, {
                stayInEdit: true,
                reload: false,
                savePoint: this.shouldSaveLocally,
                viewType: 'form',
            })
            .then(function(){
                var record = self.form_view.model.get(self.form_view.handle);
                return self._rpc(_.extend({}, rpcArgs, {args: [record.res_id,],}));
            })
            .then(function() {
                self.close();
            });
        };
    },
    /**
     * returns the handler for the remove_after action in a dialog
     * @returns {function}
     */
    _onRemoveFutureClick: function (recurrencyId, end_datetime) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var message = _t('This will remove this forecast and all subsequent ones. Are you sure you want to continue?');
            confirmDialog(this, message, {
                confirm_callback: resolve,
                cancel_callback: reject,
            });
        }).then(function() {
            return self._rpc({
                model: 'project.forecast.recurrency',
                method: 'action_remove_after',
                args: [[recurrencyId,], end_datetime],
            }).then(function(){
                return self.reload();
            });
        });
    },
    /**
     * returns a handler that makes an rpc on the active record or a related one
     * optionally, a confirmation message can be asked, then the rpc only takes place if the confirmation
     * is given by the user
     * @param {string} method the name of the method to call in the rpc
     * @param {integer} resId the id of the record
     * @param {string|undefined} confirmationMessage optional confirmation message that should be confirmed to do the rpc
     * @param {string|undefined} relatedModelName optional, allows to call the rpc on another model that is related to the active one
     * @return {function}
     */
    _onObjectButtonClick: function (method, recordId, confirmationMessage, relatedModelName){
        var self = this;
        return new Promise(function (resolve, reject) {
            if(typeof confirmationMessage === 'string'){
                var fullMessage = confirmationMessage;
                confirmDialog(this, fullMessage, {
                    confirm_callback: resolve,
                    cancel_callback: reject,
                });
            } else {
                resolve();
            }
        }).then(function() {
            return self._rpc({
                model: relatedModelName || self.modelName,
                method: method,
                args: [[recordId,],],
            }).then(function(){
                return self.reload();
            });
        });
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
    /**
     * Opens dialog to add/edit/view a record
     *
     * @private
     * @param {integer|undefined} resID
     * @param {Object|undefined} context
     */
    _openDialog: function (resID, context) {
        var record = resID ? _.findWhere(this.model.get().records, {id: resID,}) : {};
        var title = resID ? record.display_name : _t("Open");

        return new dialogs.FormViewDialog(this, {
            title: _.str.sprintf(title),
            res_model: this.modelName,
            views: this.dialogViews,
            res_id: resID,
            readonly: !this.is_action_enabled('edit'),
            buttons: this._getDialogButtons(resID),
            context: _.extend({}, this.context, context),
        }).open();
    },
    /**
     * Builds the button list for the _openDialog method
     *
     * @private
     * @param {integer|undefined} resID
     * @returns {[{object}]}
     */
    _getDialogButtons: function (resId) {
        var record = resId ? _.findWhere(this.model.get().records, {id: resId,}) : {};
        var buttons = [{
            text: _t('Save'),
            classes: 'btn-primary',
            click: this._onDialogSaveClicked(),
        }];
        if(!record.id){
            buttons.push({
                text: _t('Save & send'),
                classes: 'btn-primary',
                close: true,
                click: this._saveAndSendHandler({
                    model: this.modelName,
                    method: 'action_send',
                    context: this.context,
                }),
            });
        }
        // send (higlighted)
        if(record.id && !record.published){
            buttons.push({
                text: _t('Send'),
                classes: 'btn-primary',
                close: true,
                click: this._onObjectButtonClick.bind(this, 'action_send', resId),
            });
        }
        if(record.id){
            buttons.push({
                text: _t('Delete', true),
                classes: 'btn-secondary',
                close: true,
                click: this._onObjectButtonClick.bind(this, 'unlink', resId,  _t('This will remove this forecast. Are you sure you want to continue?'), null),
            });
        }
        if(record.id && record.recurrency_id){
            var comodelRecordId = record['recurrency_id'][0];
            buttons.push({
                text: _t('Delete all', true),
                classes: 'btn-secondary',
                close: true,
                click: this._onObjectButtonClick.bind(this, 'action_remove_all', comodelRecordId, _t('This will remove this forecast and all related ones. Are you sure you want to continue?'), 'project.forecast.recurrency'),
            });
        }
        if(record.id && record.recurrency_id){
            var recurrencyId = record['recurrency_id'][0];
            var start_datetime = record['start_datetime']
            buttons.push({
                text: _t('Delete future', true),
                classes: 'btn-secondary',
                close: true,
                click: this._onRemoveFutureClick.bind(this, recurrencyId, start_datetime),
            });
        }
        // send, not highlited
        if(record.id && record.published){
            buttons.push({
                text: _t('Send'),
                classes: 'btn-secondary',
                close: true,
                click: this._onObjectButtonClick.bind(this, 'action_send', resId),
            });
        }
        buttons.push({
            text: _t('Discard'),
            classes: 'btn-secondary',
            click: this.reload.bind(this, {}),
            close: true,
        });
        return buttons;
    },

});

return ForecastGanttController;

});