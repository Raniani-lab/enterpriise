/** @odoo-module **/

/**
 * Converts a luxon's DateTime object into a moment.js object.
 * NB: the passed object's values will be utilized as is, regardless of its corresponding timezone.
 * So passing a luxon's DateTime having 8 as hours value will result in a moment.js object having
 * also 8 as hours value. But the moment.js object will be in the browser's timezone.
 *
 * @param {DateTime} dt a luxon's DateTime object
 * @returns {moment} a moment.js object in the browser's timezone
 */
export function luxonToMoment(dt) {
    if (dt.isValid) {
        const o = dt.toObject();
        // Note: the month is 0-based in moment.js, but 1-based in luxon.js
        return moment({ ...o, month: o.month - 1 });
    } else {
        return moment.invalid();
    }
}

/**
 * Converts a moment.js object into a luxon's DateTime object.
 * NB: the passed object's values will be utilized as is, regardless of its corresponding timezone.
 * So passing a moment.js object having 8 as hours value will result in a luxon's DateTime object
 * having also 8 as hours value. But the luxon's DateTime object will be in the user's timezone.
 *
 * @param {moment} dt a moment.js object
 * @returns {DateTime} a luxon's DateTime object in the user's timezone
 */
export function momentToLuxon(dt) {
    const o = dt.toObject();
    // Note: the month is 0-based in moment.js, but 1-based in luxon.js
    return luxon.DateTime.fromObject({
        year: o.years,
        month: o.months + 1,
        day: o.date,
        hour: o.hours,
        minute: o.minutes,
        second: o.seconds,
        millisecond: o.milliseconds,
    });
}
