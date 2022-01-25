/** @odoo-module **/

import FormView from 'web.FormView';
import Widget from 'web.Widget';
import { Markup } from 'web.utils';

const ViewsWidget = Widget.extend({
    template: 'mrp_workorder_view_widget',
    events: {
        'reload': '_onReload',
        'click button': '_onClickButton',
        'focusout input': '_onFocusOut',
    },

    init: function (clientAction, model, view, additionalContext, params, mode, view_type, bus) {
        this._super(...arguments);
        this.model = model;
        this.view = view;
        this.params = params || {};
        this.canBeDeleted = this.params.canBeDeleted;
        this.mode = mode || 'edit';
        this.view_type = view_type || 'form';
        this.context = {};
        this.context[`${this.view_type}_view_ref`] = this.view;
        this.context = Object.assign(this.context, additionalContext);
        this.bus = bus;
        this.bus.on('save', null, async (resolve) => {
            await this._onClickSave();
            resolve();
        });
    },

    willStart: async function () {
        await this._super();
        this.controller = await this._getViewController();
    },

    start: function () {
        const def = this.controller.appendTo(this.el.querySelector('.o_workorder_generic_view'));
        return Promise.all([def, this._super()]);
    },

    _render: function (newId) {
        this.controller.reload({ currentId: newId });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Create a controller for a given model, view and record.
     *
     * @returns {Promise} the form view's controller
     * @private
     */
    _getViewController: async function () {
        const views = [[false, this.view_type]];
        const fieldsViews = await this.loadViews(this.model, this.context, views);
        const params = Object.assign({}, this.params, {
            context: this.context,
            modelName: this.model,
            userContext: this.getSession().user_context,
            mode: this.mode,
            withControlPanel: false,
            withSearchPanel: false,
        });
        let view;
        if (this.view_type === 'form') {
            view = new FormView(fieldsViews.form, params);
        }
        return view.getController(this).then(
            controller => {
                // remove the form view click as we implemented our
                controller.off('button_clicked', this, this._OnButtonClicked);
                // Success: returns the controller.
                return controller;
            },
            () => { // Fail (e.g.: no controller because the record doesn't exist anymore).
                // Removes the current ID to open form for a new record instead.
                delete params.currentId;
                view = new FormView(fieldsViews.form, params);
                return view.getController(this);
            }
        );
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the click on the `button`.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickButton: async function (ev) {
        ev.stopPropagation();
        const record = this.controller.model.get(this.controller.handle);
        const methodName = ev.currentTarget.name;
        if (!methodName) {
            return;
        } else if (ev.currentTarget.classList.contains('workorder_event')) {
            this.bus.trigger('workorder_event', methodName);
            return;
        }
        await this._onClickSave();
        return this._rpc({
            model: this.model,
            method: methodName,
            args: [record.res_id],
            context: this.context,
        }).then((result) => {
            if (typeof result !== 'object') {
                this.bus.trigger('refresh', {});
                return;
            }
            if (result.help) {
                result.help = Markup(result.help);
            }
            this.do_action(result, { on_close: () => this.bus.trigger('refresh', {}) });
        });
    },

    /**
     * Force the save of the form view
     *
     */

    _onClickSave: async function () {
        await this.controller.saveRecord(this.controller.handle, {
            stayInEdit: true,
            reload: false,
        });
    },

    _onFocusOut: async function (ev) {
        // we want to trigger the quality check computes depending on the qty_producing of the workorder
        // The save on focus out be very heavy computing so we limit it to the workorder view
        if (this.model === 'mrp.workorder') {
            await this._onClickSave();
            const record = this.controller.model.get(this.controller.handle);
            this.bus.trigger('refresh', { recordId: record.res_id });
        }
    },
});

export default ViewsWidget;
