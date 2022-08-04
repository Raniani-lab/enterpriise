/** @odoo-module **/

const { Component, useState, onWillUpdateProps, onWillStart, onWillPatch, onWillDestroy } = owl;

export class MrpTimer extends Component {
    setup() {
        super.setup();
        this.state = useState({
            'hours': (this.props.hours !== undefined) ? this.props.hours : 0,
            'minutes': (this.props.minutes !== undefined) ? this.props.minutes : 0,
            'seconds': (this.props.seconds !== undefined) ? this.props.seconds : 0
        });
        this.ongoing = this.props.ongoing;
        this._updateTimer();
        onWillStart(() => this._runTimer());
        onWillUpdateProps(nextProps => {
            this.ongoing = nextProps.ongoing;
            this._runTimer();
        });
        onWillPatch(() => this._updateTimer());
        onWillDestroy(() => clearTimeout(this.timer));

    }

    get toString() {
        return _.str.sprintf('%02d:%02d:%02d', this.state.hours, this.state.minutes, this.state.seconds);
    }

    _runTimer() {
        if (this.ongoing) {
            this.timer = setTimeout(() => {
                this.state.seconds += 1;
                this._runTimer();
            }, 1000);
        }
    }

    _updateTimer() {
        if (this.state.seconds > 59) {
            const addtionalMinutes = this.state.seconds / 60 >> 0;
            this.state.seconds = this.state.seconds % 60;
            this.state.minutes += addtionalMinutes;
        }
        if (this.state.minutes > 59) {
            const addtionalHours = this.state.minutes / 60 >> 0;
            this.state.minutes = this.state.minutes % 60;
            this.state.hours += addtionalHours;
        }
    }
}

MrpTimer.template = 'mrp_workorder_hr.MrpTimer';
