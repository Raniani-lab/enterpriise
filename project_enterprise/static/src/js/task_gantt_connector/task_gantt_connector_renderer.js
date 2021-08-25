/** @odoo-module **/

import ConnectorContainer from '../connector/connector_container';
import { device } from 'web.config';
import { ComponentWrapper, WidgetAdapterMixin } from 'web.OwlCompatibility';
import { throttle } from "@web/core/utils/timing";
import TaskGanttRenderer from '../task_gantt_renderer';
import TaskGanttConnectorRow from "./task_gantt_connector_row";


const TaskGanttConnectorRenderer = TaskGanttRenderer.extend(WidgetAdapterMixin, {
    config: {
        GanttRow: TaskGanttConnectorRow,
    },
    custom_events: Object.assign({ }, TaskGanttRenderer.prototype.custom_events || { }, {
        connector_creation_abort: '_onConnectorCreationAbort',
        connector_creation_done: '_onConnectorCreationDone',
        connector_creation_start: '_onConnectorCreationStart',
        connector_mouseout: '_onConnectorMouseOut',
        connector_mouseover: '_onConnectorMouseOver',
        connector_remove_button_click: '_onConnectorRemoveButtonClick',
    }),
    events: Object.assign({ }, TaskGanttRenderer.prototype.events || { }, {
        'mouseenter .o_gantt_pill, .o_connector_creator_wrapper': '_onPillMouseEnter',
        'mouseleave .o_gantt_pill, .o_connector_creator_wrapper': '_onPillMouseLeave',
    }),

    //--------------------------------------------------------------------------
    // Life Cycle
    //--------------------------------------------------------------------------

    /**
     * @override
    */
    init() {
        this._super(...arguments);
        this._connectors = { };
        this._preventHoverEffect = false;
        this._connectorsStrokeColors = this._getStrokeColors();
        this._connectorsStrokeWarningColors = this._getStrokeWarningColors();
        this._connectorsStrokeErrorColors = this._getStrokeErrorColors();
        this._connectorsOutlineStrokeColor = this._getOutlineStrokeColors();
        this._connectorsCssSelectors = {
            bullet: '.o_connector_creator_bullet',
            pill: '.o_gantt_pill',
            pillWrapper: '.o_gantt_pill_wrapper',
            wrapper: '.o_connector_creator_wrapper',
        };
    },
    /**
     * @override
    */
    destroy() {
        this._super(...arguments);
        window.removeEventListener('resize', this._throttledReRender);
    },
    /**
     * @override
    */
    on_attach_callback() {
        this._super(...arguments);
        // As we needs the source and target of the connectors to be part of the dom,
        // we need to use the on_attach_callback in order to have the first rendering successful.
        this._mountConnectorContainer();
    },
    /**
     * @override
    */
    async start() {
        await this._super(...arguments);
        this._connectorContainerComponent = new ComponentWrapper(this, ConnectorContainer, this._getConnectorContainerProps());
        this._throttledReRender = throttle(async () => {
            await this._connectorContainerComponent.update(this._generateAndGetConnectorContainerProps());
        }, 100);
        window.addEventListener('resize', this._throttledReRender);
    },
    /**
      * Make sure the connectorManager Component is updated each time the view is updated.
      *
      * @override
      */
    async _update() {
        await this._connectorContainerComponent.update(this._generateAndGetConnectorContainerProps());
        await this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Updates the connectors state in regards to the records state and returns the props.
     *
     * @return {Object} the props to pass to the ConnectorContainer
     * @private
     */
    _generateAndGetConnectorContainerProps() {
        this._preventHoverEffect = false;
        this._generateConnectors();
        return this._getConnectorContainerProps();
    },
    /**
     * Updates the connectors state in regards to the records state.
     *
     * @private
     */
    _generateConnectors() {
        this._connectors = { };
        this._idToRecordStateDict = { };
        // Generate a dict in order to be able to check that task dependencies 'depend_on_ids' is part of the records.
        // The dict is used in _generateConnectorsForTask.
        this._idToRecordStateDict = this.state.records.reduce(
            (dict, record, index) => {
                dict[record.id] = index;
                return dict;
            },
            { }
        );
        // Sample data may include records that are not rendered
        this._connectors = this.state.records.reduce(
            (connectors, task) => {
                const taskConnectors = this._generateConnectorsForTask(task);
                Object.assign(connectors, taskConnectors);
                return connectors;
            },
            { }
        );
    },
    /**
     * Generates the connectors (from depend_on_ids tasks to the task) for the provided task.
     *
     * @param {Object} task task record.
     * @private
     */
    _generateConnectorsForTask(task) {
        return task.depend_on_ids.reduce((taskConnectors, masterTaskId) => {
            if (masterTaskId in this._idToRecordStateDict) {
                const masterTaskPill = this._getPillForTaskId(masterTaskId);
                const slaveTaskPill = this._getPillForTaskId(task.id);
                let source = this._connectorContainerComponent.componentRef.comp.getAnchorsPositions(masterTaskPill);
                let target = this._connectorContainerComponent.componentRef.comp.getAnchorsPositions(slaveTaskPill);

                const connector = {
                    id: masterTaskId + '_to_' + task.id,
                    source: source.right,
                    canBeRemoved: true,
                    data: {
                        id: task.id,
                        masterId: masterTaskId,
                    },
                    target: target.left,
                };

                const masterTask = this._getRecordForTaskId(masterTaskId);
                const slaveTask = this._getRecordForTaskId(task.id);
                let specialColors;
                if (masterTask['display_warning_dependency_in_gantt'] &&
                    slaveTask['display_warning_dependency_in_gantt'] &&
                    slaveTask['planned_date_begin'].isBefore(masterTask['planned_date_end'])) {
                    specialColors = this._connectorsStrokeWarningColors;
                    if (slaveTask['planned_date_begin'].isBefore(masterTask['planned_date_begin'])) {
                        specialColors = this._connectorsStrokeErrorColors;
                    }
                }
                if (specialColors) {
                    connector['style'] = {
                        stroke: {
                            color: specialColors.stroke,
                            hoveredColor: specialColors.hoveredStroke,
                        }
                    };
                }

                taskConnectors[connector.id] = connector;
            }
            return taskConnectors;
        }, { });
    },
    /**
     * Gets the connector creator info for the provided element.
     *
     * @param {HTMLElement} element HTMLElement with a class of either o_connector_creator_bullet,
     *                              o_connector_creator_wrapper, o_gantt_pill or o_gantt_pill_wrapper.
     * @returns {{pillWrapper: HTMLElement, pill: HTMLElement, connectorCreators: Array<HTMLElement>}}
     * @private
     */
    _getConnectorCreatorInfo(element) {
        let connectorCreators = [];
        let pill = null;
        if (element.matches(this._connectorsCssSelectors.pillWrapper)) {
            element = element.querySelector(this._connectorsCssSelectors.pill);
        }
        if (element.matches(this._connectorsCssSelectors.bullet)) {
            element = element.closest(this._connectorsCssSelectors.wrapper);
        }
        if (element.matches(this._connectorsCssSelectors.pill)) {
            pill = element;
            connectorCreators = Array.from(element.parentElement.querySelectorAll(this._connectorsCssSelectors.wrapper));
        } else if (element.matches(this._connectorsCssSelectors.wrapper)) {
            connectorCreators = [element];
            pill = element.parentElement.querySelector(this._connectorsCssSelectors.pill);
        }
        return {
            pill: pill,
            pillWrapper: pill.parentElement,
            connectorCreators: connectorCreators,
        };
    },
    /**
     * Returns the props according to the current connectors state
     *
     * @returns {Object} the props to pass to the ConnectorContainer.
     * @private
     */
    _getConnectorContainerProps() {
        return {
            connectors: this._connectors,
            defaultStyle: {
                slackness: 0.9,
                stroke: {
                    color: this._connectorsStrokeColors.stroke,
                    hoveredColor: this._connectorsStrokeColors.hoveredStroke,
                    width: 2,
                },
                outlineStroke: {
                    color: this._connectorsOutlineStrokeColor.stroke,
                    hoveredColor: this._connectorsOutlineStrokeColor.hoveredStroke,
                    width: 1,
                }
            },
            hoverEaseWidth: 10,
            preventHoverEffect: this._preventHoverEffect,
            sourceQuerySelector: this._connectorsCssSelectors.bullet,
            targetQuerySelector: this._connectorsCssSelectors.pillWrapper,
        };
    },
    /**
     * Gets the rgba css string corresponding to the provided parameters.
     *
     * @param {number} r - [0, 255]
     * @param {number} g - [0, 255]
     * @param {number} b - [0, 255]
     * @param {number} [a = 1] - [0, 1]
     * @return {string} the css color.
     * @private
     */
    _getCssRGBAColor(r, g, b, a) {
        return `rgba(${ r }, ${ g }, ${ b }, ${ a || 1 })`;
    },
    /**
     * Gets the outline stroke's rgba css strings for both the stroke and its hovered state in error state.
     *
     * @return {{ stroke: {string}, hoveredStroke: {string} }}
     * @private
     */
    _getOutlineStrokeColors() {
        return this._getStrokeAndHoveredStrokeColor(255, 255, 255);
    },
    /**
     * Returns the HTMLElement wrapped set for the provided taskId.
     *
     * @param {number} taskId
     * @returns {HTMLElement}
     * @private
     */
    _getPillForTaskId(taskId) {
        return this.el.querySelector(`${this._connectorsCssSelectors.pill}[data-id="${taskId}"]`);
    },
    /**
     * Returns the record corresponding to the taskId.
     *
     * @param taskId
     * @returns {Object}
     * @private
     */
    _getRecordForTaskId(taskId) {
        return this.state.records[this._idToRecordStateDict[taskId]];
    },
    /**
     * Gets the stroke's rgba css string corresponding to the provided parameters for both the stroke and its
     * hovered state.
     *
     * @param {number} r - [0, 255]
     * @param {number} g - [0, 255]
     * @param {number} b - [0, 255]
     * @return {{ stroke: {string}, hoveredStroke: {string} }} the css colors.
     * @private
     */
    _getStrokeAndHoveredStrokeColor(r, g, b) {
        return {
            stroke: this._getCssRGBAColor(r, g, b, 0.5),
            hoveredStroke: this._getCssRGBAColor(r, g, b, 1),
        };
    },
    /**
     * Gets the stroke's rgba css strings for both the stroke and its hovered state.
     *
     * @return {{ stroke: {string}, hoveredStroke: {string} }}
     * @private
     */
    _getStrokeColors() {
        return this._getStrokeAndHoveredStrokeColor(143, 143, 143);
    },
    /**
     * Gets the stroke's rgba css strings for both the stroke and its hovered state in error state.
     *
     * @return {{ stroke: {string}, hoveredStroke: {string} }}
     * @private
     */
    _getStrokeErrorColors() {
        return this._getStrokeAndHoveredStrokeColor(211, 65, 59);
    },
    /**
     * Gets the stroke's rgba css strings for both the stroke and its hovered state in warning state.
     *
     * @return {{ stroke: {string}, hoveredStroke: {string} }}
     * @private
     */
    _getStrokeWarningColors() {
        return this._getStrokeAndHoveredStrokeColor(236, 151, 31);
    },
    /**
     * Gets whether the provided connector creator is the source element of the currently dragged connector.
     *
     * @param {{pill: HTMLElement, connectorCreators: Array<HTMLElement>}} connectorCreatorInfo
     * @returns {boolean}
     * @private
     */
    _isConnectorCreatorDragged(connectorCreatorInfo) {
        return this._connectorInCreation && this._connectorInCreation.data.sourceElement.dataset.id === connectorCreatorInfo.pill.dataset.id;
    },
    /**
     * @override
     * @private
     */
    async _render() {
        await this._super(...arguments);
        if (this._isInDom) {
            // If the renderer is not yet part of the dom (during first rendering), then
            // the call will be performed in the on_attach_callback.
            this._mountConnectorContainer();
        }
    },
    _mountConnectorContainer() {
        if (!(this.state.isSample || device.isMobile)) {
            this.el.classList.toggle('position-relative', true);
            this._connectorContainerComponent.mount(this.el).then(
                (result) => this._connectorContainerComponent.update(this._generateAndGetConnectorContainerProps())
            );
        }
    },
    /**
     * Toggles popover visibility.
     *
     * @param visible
     * @private
     */
    _togglePopoverVisibility(visible) {
        const $pills = this.$(this._connectorsCssSelectors.pill);
        if (visible) {
            $pills.popover('enable').popover('dispose');
        } else {
            $pills.popover('hide').popover('disable');
        }
    },
    /**
     * Triggers the on_connector_highlight at the Controller.
     *
     * @param {ConnectorContainer.Connector.props} connector
     * @param {boolean} highlighted
     * @private
     */
    _triggerConnectorHighlighting(connector, highlighted) {
        this.trigger_up(
            'on_connector_highlight',
            {
                connector: connector,
                highlighted: highlighted,
            });
    },
    /**
     * Triggers the on_pill_highlight at the Controller.
     *
     * @param {HTMLElement} element
     * @param {boolean} highlighted
     * @private
     */
    _triggerPillHighlighting(element, highlighted) {
        this.trigger_up(
            'on_pill_highlight',
            {
                element: element,
                highlighted: highlighted,
            });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Sets the class on the gantt_view corresponding to the mode.
     * This class is used to prevent the magnifier and + buttons during connection creation.
     *
     * @param {boolean} in_creation
     */
    set_connector_creation_mode(in_creation) {
        this.el.classList.toggle('o_grabbing', in_creation);
    },
    /**
     * Toggles the highlighting of the connector.
     *
     * @param {ConnectorContainer.Connector.props} connector
     * @param {boolean} highlighted
     */
    toggleConnectorHighlighting(connector, highlighted) {
        const sourceConnectorCreatorInfo = this._getConnectorCreatorInfo(this._getPillForTaskId(connector.data.masterId));
        const targetConnectorCreatorInfo = this._getConnectorCreatorInfo(this._getPillForTaskId(connector.data.id));
        if (!this._isConnectorCreatorDragged(sourceConnectorCreatorInfo)) {
            sourceConnectorCreatorInfo.pill.classList.toggle('highlight', highlighted);
        }
        if (!this._isConnectorCreatorDragged(targetConnectorCreatorInfo)) {
            targetConnectorCreatorInfo.pill.classList.toggle('highlight', highlighted);
        }
    },
    /**
     * Toggles the preventConnectorsHover props of the connector container.
     *
     * @param {boolean} prevent
     */
    togglePreventConnectorsHoverEffect(prevent){
        this._preventHoverEffect = prevent;
        this._connectorContainerComponent.update(this._getConnectorContainerProps());
    },
    /**
     * Toggles the highlighting of the pill and connector creator of the provided element.
     *
     * @param {HTMLElement} element
     * @param {boolean} highlighted
     */
    togglePillHighlighting(element, highlighted) {
        const connectorCreatorInfo = this._getConnectorCreatorInfo(element);
        const connectedConnectors = Object.values(this._connectors)
                                          .filter((connector) => {
                                              const ids = [connector.data.id, connector.data.masterId];
                                              return ids.includes(
                                                  parseInt(connectorCreatorInfo.pill.dataset.id)
                                              );
                                          });
        if (connectedConnectors.length) {
            connectedConnectors.forEach((connector) => {
                connector.hovered = highlighted;
                connector.canBeRemoved = !highlighted;
            });
            this._connectorContainerComponent.update(this._getConnectorContainerProps());
        }
        if (highlighted || !this._isConnectorCreatorDragged(connectorCreatorInfo)) {
            connectorCreatorInfo.pill.classList.toggle('highlight', highlighted);
            for (let connectorCreator of connectorCreatorInfo.connectorCreators) {
                connectorCreator.classList.toggle('invisible', !highlighted);
                connectorCreator.parentElement.classList.toggle('o_highlight_connector_creator', highlighted);
            }
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handler for Connector connector-creation-abort event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onConnectorCreationAbort(ev) {
        ev.stopPropagation();
        this._connectorInCreation = null;
        const connectorCreatorInfo = this._getConnectorCreatorInfo(ev.data.data.sourceElement);
        this._triggerPillHighlighting(connectorCreatorInfo.pill, false);
        this.trigger_up('on_connector_end_drag');
        this._togglePopoverVisibility(true);
    },
    /**
     * Handler for Connector connector-creation-done event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onConnectorCreationDone(ev) {
        ev.stopPropagation();
        this._connectorInCreation = null;
        const connectorSourceCreatorInfo = this._getConnectorCreatorInfo(ev.data.data.sourceElement);
        const connectorTargetCreatorInfo = this._getConnectorCreatorInfo(ev.data.data.targetElement);
        this.trigger_up('on_connector_end_drag');
        this.trigger_up(
            'on_create_connector',
            {
                masterTaskId: parseInt(connectorSourceCreatorInfo.pill.dataset.id),
                slaveTaskId: parseInt(connectorTargetCreatorInfo.pill.dataset.id),
            });
        this._togglePopoverVisibility(true);
    },
    /**
     * Handler for Connector connector-creation-start event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onConnectorCreationStart(ev) {
        ev.stopPropagation();
        this._connectorInCreation = ev.data;
        this._togglePopoverVisibility(false);
        const connectorCreatorInfo = this._getConnectorCreatorInfo(ev.data.data.sourceElement);
        this._triggerPillHighlighting(connectorCreatorInfo.pill, false);
        this.trigger_up('on_connector_start_drag');
    },
    /**
     * Handler for Connector connector-mouseout event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onConnectorMouseOut(ev) {
        ev.stopPropagation();
        this._triggerConnectorHighlighting(ev.data, false);
    },
    /**
     * Handler for Connector connector-mouseover event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onConnectorMouseOver(ev) {
        ev.stopPropagation();
        this._triggerConnectorHighlighting(ev.data, true);
    },
    /**
     * Handler for Connector connector-remove-button-click event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onConnectorRemoveButtonClick(ev) {
        ev.stopPropagation();
        const payload = ev.data;
        this.trigger_up(
        'on_remove_connector',
        {
            masterTaskId: payload.data.masterId,
            slaveTaskId: payload.data.id,
        });
    },
    /**
     * Handler for Pill connector-mouseenter event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onPillMouseEnter(ev) {
        ev.stopPropagation();
        this._triggerPillHighlighting(ev.currentTarget, true);
    },
    /**
     * Handler for Pill connector-mouseleave event.
     *
     * @param {OdooEvent} ev
     * @private
     */
    async _onPillMouseLeave(ev) {
        ev.stopPropagation();
        this._triggerPillHighlighting(ev.currentTarget, false);
    },
    /**
     * @override
     * @private
     * @param {OdooEvent} event
     */
    async _onStartDragging(event) {
        this._super(...arguments);
        this._triggerPillHighlighting(this.$draggedPill.get(0), false);
    }
});

export default TaskGanttConnectorRenderer;
