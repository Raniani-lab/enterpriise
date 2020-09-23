odoo.define("documents_spreadsheet.DateFilterValue", function (require) {
    "use strict";

    const { getPeriodOptions } = require("web.searchUtils");
    const { _lt } = require('web.core');
    const dateTypeOptions = {
        quarter: ["first_quarter", "second_quarter", "third_quarter", "fourth_quarter"],
        year: ["this_year", "last_year", "antepenultimate_year"],
    };
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
            return getPeriodOptions(moment()).filter(({ id }) => dateTypeOptions[type].includes(id));
        }
    }

    class DateFilterValue extends owl.Component {
        dateOptions(type) {
            return type ? dateOptions(type) : [];
        }

        isYear() {
            return this.props.type === "year";
        }

        isSelected(periodId) {
            return [this.props.year, this.props.period].includes(periodId);
        }

        onPeriodChanged(ev) {
            const value = ev.target.value;
            this.trigger("time-range-changed", {
                year: this.props.year,
                period: value !== "empty" ? value : undefined,
            });
        }

        onYearChanged(ev) {
            const value = ev.target.value;
            this.trigger("time-range-changed", {
                year: value !== "empty" ? value : undefined,
                period: this.props.period,
            });
        }
    }
    DateFilterValue.template = "documents_spreadsheet.DateFilterValue";

    return DateFilterValue;
});
