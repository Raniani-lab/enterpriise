/** @odoo-module */

import { qweb as QWeb } from "web.core";

import CalendarController from 'web.CalendarController';
import { PlanningControllerMixin } from '../planning_mixins';

const PlanningCalendarController = CalendarController.extend(PlanningControllerMixin, {
    events: Object.assign({}, CalendarController.prototype.events, {
        'click .o_button_copy_previous_week': '_onCopyWeekClicked',
        'click .o_button_send_all': '_onSendAllClicked',
    }),

    /**
     * @private
     * @returns {Array} Planning slots
     */
    _getRecords() {
        return this.model.get().data;
    },

    /**
     * Render the buttons and add new button about
     * copy previous, publish and plan orders
     *
     * @override
     */
    renderButtons($node) {
        this._super(...arguments);
        $(QWeb.render('planning.calendar.button', {
            'activeActions': this.activeActions,
            'activeScale': this.model.data.scale
        })).appendTo(this.$buttons);
        if ($node) {
            this.$buttons.appendTo($node);
        } else {
            this.$('.o_calendar_buttons').replaceWith(this.$buttons);
        }
    },

    /**
    * Handler when a user click on scale button: day/month/week/year
    *
    * @private
    * @param {Event|jQueryEvent} jsEvent
    * @override
    */
    _onButtonScale(jsEvent) {
        this._super(...arguments);
        this.renderButtons();
    },
});

export default PlanningCalendarController;
