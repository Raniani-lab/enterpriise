/** @odoo-module **/

import GanttController from 'web_gantt.GanttController';


const TaskGanttConnectorController = GanttController.extend({
    custom_events: Object.assign(
        { },
        GanttController.prototype.custom_events,
        {
            on_remove_connector: '_onRemoveConnector',
            on_create_connector: '_onCreateConnector',
            on_pill_highlight: '_onPillHighlight',
            on_connector_highlight: '_onConnectorHighlight',
            on_connector_start_drag: '_onConnectorStartDrag',
            on_connector_end_drag: '_onConnectorEndDrag',
        }),

    //--------------------------------------------------------------------------
    // Life Cycle
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    init: function () {
        this._super(...arguments);
        this._draggingConnector = false;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     * @param {OdooEvent} ev
     * @private
     */
    _onPillUpdatingStarted: function (ev) {
        this._super(...arguments);
        this.renderer.togglePreventConnectorsHoverEffect(true);
    },
    /**
     * @override
     * @param {OdooEvent} ev
     * @private
     */
    _onPillUpdatingStopped: function (ev) {
        this._super(...arguments);
        this.renderer.togglePreventConnectorsHoverEffect(false);
    },
    /**
     * Handler for renderer on-connector-end-drag event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    _onConnectorEndDrag(ev) {
        ev.stopPropagation();
        this._draggingConnector = false;
        this.renderer.set_connector_creation_mode(this._draggingConnector);
    },
    /**
     * Handler for renderer on-connector-highlight event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    _onConnectorHighlight(ev) {
        ev.stopPropagation();
        if (!this._updating && !this._draggingConnector) {
            this.renderer.toggleConnectorHighlighting(ev.data.connector, ev.data.highlighted);
        }
    },
    /**
     * Handler for renderer on-connector-start-drag event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    _onConnectorStartDrag(ev) {
        ev.stopPropagation();
        this._draggingConnector = true;
        this.renderer.set_connector_creation_mode(this._draggingConnector);
    },
    /**
     * Handler for renderer on-create-connector event.
     *
     * @param {OdooEvent} ev
     * @returns {Promise<*>}
     * @private
     */
    async _onCreateConnector(ev) {
        ev.stopPropagation();
        return this.model.createDependency(ev.data.masterTaskId, ev.data.slaveTaskId).then(
            (result) => this.reload()
        );
    },
    /**
     * Handler for renderer on-connector-end-drag event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    _onPillHighlight(ev) {
        ev.stopPropagation();
        if (!this._updating || !ev.data.highlighted) {
            this.renderer.togglePillHighlighting(ev.data.element, ev.data.highlighted);
        }
    },
    /**
     * Handler for renderer on-remove-connector event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onRemoveConnector(ev) {
        ev.stopPropagation();
        return this.model.removeDependency(ev.data.masterTaskId, ev.data.slaveTaskId).then(
            (result) => this.reload()
        );
    },
});

export default TaskGanttConnectorController;
