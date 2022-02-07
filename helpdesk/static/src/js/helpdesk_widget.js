/** @odoo-module **/

import { format } from 'web.field_utils';
import Widget from 'web.Widget';

export const HelpdeskDashboardWidget = Widget.extend({
    template: 'helpdesk.HelpdeskDashboard',
    events: {
        'click .o_dashboard_action': '_onDashboardActionClicked',
        'click .o_target_to_set': '_onDashboardTargetClicked',
    },

    /**
     * @override
     */
    init(parent, params) {
        this._super(...arguments);
        this.show_demo = params.show_demo || false;
        this.rating_enable = params.rating_enable || false;
        this.success_rate_enable = params.success_rate_enable || false;
        this.values = params || {};
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Notifies the controller that the target has changed.
     *
     * @private
     * @param {string} target_name the name of the changed target
     * @param {string} value the new value
     */
    _notifyTargetChange(target_name, value, callback) {
        this.trigger_up('dashboard_edit_target', {
            target_name: target_name,
            target_value: value,
            callback: callback,
        });
    },
    /**
     * convert the dashborad value to float precision
     *
     * @private
     * @param {value} float value
     */
    _format_float(value) {
        return format.float(value);
    },
    /**
     * convert the dashborad value to time precision
     *
     * @private
     * @param {value} time value
     */
    _format_time(value) {
        return format.float_time(value);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent}
     */
    async _onDashboardActionClicked(e) {
        e.preventDefault();
        const action = e.currentTarget;
        const actionRef = action.getAttribute('name');
        const title = action.dataset.actionTitle || action.getAttribute('title');
        const searchViewRef = action.getAttribute('search_view_ref');
        if (action.getAttribute('show_demo') != 'true'){
            if (action.getAttribute('name').includes("helpdesk.")) {
                const result = await this._rpc({
                    model: 'helpdesk.ticket',
                    method: 'create_action',
                    args: [actionRef, title, searchViewRef],
                });
                if (result.action) {
                    this.do_action(result.action, {
                        additional_context: action.getAttribute('context')
                    });
                }
            } else {
                this.trigger_up('dashboard_open_action', {
                    action_name: action.getAttribute('name'),
                });
            }
        }
    },
    /**
     * @private
     * @param {MouseEvent}
     */
    async _onDashboardTargetClicked(e) {
        const target = e.currentTarget;
        const targetName = target.getAttribute('name');
        const targetValue = target.getAttribute('value');

        if (this.blurProm) {
            await this.blurProm;
            this.blurProm = undefined;
            document.querySelector('[name=' + targetName +']').click();
            return;
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.name = targetName;
        input.className = 'h-100 text-center align-middle';
        input.style.padding = '0px';

        if (targetValue) {
            input.value = targetValue;
        }
        input.addEventListener('keyup', (e) => {
            if (e.which === $.ui.keyCode.ENTER) {
                this._notifyTargetChange(targetName, input.value);
            }
        });
        input.addEventListener('blur', () => {
            this.blurProm = new Promise((resolve, reject) => {
                this._notifyTargetChange(targetName, input.value, () => {
                    resolve();
                });
            });
        });
        target.replaceWith(input);
        input.focus();
        input.select();
    },
});
