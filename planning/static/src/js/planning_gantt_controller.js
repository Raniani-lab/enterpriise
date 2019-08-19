odoo.define('planning.PlanningGanttController', function (require) {
'use strict';

var GanttController = require('web_gantt.GanttController');
var core = require('web.core');
var _t = core._t;
var confirmDialog = require('web.Dialog').confirm;
var dialogs = require('web.view_dialogs');

var QWeb = core.qweb;

var PlanningGanttController = GanttController.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {jQueryElement} $node to which the buttons will be appended
     */
    renderButtons: function ($node) {
        if ($node) {
            var state = this.model.get();
            this.$buttons = $(QWeb.render('PlanningGanttView.buttons', {
                groupedBy: state.groupedBy,
                widget: this,
                SCALES: this.SCALES,
                activateScale: state.scale,
                allowedScales: this.allowedScales,
                activeActions: this.activeActions,
            }));
            this.$buttons.appendTo($node);
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Opens dialog to add/edit/view a record
     * Override required to execute the reload of the gantt view when an action is performed on a
     * single record.
     *
     * @private
     * @param {integer|undefined} resID
     * @param {Object|undefined} context
     */
    _openDialog: function (resID, context) {
        var self = this;
        var record = resID ? _.findWhere(this.model.get().records, {id: resID,}) : {};
        var title = resID ? record.display_name : _t("Open");

        var dialog = new dialogs.FormViewDialog(this, {
            title: _.str.sprintf(title),
            res_model: this.modelName,
            view_id: this.dialogViews[0][0],
            res_id: resID,
            readonly: !this.is_action_enabled('edit'),
            deletable: this.is_action_enabled('edit') && resID,
            context: _.extend({}, this.context, context),
            on_saved: this.reload.bind(this, {}),
            on_remove: this._onDialogRemove.bind(this, resID),
        });
        dialog.on('closed', this, function(ev){
            // we reload as record can be created or modified (sent, unpublished, ...)
            self.reload();
        });

        return dialog.open();
    },

});

return PlanningGanttController;

});