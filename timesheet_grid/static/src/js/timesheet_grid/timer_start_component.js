odoo.define('timesheet_grid.TimerStartComponent', function (require) {
    "use strict";

    const { LegacyComponent } = require("@web/legacy/legacy_component");

    class TimerStartComponent extends LegacyComponent {

        //----------------------------------------------------------------------
        // Getters
        //----------------------------------------------------------------------

        get letter() {
            if (this.props.runningIndex !== this.props.index && this.props.index < 26 && !this.env.device.isMobile) {
                const from = this.props.addTimeMode ? 65 : 97;
                return String.fromCharCode(from + this.props.index);
            } else {
                return '';
            }
        }
        get iconClass() {
            let classNames = [];
            if (this.props.runningIndex === this.props.index) {
                classNames = ['fa', 'fa-play', 'primary-green']
            } else if (this.props.index >= 26 || this.env.device.isMobile) {
                if (this.props.addTimeMode) {
                    classNames = ['fa', 'fa-plus'];
                } else {
                    classNames = ['fa', 'fa-play'];
                }
            }
            if (this.props.hovered && !this.env.device.isMobile) {
                if (this.props.runningIndex === this.props.index) {
                    classNames = ['fa', 'fa-stop', 'primary-danger']
                } else if (this.props.addTimeMode) {
                    classNames.push('primary-green');
                } else {
                    classNames = ['fa', 'fa-play', 'primary-green']
                }
            }
            return Array.from(new Set(classNames)).join(' ');
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onClickTimer(ev) {
            ev.stopPropagation();
            this.trigger('timer-started-from-line', this.props.path);
        }
    }
    TimerStartComponent.template = 'timesheet_grid.start_timer';
    TimerStartComponent.props = {
        path: String,
        index: {
            type: Number,
            optional: true
        },
        runningIndex: {
            type: Number,
            optional: true
        },
        addTimeMode: Boolean,
        onTimerStartedFromLine: {
            type: Function,
            optional: true
        },
        hovered: {
            type: Boolean,
            optional: true
        },
    };

    return TimerStartComponent;
});
