/** @odoo-module **/

import { _t } from 'web.core';
import KanbanController from 'web.KanbanController';
import { HelpdeskDashboardWidget } from '@helpdesk/js/helpdesk_widget';
import session from 'web.session';

export const HelpdeskKanbanController = KanbanController.extend({
    custom_events: Object.assign({}, KanbanController.prototype.custom_events, {
        dashboard_open_action: '_onDashboardOpenAction',
        dashboard_edit_target: '_onDashboardEditTarget',
    }),

    /**
     * @override
     */
    init() {
        this._super(...arguments);
        this.dashboardValues = null;
    },
    /**
     * @override
     */
    async start() {
        // create a div inside o_content that will be used to wrap the helpdesk
        // banner and renderer (this is required to get the desired
        // layout with the searchPanel to the left)
        const elementDiv = document.createElement('div');
        elementDiv.classList.add('o_helpdesk_content');
        this.el.querySelector('.o_content').appendChild(elementDiv);
        await this._super(...arguments);
        this.el.querySelector('.o_helpdesk_content').appendChild(this.el.querySelector('.o_helpdesk_view'));
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Retrive the helpdesk data
     *
     * @private
     */
    async _fetchWidgetData() {
        this.dashboardValues = await this._rpc({
            model: 'helpdesk.team',
            method: 'retrieve_dashboard',
            context: session.user_context,
        });
    },
    /**
     * Renders and appends the helpdesk overview banner widget.
     *
     * @private
     */
    async _renderHelpdeskWidget() {
        const oldWidget = this.widget;
        this.widget = new HelpdeskDashboardWidget(this, this.dashboardValues);
        await this.widget.appendTo(document.createDocumentFragment());
        this.el.querySelector('.o_helpdesk_content').prepend(this.widget.el);
        if (oldWidget) {
            oldWidget.destroy();
        }
    },
    /**
     * Override to fetch and display the helpdesk data. Because of the presence of
     * the searchPanel, also wrap the helpdesk widget and the renderer into
     * a div, to get the desired layout.
     *
     * @override
     * @private
     */
    _update() {
        const def = this._fetchWidgetData().then(
            this._renderHelpdeskWidget.bind(this)
        );
        return Promise.all([def, this._super.apply(this, arguments)]);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} e
     */
    async _onDashboardEditTarget(e) {
        const targetName = e.data.target_name;
        const targetValue = e.data.target_value;
        if (isNaN(targetValue)) {
            this.displayNotification({ message: _t("Please enter a number."), type: 'danger' });
        } else {
            const values = {};
            values[targetName] = parseInt(targetValue);
            await this._rpc({
                model: 'res.users',
                method: 'write',
                args: [[session.uid], values],
            });
            await this.reload();
        }
    },
    /**
     * @private
     * @param {OdooEvent} e
     */
    async _onDashboardOpenAction(e) {
        const actionName = e.data.action_name;
        if (['action_view_rating_today', 'action_view_rating_7days'].includes(actionName)) {
            const data = await this._rpc({model: this.modelName, method: actionName});
            if (data) {
                return this.do_action(data);
            }
        }
        return this.do_action(actionName);
    },
});
