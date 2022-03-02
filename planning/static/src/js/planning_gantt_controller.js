/** @odoo-module alias=planning.PlanningGanttController **/

import GanttController from 'web_gantt.GanttController';
import {_t} from 'web.core';
import {Markup} from 'web.utils';
import Dialog from 'web.Dialog';
import {FormViewDialog} from 'web.view_dialogs';
import {_displayDialogWhenEmployeeNoEmail} from './planning_send/form_controller';
import { PlanningControllerMixin } from './planning_mixins';

const PlanningGanttController = GanttController.extend(PlanningControllerMixin, {
    events: Object.assign({}, GanttController.prototype.events, {
        'click .o_gantt_button_copy_previous_week': '_onCopyWeekClicked',
        'click .o_gantt_button_send_all': '_onSendAllClicked',
    }),
    buttonTemplateName: 'PlanningGanttView.buttons',

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    _renderButtonQWebParameter: function () {
        return Object.assign({}, this._super(...arguments), {
            activeActions: this.activeActions
        });
    },

    /**
     * @private
     * @returns {Array} Array of objects
     */
    _getRecords() {
        return this.model.get().records;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _onAddClicked: function (ev) {
        ev.preventDefault();
        const { startDate, stopDate } = this.model.get();
        const today = moment().startOf('date'); // for the context we want the beginning of the day and not the actual hour.
        if (startDate.isSameOrBefore(today, 'day') && stopDate.isSameOrAfter(today, 'day')) {
            // get the today date if the interval dates contain the today date.
            const context = this._getDialogContext(today);
            for (const k in context) {
                context[`default_${k}`] = context[k];
            }
            this._onCreate(context);
            return;
        }
        this._super(...arguments);
    },

    /**
     * @see {/planning_send/form_controller.js}
     */
    _displayDialogWhenEmployeeNoEmail,

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
        const allContext = Object.assign({}, this.context, context);

        const dialog = new FormViewDialog(this, {
            title: _.str.sprintf(title),
            res_model: this.modelName,
            view_id: this.dialogViews[0][0],
            res_id: resID,
            readonly: !this.is_action_enabled('edit'),
            deletable: this.is_action_enabled('edit') && resID,
            context: allContext,
            on_saved: this.reload.bind(this, {}),
            on_remove: this._onDialogRemove.bind(this, resID),
        });
        dialog.on('closed', this, function(ev){
            // we reload as record can be created or modified (sent, unpublished, ...)
            self.reload();
        });
        dialog.on('execute_action', this, async function(e) {
            const action_name = e.data.action_data.name || e.data.action_data.special;
            const event_data = _.clone(e.data);

            /* YTI TODO: Refactor this stuff to use events instead of empirically reload the page*/
            if (action_name === "action_unschedule") {
                e.stopPropagation();
                self.trigger_up('execute_action', event_data);
                _.delay(function() { self.dialog.destroy(); }, 400);
            } else if (action_name === "unlink") {
                e.stopPropagation();
                const message = _t('Are you sure you want to delete this shift?');

                Dialog.confirm(self, message, {
                    confirm_callback: function(evt) {
                        self.trigger_up('execute_action', event_data);
                        _.delay(function() { self.dialog.destroy() }, 200);
                    },
                    cancel_callback: function(evt) {
                        self.dialog.$footer.find('button').removeAttr('disabled');
                    }
                });
            } else {
                const initialState = dialog.form_view.model.get(dialog.form_view.handle);
                const state = dialog.form_view.renderer.state;
                const resID = e.data.env.currentID;

                if (initialState.data.template_creation != state.data.template_creation && state.data.template_creation) {
                    // Then the shift should be saved as a template too.
                    const message = _t("This shift was successfully saved as a template.")
                    self.displayNotification({
                        type: 'success',
                        message: Markup`<i class="fa fa-fw fa-check"></i><span class="ml-1">${message}</span>`,
                    });
                }

                if (action_name === 'action_send' && resID) {
                    e.stopPropagation();
                    // We want to check if all employees impacted to this action have a email.
                    // For those who do not have any email in work_email field, then a FormViewDialog is displayed for each employee who is not email.
                    try {
                        const result = await this.model.getEmployeesWithoutWorkEmail({
                            model: self.modelName,
                            res_id: resID
                        });
                        await this._displayDialogWhenEmployeeNoEmail(result);
                        self.trigger_up('execute_action', event_data);
                        setTimeout(() => self.dialog.destroy(), 100);
                    } catch (_err) {
                        self.dialog.$footer.find('button').removeAttr('disabled');
                    }
                }
            }
        });

        self.dialog = dialog.open();
        return self.dialog;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @override
     * @param {MouseEvent} ev
     */
    _onScaleClicked: function (ev) {
        this._super.apply(this, arguments);
        var $button = $(ev.currentTarget);
        var scale = $button.data('value');
        if (scale !== 'week') {
            this.$('.o_gantt_button_copy_previous_week').hide();
        } else {
            this.$('.o_gantt_button_copy_previous_week').show();
        }
    },
});

export default PlanningGanttController;
