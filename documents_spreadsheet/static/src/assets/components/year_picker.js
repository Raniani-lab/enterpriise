/** @odoo-module */

import {
    DatePicker,
} from "@web/core/datepicker/datepicker";
const { DateTime } = luxon;

/**
 * @param {string} format
 * @returns {boolean}
 */
 const isValidStaticFormat = (format) => {
    try {
        return /^[\d\s/:-]+$/.test(DateTime.local().toFormat(format));
    } catch (_err) {
        return false;
    }
};

const DEFAULT_DATE = DateTime.local();
export class YearPicker extends DatePicker {
    /**
     * @override
     */
    initFormat() {
        super.initFormat();
        // moment.js format
        this.defaultFormat = "yyyy";
        this.staticFormat = "yyyy";
    }

    /**
     * @override
     */
     getOptions(useStatic = false) {
        return {
            format:
                !useStatic || isValidStaticFormat(this.format) ? this.format : this.staticFormat,
            locale: DEFAULT_DATE.locale,
            timezone: this.isLocal,
        };
    }

    /**
     * @override
     */
    bootstrapDateTimePicker(commandOrParams) {
        if (typeof commandOrParams === "object") {
            const widgetParent = window.$(this.root.el);
            commandOrParams = { ...commandOrParams, widgetParent };
        }
        super.bootstrapDateTimePicker(commandOrParams);
    }

    /**
     * @override
     */
    onWillUpdateProps(nextProps) {
        const pickerParams = {};
        let shouldUpdateInput = false;
        for (const prop in nextProps) {
            const prev = this.props[prop];
            const next = nextProps[prop];
            if (
                (prev instanceof DateTime &&
                    next instanceof DateTime &&
                    !prev.equals(next)) ||
                prev !== next
            ) {
                pickerParams[prop] = nextProps[prop];
                if (prop === "date") {
                    this.setDate(nextProps);
                    shouldUpdateInput = true;
                }
            }
        }
        if (shouldUpdateInput) {
            this.updateInput();
        }
        this.bootstrapDateTimePicker(pickerParams);
    }
    /**
     * @override: allow displaying empty dates
     */
    updateInput({ useStatic } = {}) {
        try {
            this.inputRef.el.value = this.date
                ? this.formatValue(this.date, this.getOptions(useStatic))
                : "";
        } catch (_err) {
            // Do nothing
        }
    }

    /**
     * @override
     */
    onDateChange({ useStatic } = {}) {
        let date;
        try {
            date = this.parseValue(
                this.inputRef.el.value,
                this.getOptions(useStatic)
            );
        } catch (_err) {
            // Reset to default (= given) date.
        }
        if (
            !date ||
            (this.date instanceof DateTime && date.equals(this.date))
        ) {
            this.updateInput();
        } else {
            this.state.warning = date > DateTime.local();
            this.props.onDateTimeChanged(date);
        }
    }
}

const props = {
    ...DatePicker.props,
    date: { type: DateTime, optional: true },
};
delete props["format"];

YearPicker.props = props;

YearPicker.defaultProps = {
    ...DatePicker.defaultProps,
};
