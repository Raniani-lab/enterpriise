odoo.define('web_enterprise.CalendarRenderer', function (require) {
"use strict";

var config = require('web.config');
if (!config.device.isMobile) {
    return;
}

/**
 * This file implements some tweaks to improve the UX in mobile.
 */

var core = require('web.core');
var CalendarRenderer = require('web.CalendarRenderer');

var qweb = core.qweb;
// FIXME: in the future we should use modal instead of popover (on Event Click)
CalendarRenderer.include({

    /**
     * @constructor
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.isSwipeEnabled = true;
    },
    /**
     * @override
     * @returns {Promise}
     */
    start: function () {
        var promise = this._super();
        this._bindSwipe();
        return promise;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind handlers to enable swipe navigation
     *
     * @private
     */
    _bindSwipe: function () {
        var self = this;
        var touchStartX;
        var touchEndX;
        this.calendarElement.addEventListener('touchstart', function (event) {
            self.isSwipeEnabled = true;
            touchStartX = event.touches[0].pageX;
        });
        this.calendarElement.addEventListener('touchend', function (event) {
            if (!self.isSwipeEnabled) {
                return;
            }
            touchEndX = event.changedTouches[0].pageX;
            if (touchStartX - touchEndX > 100) {
                self.trigger_up('next');
            } else if (touchStartX - touchEndX < -100) {
                self.trigger_up('prev');
            }
        });
    },
    /**
     * In mobile we change the column header to avoid to much text
     *
     * @override
     * @private
     */
    _getFullCalendarOptions: function () {
        const oldOptions = this._super(...arguments);
        oldOptions.views.dayGridMonth.columnHeaderFormat = 'ddd';
        return oldOptions;
    },
    /**
     * Prepare the parameters for the popover.
     * Setting the popover is append to the body
     * and so no need the use of z-index
     *
     * @private
     * @override method from CalendarRenderer
     * @param {Object} eventData
     */
    _getPopoverParams: function (eventData) {
        var popoverParameters = this._super.apply(this, arguments);
        popoverParameters['container'] = 'body';
        return popoverParameters;
    },
    /**
     * In mobile, we add the swipe and so we need to disable it on some action
     *
     * @override
     * @private
     */
    _initCalendar: function () {
        var self = this;
        this._super.apply(this, arguments);
        var oldEventPositioned = this.calendar.getOption('eventPositioned');
        var oldEventRender = this.calendar.getOption('eventRender');
        var oldEventResize = this.calendar.getOption('eventResize');
        var oldEventResizeStart = this.calendar.getOption('eventResizeStart');

        this.calendar.setOption('eventPositioned', function (info) {
            self.isSwipeEnabled = false;
            if (oldEventPositioned) {
                oldEventPositioned(info);
            }
        });
        this.calendar.setOption('eventRender', function (info) {
            self.isSwipeEnabled = false;
            if (oldEventRender) {
                oldEventRender(info);
            }
        });
        this.calendar.setOption('eventResize', function (eventResizeInfo) {
            self.isSwipeEnabled = false;
            if (oldEventResize) {
                oldEventResize(eventResizeInfo);
            }
        });
        this.calendar.setOption('eventResizeStart', function (mouseResizeInfo) {
            self.isSwipeEnabled = false;
            if (oldEventResizeStart) {
                oldEventResizeStart(mouseResizeInfo);
            }
        });
    },
    /**
     * Finalise the popover
     * We adding some inline css to put the popover in a "fullscreen" mode
     *
     * @private
     * @override method from CalendarRenderer
     * @param {jQueryElement} $popoverElement
     * @param {web.CalendarPopover} calendarPopover
     */
    _onPopoverShown: function ($popoverElement, calendarPopover) {
        this._super.apply(this, arguments);
        var $popover = $($popoverElement.data('bs.popover').tip);
        // Need to be executed after Bootstrap popover
        // Bootstrap set style inline and so override the scss style
        setTimeout(() => {
            $popover.toggleClass([
                'bs-popover-left',
                'bs-popover-right',
            ], false);
            $popover.find('.arrow').remove();
            $popover.css({
                display: 'flex',
                bottom: 0,
                right: 0,
                borderWidth: 0,
                maxWidth: '100%',
                transform: 'translate3d(0px, 0px, 0px)',
            });
            $popover.find('.o_cw_body').css({
                display: 'flex',
                flex: '1 0 auto',
                flexDirection: 'column',
            });
            // We grow the "popover_fields_secondary" to have the buttons in the bottom of screen
            $popover.find('.o_cw_popover_fields_secondary')
                .toggleClass('o_cw_popover_fields_secondary', false)
                .css({
                        flexGrow: 1,
                    }
                );
            // We prevent the use of "scroll" events to avoid bootstrap listener
            // to resize the popover
            $popover.on('touchmove', (event) => {
                event.preventDefault();
            });
            // Firefox
            $popover.on('mousewheel', (event) => {
                event.preventDefault();
            });
            // Chrome
            $popover.on('wheel', (event) => {
                event.preventDefault();
            });
            // When the user click on a link the popover must be removed
            $popover.find('a.o_field_widget[href]')
                .on('click', (event) => {
                    $('.o_cw_popover').popover('dispose');
                })
        }, 0);
    },
    /**
     * Remove highlight classes and dispose of popovers
     *
     * @private
     */
    _unselectEvent: function () {
        this._super.apply(this, arguments);
        $('.o_cw_popover').popover('dispose');
    },
});

});
