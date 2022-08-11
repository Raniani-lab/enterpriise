/** @odoo-module */

import { getPeriodOptions } from "@web/search/utils/dates";

import { _lt } from "@web/core/l10n/translation";
import { YearPicker } from "@spreadsheet_edition/assets/components/year_picker";
const { DateTime } = luxon;
const { Component, onWillUpdateProps } = owl;
import { FILTER_DATE_OPTION } from "@spreadsheet/assets_backend/constants";

// TODO Remove this mapping, We should only need number > description to avoid multiple conversions
// This would require a migration though
const monthsOptions = [
    { id: "january", description: _lt("January") },
    { id: "february", description: _lt("February") },
    { id: "march", description: _lt("March") },
    { id: "april", description: _lt("April") },
    { id: "may", description: _lt("May") },
    { id: "june", description: _lt("June") },
    { id: "july", description: _lt("July") },
    { id: "august", description: _lt("August") },
    { id: "september", description: _lt("September") },
    { id: "october", description: _lt("October") },
    { id: "november", description: _lt("November") },
    { id: "december", description: _lt("December") },
];

/**
 * Return a list of time options to choose from according to the requested
 * type. Each option contains its (translated) description.
 * @see getPeriodOptions
 * @param {string} type "month" | "quarter" | "year"
 * @returns {Array<Object>}
 */
function dateOptions(type) {
    if (type === "month") {
        return monthsOptions;
    } else {
        return getPeriodOptions(DateTime.local()).filter(({ id }) =>
            FILTER_DATE_OPTION[type].includes(id)
        );
    }
}

export class DateFilterValue extends Component {
    setup() {
        this._setStateFromProps(this.props);
        onWillUpdateProps(this._setStateFromProps);
    }
    _setStateFromProps(props) {
        this.period = props.period;
        /** @type {number|undefined} */
        this.yearOffset = props.yearOffset;
        // date should be undefined if we don't have the yearOffset
        /** @type {DateTime|undefined} */
        this.date =
            this.yearOffset !== undefined
                ? DateTime.local().plus({ year: this.yearOffset })
                : undefined;
    }

    dateOptions(type) {
        return type ? dateOptions(type) : [];
    }

    isYear() {
        return this.props.type === "year";
    }

    isSelected(periodId) {
        return this.period === periodId;
    }

    onPeriodChanged(ev) {
        this.period = ev.target.value;
        this._updateFilter();
    }

    onYearChanged(date) {
        this.date = date;
        this.yearOffset = date.year - DateTime.now().year;
        this._updateFilter();
    }

    _updateFilter() {
        this.props.onTimeRangeChanged({
            yearOffset: this.yearOffset || 0,
            period: this.period,
        });
    }
}
DateFilterValue.template = "spreadsheet_edition.DateFilterValue";
DateFilterValue.components = { YearPicker };

DateFilterValue.props = {
    // See @spreadsheet_edition/bundle/global_filters/filters_plugin.RangeType
    type: { validate: (t) => ["year", "month", "quarter"].includes(t) },
    onTimeRangeChanged: Function,
    yearOffset: { type: Number, optional: true },
    period: { type: String, optional: true },
};
