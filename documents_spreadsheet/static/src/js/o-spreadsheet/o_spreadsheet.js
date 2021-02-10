(function (exports, owl) {
    'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () {
                            return e[k];
                        }
                    });
                }
            });
        }
        n['default'] = e;
        return Object.freeze(n);
    }

    var owl__namespace = /*#__PURE__*/_interopNamespace(owl);

    // Colors
    const BACKGROUND_GRAY_COLOR = "#f5f5f5";
    const BACKGROUND_HEADER_COLOR = "#F8F9FA";
    const BACKGROUND_HEADER_SELECTED_COLOR = "#E8EAED";
    const BACKGROUND_HEADER_ACTIVE_COLOR = "#595959";
    const TEXT_HEADER_COLOR = "#666666";
    const SELECTION_BORDER_COLOR = "#3266ca";
    const HEADER_BORDER_COLOR = "#C0C0C0";
    const CELL_BORDER_COLOR = "#E2E3E3";
    // Dimensions
    const MIN_ROW_HEIGHT = 10;
    const MIN_COL_WIDTH = 5;
    const HEADER_HEIGHT = 26;
    const HEADER_WIDTH = 48;
    const TOPBAR_HEIGHT = 63;
    const BOTTOMBAR_HEIGHT = 36;
    const DEFAULT_CELL_WIDTH = 96;
    const DEFAULT_CELL_HEIGHT = 23;
    const SCROLLBAR_WIDTH = 15;
    const PADDING_AUTORESIZE = 3;
    // Fonts
    const DEFAULT_FONT_WEIGHT = "400";
    const DEFAULT_FONT_SIZE = 10;
    const HEADER_FONT_SIZE = 11;
    const DEFAULT_FONT = "'Roboto', arial";
    // Borders
    const DEFAULT_BORDER_DESC = ["thin", "#000"];
    // DateTimeRegex
    const DATETIME_FORMAT = /[ymd:]/;

    /*
     * usage: every string should be translated either with _lt if they are registered with a registry at
     *  the load of the app or with Spreadsheet._t in the templates. Spreadsheet._t is exposed in the
     *  sub-env of Spreadsheet components as _t
     * */
    // define a mock translation function, when o-spreadsheet runs in standalone it doesn't translate any string
    let _t = (s) => s;
    function sprintf(s, ...values) {
        if (values.length === 1 && typeof values[0] === "object") {
            const valuesDict = values[0];
            s = s.replace(/\%\(?([^\)]+)\)s/g, (match, value) => valuesDict[value]);
        }
        else if (values.length > 0) {
            s = s.replace(/\%s/g, () => values.shift());
        }
        return s;
    }
    /***
     * Allow to inject a translation function from outside o-spreadsheet.
     * @param tfn the function that will do the translation
     */
    function setTranslationMethod(tfn) {
        _t = tfn;
    }
    const _lt = function (s, ...values) {
        return {
            toString: function () {
                return sprintf(_t(s), ...values);
            },
        };
    };

    // -----------------------------------------------------------------------------
    // -----------------------------------------------------------------------------
    // Parsing
    // -----------------------------------------------------------------------------
    const CURRENT_MILLENIAL = 2000; // note: don't forget to update this in 2999
    const CURRENT_YEAR = new Date().getFullYear();
    const INITIAL_1900_DAY = new Date(1899, 11, 30);
    const INITIAL_JS_DAY = new Date(0);
    const DATE_JS_1900_OFFSET = INITIAL_JS_DAY - INITIAL_1900_DAY;
    const mdyDateRegexp = /^\d{1,2}(\/|-|\s)\d{1,2}((\/|-|\s)\d{1,4})?$/;
    const ymdDateRegexp = /^\d{3,4}(\/|-|\s)\d{1,2}(\/|-|\s)\d{1,2}$/;
    const timeRegexp = /((\d+(:\d+)?(:\d+)?\s*(AM|PM))|(\d+:\d+(:\d+)?))$/;
    function parseDateTime(str) {
        str = str.trim();
        let time;
        const timeMatch = str.match(timeRegexp);
        if (timeMatch) {
            time = parseTime(timeMatch[0]);
            if (time === null) {
                return null;
            }
            str = str.replace(timeMatch[0], "").trim();
        }
        let date;
        const mdyDateMatch = str.match(mdyDateRegexp);
        const ymdDateMatch = str.match(ymdDateRegexp);
        if (mdyDateMatch || ymdDateMatch) {
            let dateMatch;
            if (mdyDateMatch) {
                dateMatch = mdyDateMatch[0];
                date = parseDate(dateMatch, "mdy");
            }
            else {
                dateMatch = ymdDateMatch[0];
                date = parseDate(dateMatch, "ymd");
            }
            if (date === null) {
                return null;
            }
            str = str.replace(dateMatch, "").trim();
        }
        if (str !== "" || !(date || time)) {
            return null;
        }
        if (date && time) {
            return {
                value: date.value + time.value,
                format: date.format + " " + (time.format === "hhhh:mm:ss" ? "hh:mm:ss" : time.format),
                jsDate: new Date(date.jsDate.getFullYear() + time.jsDate.getFullYear() - 1899, date.jsDate.getMonth() + time.jsDate.getMonth() - 11, date.jsDate.getDate() + time.jsDate.getDate() - 30, date.jsDate.getHours() + time.jsDate.getHours(), date.jsDate.getMinutes() + time.jsDate.getMinutes(), date.jsDate.getSeconds() + time.jsDate.getSeconds()),
            };
        }
        return date || time;
    }
    function parseDate(str, dateFormat) {
        const isMDY = dateFormat === "mdy";
        const isYMD = dateFormat === "ymd";
        if (isMDY || isYMD) {
            const parts = str.split(/\/|-|\s/);
            const monthIndex = isMDY ? 0 : 1;
            const dayIndex = isMDY ? 1 : 2;
            const yearIndex = isMDY ? 2 : 0;
            const month = Number(parts[monthIndex]);
            const day = Number(parts[dayIndex]);
            const leadingZero = (parts[monthIndex].length === 2 && month < 10) || (parts[dayIndex].length === 2 && day < 10);
            const year = parts[yearIndex] ? inferYear(parts[yearIndex]) : CURRENT_YEAR;
            const jsDate = new Date(year, month - 1, day);
            const sep = str.match(/\/|-|\s/)[0];
            if (jsDate.getMonth() !== month - 1 || jsDate.getDate() !== day) {
                // invalid date
                return null;
            }
            const delta = jsDate - INITIAL_1900_DAY;
            let format = leadingZero ? `mm${sep}dd` : `m${sep}d`;
            if (parts[yearIndex]) {
                format = isMDY ? format + sep + "yyyy" : "yyyy" + sep + format;
            }
            return {
                value: Math.round(delta / 86400000),
                format: format,
                jsDate,
            };
        }
        return null;
    }
    function inferYear(str) {
        const nbr = Number(str);
        switch (str.length) {
            case 1:
                return CURRENT_MILLENIAL + nbr;
            case 2:
                const offset = CURRENT_MILLENIAL + nbr > CURRENT_YEAR + 10 ? -100 : 0;
                const base = CURRENT_MILLENIAL + offset;
                return base + nbr;
            case 3:
            case 4:
                return nbr;
        }
        return 0;
    }
    function parseTime(str) {
        str = str.trim();
        if (timeRegexp.test(str)) {
            const isAM = /AM/i.test(str);
            const isPM = /PM/i.test(str);
            const strTime = isAM || isPM ? str.substring(0, str.length - 2).trim() : str;
            const parts = strTime.split(/:/);
            const isMinutes = parts.length >= 2;
            const isSeconds = parts.length === 3;
            let hours = Number(parts[0]);
            let minutes = isMinutes ? Number(parts[1]) : 0;
            let seconds = isSeconds ? Number(parts[2]) : 0;
            let format = isSeconds ? "hh:mm:ss" : "hh:mm";
            if (isAM || isPM) {
                format += " a";
            }
            else if (!isMinutes) {
                return null;
            }
            if (hours >= 12 && isAM) {
                hours -= 12;
            }
            else if (hours < 12 && isPM) {
                hours += 12;
            }
            minutes += Math.floor(seconds / 60);
            seconds %= 60;
            hours += Math.floor(minutes / 60);
            minutes %= 60;
            if (hours >= 24) {
                format = "hhhh:mm:ss";
            }
            const jsDate = new Date(1899, 11, 30, hours, minutes, seconds);
            return {
                value: hours / 24 + minutes / 1440 + seconds / 86400,
                format: format,
                jsDate: jsDate,
            };
        }
        return null;
    }
    // -----------------------------------------------------------------------------
    // Conversion
    // -----------------------------------------------------------------------------
    function numberToJsDate(value) {
        const truncValue = Math.trunc(value);
        let date = new Date(truncValue * 86400 * 1000 - DATE_JS_1900_OFFSET);
        let time = value - truncValue;
        time = time < 0 ? 1 + time : time;
        const hours = Math.round(time * 24);
        const minutes = Math.round((time - hours / 24) * 24 * 60);
        const seconds = Math.round((time - hours / 24 - minutes / 24 / 60) * 24 * 60 * 60);
        date.setHours(hours);
        date.setMinutes(minutes);
        date.setSeconds(seconds);
        return date;
    }
    // -----------------------------------------------------------------------------
    // Formatting
    // -----------------------------------------------------------------------------
    function formatDateTime(internalDate) {
        // TODO: unify the format functions for date and datetime
        // This requires some code to 'parse' or 'tokenize' the format, keep it in a
        // cache, and use it in a single mapping, that recognizes the special list
        // of tokens dd,d,m,y,h, ... and preserves the rest
        const dateTimeFormat = internalDate.format;
        const jsDate = internalDate.jsDate || numberToJsDate(internalDate.value);
        const indexH = dateTimeFormat.indexOf("h");
        let strDate = "";
        let strTime = "";
        if (indexH > 0) {
            strDate = formatJSDate(jsDate, dateTimeFormat.substring(0, indexH - 1));
            strTime = formatJSTime(jsDate, dateTimeFormat.substring(indexH));
        }
        else if (indexH === 0) {
            strTime = formatJSTime(jsDate, dateTimeFormat);
        }
        else if (indexH < 0) {
            strDate = formatJSDate(jsDate, dateTimeFormat);
        }
        return strDate + (strDate && strTime ? " " : "") + strTime;
    }
    function formatJSDate(jsDate, format) {
        const sep = format.match(/\/|-|\s/)[0];
        const parts = format.split(sep);
        return parts
            .map((p) => {
            switch (p) {
                case "d":
                    return jsDate.getDate();
                case "dd":
                    return jsDate.getDate().toString().padStart(2, "0");
                case "m":
                    return jsDate.getMonth() + 1;
                case "mm":
                    return String(jsDate.getMonth() + 1).padStart(2, "0");
                case "yyyy":
                    return jsDate.getFullYear();
                default:
                    throw new Error(_lt("invalid format"));
            }
        })
            .join(sep);
    }
    function formatJSTime(jsDate, format) {
        let parts = format.split(/:|\s/);
        const dateHours = jsDate.getHours();
        const isMeridian = parts[parts.length - 1] === "a";
        let hours = dateHours;
        let meridian = "";
        if (isMeridian) {
            hours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            meridian = dateHours >= 12 ? " PM" : " AM";
            parts.pop();
        }
        return (parts
            .map((p) => {
            switch (p) {
                case "hhhh":
                    const helapsedHours = Math.floor((jsDate.getTime() - INITIAL_1900_DAY) / (60 * 60 * 1000));
                    return helapsedHours.toString();
                case "hh":
                    return hours.toString().padStart(2, "0");
                case "mm":
                    return jsDate.getMinutes().toString().padStart(2, "0");
                case "ss":
                    return jsDate.getSeconds().toString().padStart(2, "0");
                default:
                    throw new Error("invalid format");
            }
        })
            .join(":") + meridian);
    }

    /**
     * This regexp is supposed to be as close as possible as the numberRegexp, but
     * its purpose is to be used by the tokenizer.
     *
     * - it tolerates extra characters at the end. This is useful because the tokenizer
     *   only needs to find the number at the start of a string
     * - it does not accept "," as thousand separator, because when we tokenize a
     *   formula, commas are used to separate arguments
     */
    const formulaNumberRegexp = /^-?\d+(\.?\d*(e\d+)?)?(\s*%)?|^-?\.\d+(\s*%)?/;
    const numberRegexp = /^-?\d+(,\d+)*(\.?\d*(e\d+)?)?(\s*%)?$|^-?\.\d+(\s*%)?$/;
    /**
     * Return true if the argument is a "number string".
     *
     * Note that "" (empty string) does not count as a number string
     */
    function isNumber(value) {
        // TO DO: add regexp for DATE string format (ex match: "28 02 2020")
        return numberRegexp.test(value.trim());
    }
    const commaRegexp = /,/g;
    /**
     * Convert a string into a number. It assumes that the string actually represents
     * a number (as determined by the isNumber function)
     *
     * Note that it accepts "" (empty string), even though it does not count as a
     * number from the point of view of the isNumber function.
     */
    function parseNumber(str) {
        let n = Number(str.replace(commaRegexp, ""));
        if (isNaN(n) && str.includes("%")) {
            n = Number(str.split("%")[0]);
            if (!isNaN(n)) {
                return n / 100;
            }
        }
        return n;
    }
    const decimalStandardRepresentation = new Intl.NumberFormat("en-US", {
        useGrouping: false,
        maximumFractionDigits: 10,
    });
    function formatStandardNumber(n) {
        if (Number.isInteger(n)) {
            return n.toString();
        }
        return decimalStandardRepresentation.format(n);
    }
    // this is a cache than can contains decimal representation formats
    // from 0 (minimum) to 20 (maximum) digits after the decimal point
    let decimalRepresentations = [];
    const maximumDecimalPlaces = 20;
    function formatDecimal(n, decimals, sep = "") {
        if (n < 0) {
            return "-" + formatDecimal(-n, decimals);
        }
        const maxDecimals = decimals >= maximumDecimalPlaces ? maximumDecimalPlaces : decimals;
        let formatter = decimalRepresentations[maxDecimals];
        if (!formatter) {
            formatter = new Intl.NumberFormat("en-US", {
                minimumFractionDigits: maxDecimals,
                maximumFractionDigits: maxDecimals,
                useGrouping: false,
            });
            decimalRepresentations[maxDecimals] = formatter;
        }
        let result = formatter.format(n);
        if (sep) {
            let p = result.indexOf(".");
            result = result.replace(/\d(?=(?:\d{3})+(?:\.|$))/g, (m, i) => p < 0 || i < p ? `${m}${sep}` : m);
        }
        return result;
    }
    function formatNumber(value, format) {
        const parts = format.split(";");
        const l = parts.length;
        if (value < 0) {
            if (l > 1) {
                return _formatValue(-value, parts[1]);
            }
            else {
                return "-" + _formatValue(-value, parts[0]);
            }
        }
        const index = l === 3 && value === 0 ? 2 : 0;
        return _formatValue(value, parts[index]);
    }
    function _formatValue(value, format) {
        const parts = format.split(".");
        const decimals = parts.length === 1 ? 0 : parts[1].match(/0/g).length;
        const separator = parts[0].includes(",") ? "," : "";
        const isPercent = format.includes("%");
        if (isPercent) {
            value = value * 100;
        }
        const rawNumber = formatDecimal(value, decimals, separator);
        if (isPercent) {
            return rawNumber + "%";
        }
        return rawNumber;
    }

    // HELPERS
    const expectNumberValueError = (value) => _lt("The function [[FUNCTION_NAME]] expects a number value, but '%s' is a string, and cannot be coerced to a number.", value);
    function toNumber(value) {
        switch (typeof value) {
            case "number":
                return value;
            case "boolean":
                return value ? 1 : 0;
            case "string":
                if (isNumber(value) || value === "") {
                    return parseNumber(value);
                }
                const internalDate = parseDateTime(value);
                if (internalDate) {
                    return internalDate.value;
                }
                throw new Error(expectNumberValueError(value));
            default:
                return value || 0;
        }
    }
    function strictToNumber(value) {
        if (value === "") {
            throw new Error(expectNumberValueError(value));
        }
        return toNumber(value);
    }
    function visitNumbers(args, cb) {
        for (let n of args) {
            if (Array.isArray(n)) {
                for (let i of n) {
                    for (let j of i) {
                        if (typeof j === "number") {
                            cb(j);
                        }
                    }
                }
            }
            else {
                cb(strictToNumber(n));
            }
        }
    }
    function visitNumbersTextAs0(args, cb) {
        for (let n of args) {
            if (Array.isArray(n)) {
                for (let i of n) {
                    for (let j of i) {
                        if (j !== undefined && j !== null) {
                            if (typeof j === "number") {
                                cb(j);
                            }
                            else if (typeof j === "boolean") {
                                cb(toNumber(j));
                            }
                            else {
                                cb(0);
                            }
                        }
                    }
                }
            }
            else {
                cb(toNumber(n));
            }
        }
    }
    function visitAny(arg, cb) {
        if (Array.isArray(arg)) {
            for (let col of arg) {
                for (let cell of col) {
                    cb(cell);
                }
            }
        }
        else {
            cb(arg);
        }
    }
    function visitAnys(args, rangeCb, argCb) {
        for (let arg of args) {
            if (Array.isArray(arg)) {
                for (let col of arg) {
                    for (let cell of col) {
                        if (!rangeCb(cell))
                            return;
                    }
                }
            }
            else {
                if (!argCb(arg))
                    return;
            }
        }
    }
    function reduceArgs(args, cb, initialValue) {
        let val = initialValue;
        for (let arg of args) {
            visitAny(arg, (a) => {
                val = cb(val, a);
            });
        }
        return val;
    }
    function reduceNumbers(args, cb, initialValue) {
        let val = initialValue;
        visitNumbers(args, (a) => {
            val = cb(val, a);
        });
        return val;
    }
    function reduceNumbersTextAs0(args, cb, initialValue) {
        let val = initialValue;
        visitNumbersTextAs0(args, (a) => {
            val = cb(val, a);
        });
        return val;
    }
    function toString(value) {
        switch (typeof value) {
            case "string":
                return value;
            case "number":
                return value.toString();
            case "boolean":
                return value ? "TRUE" : "FALSE";
            default:
                return "";
        }
    }
    const expectBooleanValueError = (value) => _lt("The function [[FUNCTION_NAME]] expects a boolean value, but '%s' is a text, and cannot be coerced to a number.", value);
    function toBoolean(value) {
        switch (typeof value) {
            case "boolean":
                return value;
            case "string":
                if (value) {
                    let uppercaseVal = value.toUpperCase();
                    if (uppercaseVal === "TRUE") {
                        return true;
                    }
                    if (uppercaseVal === "FALSE") {
                        return false;
                    }
                    throw new Error(expectBooleanValueError(value));
                }
                else {
                    return false;
                }
            case "number":
                return value ? true : false;
            default:
                return false;
        }
    }
    function strictToBoolean(value) {
        if (value === "") {
            throw new Error(expectBooleanValueError(value));
        }
        return toBoolean(value);
    }
    function visitBooleans(args, cb) {
        visitAnys(args, (cell) => {
            if (typeof cell === "boolean") {
                return cb(cell);
            }
            if (typeof cell === "number") {
                return cb(cell ? true : false);
            }
            return true;
        }, (arg) => (arg !== null ? cb(strictToBoolean(arg)) : true));
    }
    function toJsDate(value) {
        return numberToJsDate(toNumber(value));
    }
    function getPredicate(descr, isQuery) {
        let operator;
        let operand;
        let subString = descr.substring(0, 2);
        if (subString === "<=" || subString === ">=" || subString === "<>") {
            operator = subString;
            operand = descr.substring(2);
        }
        else {
            subString = descr.substring(0, 1);
            if (subString === "<" || subString === ">" || subString === "=") {
                operator = subString;
                operand = descr.substring(1);
            }
            else {
                operator = "=";
                operand = descr;
            }
        }
        if (isNumber(operand)) {
            operand = toNumber(operand);
        }
        else if (operand === "TRUE" || operand === "FALSE") {
            operand = toBoolean(operand);
        }
        const result = { operator, operand };
        if (typeof operand === "string") {
            if (isQuery) {
                operand += "*";
            }
            result.regexp = operandToRegExp(operand);
        }
        return result;
    }
    function operandToRegExp(operand) {
        let exp = "";
        let predecessor = "";
        for (let char of operand) {
            if (char === "?" && predecessor !== "~") {
                exp += ".";
            }
            else if (char === "*" && predecessor !== "~") {
                exp += ".*";
            }
            else {
                if (char === "*" || char === "?") {
                    //remove "~"
                    exp = exp.slice(0, -1);
                }
                if (["^", ".", "[", "]", "$", "(", ")", "*", "+", "?", "|", "{", "}", "\\"].includes(char)) {
                    exp += "\\";
                }
                exp += char;
            }
            predecessor = char;
        }
        return new RegExp("^" + exp + "$", "i");
    }
    function evaluatePredicate(value, criterion) {
        const { operator, operand } = criterion;
        if (typeof operand === "number" && operator === "=") {
            return toString(value) === toString(operand);
        }
        if (operator === "<>" || operator === "=") {
            let result;
            if (typeof value === typeof operand) {
                if (criterion.regexp) {
                    result = criterion.regexp.test(value);
                }
                else {
                    result = value === operand;
                }
            }
            else {
                result = false;
            }
            return operator === "=" ? result : !result;
        }
        if (typeof value === typeof operand) {
            switch (operator) {
                case "<":
                    return value < operand;
                case ">":
                    return value > operand;
                case "<=":
                    return value <= operand;
                case ">=":
                    return value >= operand;
            }
        }
        return false;
    }
    /**
     * Functions used especially for predicate evaluation on ranges.
     *
     * Take ranges with same dimensions and take predicates, one for each range.
     * For (i, j) coordinates, if all elements with coordinates (i, j) of each
     * range correspond to the associated predicate, then the function uses a callback
     * function with the parameters "i" and "j".
     *
     * Syntax:
     * visitMatchingRanges([range1, predicate1, range2, predicate2, ...], cb(i,j), likeSelection)
     *
     * - range1 (range): The range to check against predicate1.
     * - predicate1 (string): The pattern or test to apply to range1.
     * - range2: (range, repeatable) ranges to check.
     * - predicate2 (string, repeatable): Additional pattern or test to apply to range2.
     *
     * - cb(i: number, j: number) => void: the callback function.
     *
     * - isQuery (boolean) indicates if the comparison with a string should be done as a SQL-like query.
     * (Ex1 isQuery = true, predicate = "abc", element = "abcde": predicate match the element),
     * (Ex2 isQuery = false, predicate = "abc", element = "abcde": predicate not match the element).
     * (Ex3 isQuery = true, predicate = "abc", element = "abc": predicate match the element),
     * (Ex4 isQuery = false, predicate = "abc", element = "abc": predicate match the element).
     */
    function visitMatchingRanges(args, cb, isQuery = false) {
        const countArg = args.length;
        if (countArg % 2 === 1) {
            throw new Error(_lt(`Function [[FUNCTION_NAME]] expects criteria_range and criterion to be in pairs.`));
        }
        const dimRow = args[0].length;
        const dimCol = args[0][0].length;
        let predicates = [];
        for (let i = 0; i < countArg - 1; i += 2) {
            const criteriaRange = args[i];
            if (criteriaRange.length !== dimRow || criteriaRange[0].length !== dimCol) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] expects criteria_range to have the same dimension`));
            }
            const description = toString(args[i + 1]);
            predicates.push(getPredicate(description, isQuery));
        }
        for (let i = 0; i < dimRow; i++) {
            for (let j = 0; j < dimCol; j++) {
                let validatedPredicates = true;
                for (let k = 0; k < countArg - 1; k += 2) {
                    const criteriaValue = args[k][i][j];
                    const criterion = predicates[k / 2];
                    validatedPredicates = evaluatePredicate(criteriaValue, criterion);
                    if (!validatedPredicates) {
                        break;
                    }
                }
                if (validatedPredicates) {
                    cb(i, j);
                }
            }
        }
    }
    // -----------------------------------------------------------------------------
    // COMMON FUNCTIONS
    // -----------------------------------------------------------------------------
    /**
     * Perform a dichotomic search and return the index of the nearest match less than
     * or equal to the target. If all values in the range are greater than the target,
     * -1 is returned.
     * If the range is not in sorted order, an incorrect value might be returned.
     *
     * Example:
     * - [3, 6, 10], 3 => 0
     * - [3, 6, 10], 6 => 1
     * - [3, 6, 10], 9 => 1
     * - [3, 6, 10], 42 => 2
     * - [3, 6, 10], 2 => -1
     * - [3, undefined, 6, undefined, 10], 9 => 2
     * - [3, 6, undefined, undefined, undefined, 10], 2 => -1
     */
    function dichotomicPredecessorSearch(range, target) {
        const targetType = typeof target;
        let valMin;
        let valMinIndex = undefined;
        let indexLeft = 0;
        let indexRight = range.length - 1;
        if (typeof range[indexLeft] === targetType && target < range[indexLeft]) {
            return -1;
        }
        if (typeof range[indexRight] === targetType && range[indexRight] <= target) {
            return indexRight;
        }
        let indexMedian;
        let currentIndex;
        let currentVal;
        let currentType;
        while (indexRight - indexLeft >= 0) {
            indexMedian = Math.ceil((indexLeft + indexRight) / 2);
            currentIndex = indexMedian;
            currentVal = range[currentIndex];
            currentType = typeof currentVal;
            // 1 - linear search to find value with the same type
            while (indexLeft <= currentIndex && targetType !== currentType) {
                currentIndex--;
                currentVal = range[currentIndex];
                currentType = typeof currentVal;
            }
            // 2 - check if value match
            if (currentType === targetType && currentVal <= target) {
                if (valMin === undefined ||
                    valMin < currentVal ||
                    (valMin === currentVal && valMinIndex < currentIndex)) {
                    valMin = currentVal;
                    valMinIndex = currentIndex;
                }
            }
            // 3 - give new indexs for the Binary search
            if (currentType === targetType && currentVal > target) {
                indexRight = currentIndex - 1;
            }
            else {
                indexLeft = indexMedian + 1;
            }
        }
        // note that valMinIndex could be 0
        return valMinIndex !== undefined ? valMinIndex : -1;
    }
    /**
     * Perform a dichotomic search and return the index of the nearest match more than
     * or equal to the target. If all values in the range are smaller than the target,
     * -1 is returned.
     * If the range is not in sorted order, an incorrect value might be returned.
     *
     * Example:
     * - [10, 6, 3], 3 => 2
     * - [10, 6, 3], 6 => 1
     * - [10, 6, 3], 9 => 0
     * - [10, 6, 3], 42 => -1
     * - [10, 6, 3], 2 => 2
     * - [10, undefined, 6, undefined, 3], 9 => 0
     * - [10, 6, undefined, undefined, undefined, 3], 2 => 5
     */
    function dichotomicSuccessorSearch(range, target) {
        const targetType = typeof target;
        let valMax;
        let valMaxIndex = undefined;
        let indexLeft = 0;
        let indexRight = range.length - 1;
        if (typeof range[indexLeft] === targetType && target > range[indexLeft]) {
            return -1;
        }
        if (typeof range[indexRight] === targetType && range[indexRight] > target) {
            return indexRight;
        }
        let indexMedian;
        let currentIndex;
        let currentVal;
        let currentType;
        while (indexRight - indexLeft >= 0) {
            indexMedian = Math.ceil((indexLeft + indexRight) / 2);
            currentIndex = indexMedian;
            currentVal = range[currentIndex];
            currentType = typeof currentVal;
            // 1 - linear search to find value with the same type
            while (indexLeft <= currentIndex && targetType !== currentType) {
                currentIndex--;
                currentVal = range[currentIndex];
                currentType = typeof currentVal;
            }
            // 2 - check if value match
            if (currentType === targetType && currentVal >= target) {
                if (valMax === undefined ||
                    valMax > currentVal ||
                    (valMax === currentVal && valMaxIndex > currentIndex)) {
                    valMax = currentVal;
                    valMaxIndex = currentIndex;
                }
            }
            // 3 - give new indexs for the Binary search
            if (currentType === targetType && currentVal <= target) {
                indexRight = currentIndex - 1;
            }
            else {
                indexLeft = indexMedian + 1;
            }
        }
        // note that valMaxIndex could be 0
        return valMaxIndex !== undefined ? valMaxIndex : -1;
    }

    /**
     * Registry
     *
     * The Registry class is basically just a mapping from a string key to an object.
     * It is really not much more than an object. It is however useful for the
     * following reasons:
     *
     * 1. it let us react and execute code when someone add something to the registry
     *   (for example, the FunctionRegistry subclass this for this purpose)
     * 2. it throws an error when the get operation fails
     * 3. it provides a chained API to add items to the registry.
     */
    class Registry {
        constructor() {
            this.content = {};
        }
        /**
         * Add an item to the registry
         *
         * Note that this also returns the registry, so another add method call can
         * be chained
         */
        add(key, value) {
            this.content[key] = value;
            return this;
        }
        /**
         * Get an item from the registry
         */
        get(key) {
            if (!(key in this.content)) {
                throw new Error(`Cannot find ${key} in this registry!`);
            }
            return this.content[key];
        }
        /**
         * Get a list of all elements in the registry
         */
        getAll() {
            return Object.values(this.content);
        }
        /**
         * Remove an item from the registry
         */
        remove(key) {
            delete this.content[key];
        }
    }

    //------------------------------------------------------------------------------
    // Arg description DSL
    //------------------------------------------------------------------------------
    const ARG_REGEXP = /(.*?)\((.*?)\)(.*)/;
    const ARG_TYPES = [
        "ANY",
        "BOOLEAN",
        "NUMBER",
        "STRING",
        "DATE",
        "RANGE",
        "RANGE<BOOLEAN>",
        "RANGE<NUMBER>",
        "RANGE<STRING>",
        "META",
    ];
    /**
     * This function is meant to be used as a tag for a template strings.
     *
     * Its job is to convert a textual description of the list of arguments into an
     * actual array of Arg, suitable for consumption.
     */
    function args(strings) {
        let lines = strings.split("\n");
        const result = [];
        for (let l of lines) {
            l = l.trim();
            if (l) {
                result.push(makeArg(l));
            }
        }
        return result;
    }
    function makeArg(str) {
        let parts = str.match(ARG_REGEXP);
        let name = parts[1].trim();
        let types = [];
        let isOptional = false;
        let isRepeating = false;
        let isLazy = false;
        let defaultValue;
        for (let param of parts[2].split(",")) {
            const key = param.trim().toUpperCase();
            let type = ARG_TYPES.find((t) => key === t);
            if (type) {
                types.push(type);
            }
            else if (key === "RANGE<ANY>") {
                types.push("RANGE");
            }
            else if (key === "OPTIONAL") {
                isOptional = true;
            }
            else if (key === "REPEATING") {
                isRepeating = true;
            }
            else if (key === "LAZY") {
                isLazy = true;
            }
            else if (key.startsWith("DEFAULT=")) {
                defaultValue = param.trim().slice(8);
            }
        }
        let description = parts[3].trim();
        const result = {
            name,
            description,
            type: types,
        };
        if (isOptional) {
            result.optional = true;
        }
        if (isRepeating) {
            result.repeating = true;
        }
        if (isLazy) {
            result.lazy = true;
        }
        if (defaultValue !== undefined) {
            result.default = true;
            result.defaultValue = defaultValue;
        }
        return result;
    }
    /**
     * This function adds on description more general information derived from the
     * arguments.
     *
     * This information is useful during compilation.
     */
    function addMetaInfoFromArg(addDescr) {
        let countArg = 0;
        let minArg = 0;
        let repeatingArg = 0;
        for (let arg of addDescr.args) {
            countArg++;
            if (!arg.optional && !arg.repeating && !arg.default) {
                minArg++;
            }
            if (arg.repeating) {
                repeatingArg++;
            }
        }
        const descr = addDescr;
        descr.minArgRequired = minArg;
        descr.maxArgPossible = repeatingArg ? Infinity : countArg;
        descr.nbrArgRepeating = repeatingArg;
        descr.getArgToFocus = argTargeting(countArg, repeatingArg);
        return descr;
    }
    /**
     * Returns a function allowing finding which argument corresponds a position
     * in a function. This is particularly useful for functions with repeatable
     * arguments.
     *
     * Indeed the function makes it possible to etablish corespondance between
     * arguments when the number of arguments supplied is greater than the number of
     * arguments defined by the function.
     *
     * Ex:
     *
     * in the formula "=SUM(11, 55, 66)" which is defined like this "SUM(value1, [value2, ...])"
     * - 11 corresponds to the value1 argument => position will be 1
     * - 55 corresponds to the [value2, ...] argument => position will be 2
     * - 66 corresponds to the [value2, ...] argument => position will be 2
     *
     * in the formula "=AVERAGE.WEIGHTED(1, 2, 3, 4, 5, 6)" which is defined like this
     * "AVERAGE.WEIGHTED(values, weights, [additional_values, ...], [additional_weights, ...])"
     * - 1 corresponds to the values argument => position will be 1
     * - 2 corresponds to the weights argument => position will be 2
     * - 3 corresponds to the [additional_values, ...] argument => position will be 3
     * - 4 corresponds to the [additional_weights, ...] argument => position will be 4
     * - 5 corresponds to the [additional_values, ...] argument => position will be 3
     * - 6 corresponds to the [additional_weights, ...] argument => position will be 4
     */
    function argTargeting(countArg, repeatingArg) {
        if (!repeatingArg) {
            return (argPosition) => argPosition;
        }
        if (repeatingArg === 1) {
            return (argPosition) => Math.min(argPosition, countArg);
        }
        const argBeforeRepeat = countArg - repeatingArg;
        return (argPosition) => {
            if (argPosition <= argBeforeRepeat) {
                return argPosition;
            }
            const argAfterRepeat = (argPosition - argBeforeRepeat) % repeatingArg || repeatingArg;
            return argBeforeRepeat + argAfterRepeat;
        };
    }
    //------------------------------------------------------------------------------
    // Argument validation
    //------------------------------------------------------------------------------
    function validateArguments(args) {
        let previousArgRepeating = false;
        let previousArgOptional = false;
        let previousArgDefault = false;
        for (let current of args) {
            if (current.type.includes("META") && current.type.length > 1) {
                throw new Error(_lt("Function ${name} has an argument that has been declared with more than one type whose type 'META'. The 'META' type can only be declared alone."));
            }
            if (previousArgRepeating && !current.repeating) {
                throw new Error(_lt("Function ${name} has no-repeatable arguments declared after repeatable ones. All repeatable arguments must be declared last."));
            }
            const previousIsOptional = previousArgOptional || previousArgRepeating || previousArgDefault;
            const currentIsntOptional = !(current.optional || current.repeating || current.default);
            if (previousIsOptional && currentIsntOptional) {
                throw new Error(_lt("Function ${name} has at mandatory arguments declared after optional ones. All optional arguments must be after all mandatory arguments."));
            }
            previousArgRepeating = current.repeating;
            previousArgOptional = current.optional;
            previousArgDefault = current.default;
        }
    }

    var CancelledReason;
    (function (CancelledReason) {
        CancelledReason[CancelledReason["Unknown"] = 0] = "Unknown";
        CancelledReason[CancelledReason["WillRemoveExistingMerge"] = 1] = "WillRemoveExistingMerge";
        CancelledReason[CancelledReason["MergeIsDestructive"] = 2] = "MergeIsDestructive";
        CancelledReason[CancelledReason["EmptyUndoStack"] = 3] = "EmptyUndoStack";
        CancelledReason[CancelledReason["EmptyRedoStack"] = 4] = "EmptyRedoStack";
        CancelledReason[CancelledReason["NotEnoughColumns"] = 5] = "NotEnoughColumns";
        CancelledReason[CancelledReason["NotEnoughRows"] = 6] = "NotEnoughRows";
        CancelledReason[CancelledReason["NotEnoughSheets"] = 7] = "NotEnoughSheets";
        CancelledReason[CancelledReason["WrongSheetName"] = 8] = "WrongSheetName";
        CancelledReason[CancelledReason["WrongSheetMove"] = 9] = "WrongSheetMove";
        CancelledReason[CancelledReason["WrongSheetPosition"] = 10] = "WrongSheetPosition";
        CancelledReason[CancelledReason["SelectionOutOfBound"] = 11] = "SelectionOutOfBound";
        CancelledReason[CancelledReason["WrongPasteSelection"] = 12] = "WrongPasteSelection";
        CancelledReason[CancelledReason["EmptyClipboard"] = 13] = "EmptyClipboard";
        CancelledReason[CancelledReason["InvalidRange"] = 14] = "InvalidRange";
        CancelledReason[CancelledReason["InvalidSheetId"] = 15] = "InvalidSheetId";
        CancelledReason[CancelledReason["InputAlreadyFocused"] = 16] = "InputAlreadyFocused";
        CancelledReason[CancelledReason["MaximumRangesReached"] = 17] = "MaximumRangesReached";
        CancelledReason[CancelledReason["InvalidChartDefinition"] = 18] = "InvalidChartDefinition";
        CancelledReason[CancelledReason["EmptyDataSet"] = 19] = "EmptyDataSet";
        CancelledReason[CancelledReason["EmptyLabelRange"] = 20] = "EmptyLabelRange";
        CancelledReason[CancelledReason["InvalidDataSet"] = 21] = "InvalidDataSet";
        CancelledReason[CancelledReason["InvalidLabelRange"] = 22] = "InvalidLabelRange";
        CancelledReason[CancelledReason["InvalidAutofillSelection"] = 23] = "InvalidAutofillSelection";
        CancelledReason[CancelledReason["WrongComposerSelection"] = 24] = "WrongComposerSelection";
        CancelledReason[CancelledReason["MinBiggerThanMax"] = 25] = "MinBiggerThanMax";
        CancelledReason[CancelledReason["MidBiggerThanMax"] = 26] = "MidBiggerThanMax";
        CancelledReason[CancelledReason["MinBiggerThanMid"] = 27] = "MinBiggerThanMid";
        CancelledReason[CancelledReason["InvalidNumberOfArgs"] = 28] = "InvalidNumberOfArgs";
        CancelledReason[CancelledReason["MinNaN"] = 29] = "MinNaN";
        CancelledReason[CancelledReason["MidNaN"] = 30] = "MidNaN";
        CancelledReason[CancelledReason["MaxNaN"] = 31] = "MaxNaN";
        CancelledReason[CancelledReason["MinAsyncFormulaNotSupported"] = 32] = "MinAsyncFormulaNotSupported";
        CancelledReason[CancelledReason["MidAsyncFormulaNotSupported"] = 33] = "MidAsyncFormulaNotSupported";
        CancelledReason[CancelledReason["MaxAsyncFormulaNotSupported"] = 34] = "MaxAsyncFormulaNotSupported";
        CancelledReason[CancelledReason["MinInvalidFormula"] = 35] = "MinInvalidFormula";
        CancelledReason[CancelledReason["MidInvalidFormula"] = 36] = "MidInvalidFormula";
        CancelledReason[CancelledReason["MaxInvalidFormula"] = 37] = "MaxInvalidFormula";
        CancelledReason[CancelledReason["InvalidSortZone"] = 38] = "InvalidSortZone";
    })(CancelledReason || (CancelledReason = {}));

    var ReturnFormatType;
    (function (ReturnFormatType) {
        ReturnFormatType["FormatFromArgument"] = "FormatFromArgument";
    })(ReturnFormatType || (ReturnFormatType = {}));

    // -----------------------------------------------------------------------------
    // MISC
    // -----------------------------------------------------------------------------
    var CellType;
    (function (CellType) {
        CellType["text"] = "text";
        CellType["number"] = "number";
        CellType["formula"] = "formula";
        CellType["empty"] = "empty";
        CellType["invalidFormula"] = "invalidFormula";
    })(CellType || (CellType = {}));
    var DIRECTION;
    (function (DIRECTION) {
        DIRECTION[DIRECTION["UP"] = 0] = "UP";
        DIRECTION[DIRECTION["DOWN"] = 1] = "DOWN";
        DIRECTION[DIRECTION["LEFT"] = 2] = "LEFT";
        DIRECTION[DIRECTION["RIGHT"] = 3] = "RIGHT";
    })(DIRECTION || (DIRECTION = {}));

    var LAYERS;
    (function (LAYERS) {
        LAYERS[LAYERS["Background"] = 0] = "Background";
        LAYERS[LAYERS["Highlights"] = 1] = "Highlights";
        LAYERS[LAYERS["Clipboard"] = 2] = "Clipboard";
        LAYERS[LAYERS["Search"] = 3] = "Search";
        LAYERS[LAYERS["Chart"] = 4] = "Chart";
        LAYERS[LAYERS["Selection"] = 5] = "Selection";
        LAYERS[LAYERS["Autofill"] = 6] = "Autofill";
        LAYERS[LAYERS["Headers"] = 7] = "Headers";
    })(LAYERS || (LAYERS = {}));

    // -----------------------------------------------------------------------------
    // ACOS
    // -----------------------------------------------------------------------------
    const ACOS = {
        description: _lt("Inverse cosine of a value, in radians."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse cosine. Must be between -1 and 1, inclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) > 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. Valid values are between -1 and 1 inclusive.", _value.toString()));
            }
            return Math.acos(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ACOSH
    // -----------------------------------------------------------------------------
    const ACOSH = {
        description: _lt("Inverse hyperbolic cosine of a number."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic cosine. Must be greater than or equal to 1.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value < 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. It should be greater than or equal to 1.", _value.toString()));
            }
            return Math.acosh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ACOT
    // -----------------------------------------------------------------------------
    const ACOT = {
        description: _lt("Inverse cotangent of a value."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse cotangent.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            const sign = Math.sign(_value) || 1;
            // ACOT has two possible configurations:
            // @compatibility Excel: return Math.PI / 2 - Math.atan(toNumber(_value));
            // @compatibility Google: return sign * Math.PI / 2 - Math.atan(toNumber(_value));
            return (sign * Math.PI) / 2 - Math.atan(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ACOTH
    // -----------------------------------------------------------------------------
    const ACOTH = {
        description: _lt("Inverse hyperbolic cotangent of a value."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic cotangent. Must not be between -1 and 1, inclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) <= 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. Valid values cannot be between -1 and 1 inclusive.", _value.toString()));
            }
            return Math.log((_value + 1) / (_value - 1)) / 2;
        },
    };
    // -----------------------------------------------------------------------------
    // ASIN
    // -----------------------------------------------------------------------------
    const ASIN = {
        description: _lt("Inverse sine of a value, in radians."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse sine. Must be between -1 and 1, inclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) > 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %S. Valid values are between -1 and 1 inclusive.", _value.toString()));
            }
            return Math.asin(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // ASINH
    // -----------------------------------------------------------------------------
    const ASINH = {
        description: _lt("Inverse hyperbolic sine of a number."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic sine.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.asinh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // ATAN
    // -----------------------------------------------------------------------------
    const ATAN = {
        description: _lt("Inverse tangent of a value, in radians."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse tangent.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.atan(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // ATAN2
    // -----------------------------------------------------------------------------
    const ATAN2 = {
        description: _lt("Angle from the X axis to a point (x,y), in radians."),
        args: args(`
    x (number) ${_lt("The x coordinate of the endpoint of the line segment for which to calculate the angle from the x-axis.")}
    y (number) ${_lt("The y coordinate of the endpoint of the line segment for which to calculate the angle from the x-axis.")}
  `),
        returns: ["NUMBER"],
        compute: function (x, y) {
            const _x = toNumber(x);
            const _y = toNumber(y);
            if (_x === 0 && _y === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return Math.atan2(_y, _x);
        },
    };
    // -----------------------------------------------------------------------------
    // ATANH
    // -----------------------------------------------------------------------------
    const ATANH = {
        description: _lt("Inverse hyperbolic tangent of a number."),
        args: args(`
    value (number) ${_lt("The value for which to calculate the inverse hyperbolic tangent. Must be between -1 and 1, exclusive.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (Math.abs(_value) >= 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. Valid values are between -1 and 1 exclusive.", _value.toString()));
            }
            return Math.atanh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // CEILING
    // -----------------------------------------------------------------------------
    const CEILING = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
    value (number) ${_lt("The value to round up to the nearest integer multiple of factor.")}
    factor (number, default=1) ${_lt("The number to whose multiples value will be rounded.")}
  `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value, factor = 1) {
            const _value = toNumber(value);
            const _factor = toNumber(factor);
            if (_value > 0 && _factor < 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] expects the parameter '%s' to be positive when parameter '%s' is positive. Change '%s' from [%s] to a positive value.", CEILING.args[1].name, CEILING.args[0].name, CEILING.args[1].name, _factor.toString()));
            }
            return _factor ? Math.ceil(_value / _factor) * _factor : 0;
        },
    };
    // -----------------------------------------------------------------------------
    // CEILING.MATH
    // -----------------------------------------------------------------------------
    const CEILING_MATH = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round up to the nearest integer multiple of significance.")}
    significance (number, default=1) ${_lt("The number to whose multiples number will be rounded. The sign of significance will be ignored.")}
    mode (number, default=0) ${_lt("If number is negative, specifies the rounding direction. If 0 or blank, it is rounded towards zero. Otherwise, it is rounded away from zero.")}
  `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (number, significance = 1, mode = 0) {
            let _significance = toNumber(significance);
            if (_significance === 0) {
                return 0;
            }
            const _number = toNumber(number);
            _significance = Math.abs(_significance);
            if (_number >= 0) {
                return Math.ceil(_number / _significance) * _significance;
            }
            const _mode = toNumber(mode);
            if (_mode === 0) {
                return -Math.floor(Math.abs(_number) / _significance) * _significance;
            }
            return -Math.ceil(Math.abs(_number) / _significance) * _significance;
        },
    };
    // -----------------------------------------------------------------------------
    // CEILING.PRECISE
    // -----------------------------------------------------------------------------
    const CEILING_PRECISE = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round up to the nearest integer multiple of significance.")}
    significance (number, default=1) ${_lt("The number to whose multiples number will be rounded.")}
  `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (number, significance) {
            return CEILING_MATH.compute(number, significance, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // COS
    // -----------------------------------------------------------------------------
    const COS = {
        description: _lt("Cosine of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the cosine of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return Math.cos(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // COSH
    // -----------------------------------------------------------------------------
    const COSH = {
        description: _lt("Hyperbolic cosine of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic cosine of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.cosh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // COT
    // -----------------------------------------------------------------------------
    const COT = {
        description: _lt("Cotangent of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the cotangent of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            const _angle = toNumber(angle);
            if (_angle === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.tan(_angle);
        },
    };
    // -----------------------------------------------------------------------------
    // COTH
    // -----------------------------------------------------------------------------
    const COTH = {
        description: _lt("Hyperbolic cotangent of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic cotangent of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.tanh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTBLANK
    // -----------------------------------------------------------------------------
    const COUNTBLANK = {
        description: _lt("Number of empty values."),
        args: args(`
    value1 (any, range) ${_lt("The first value or range in which to count the number of blanks.")}
    value2 (any, range, repeating) ${_lt("Additional values or ranges in which to count the number of blanks.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => (a === null || a === undefined || a === "" ? acc + 1 : acc), 0);
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTIF
    // -----------------------------------------------------------------------------
    const COUNTIF = {
        description: _lt("A conditional count across a range."),
        args: args(`
    range (any, range) ${_lt("The range that is tested against criterion.")}
    criterion (string) ${_lt("The pattern or test to apply to range.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            visitMatchingRanges(arguments, (i, j) => {
                count += 1;
            });
            return count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTIFS
    // -----------------------------------------------------------------------------
    const COUNTIFS = {
        description: _lt("Count values depending on multiple criteria."),
        args: args(`
    criteria_range1 (any, range) ${_lt("The range to check against criterion1.")}
    criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1.")}
    criteria_range2 (any, range, repeating) ${_lt("Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.")}
    criterion2 (string, repeating) ${_lt("Additional criteria to check.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            visitMatchingRanges(arguments, (i, j) => {
                count += 1;
            });
            return count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTUNIQUE
    // -----------------------------------------------------------------------------
    function isDefined(value) {
        switch (value) {
            case undefined:
                return false;
            case "":
                return false;
            case null:
                return false;
            default:
                return true;
        }
    }
    const COUNTUNIQUE = {
        description: _lt("Counts number of unique values in a range."),
        args: args(`
    value1 (any, range) ${_lt("The first value or range to consider for uniqueness.")}
    value2 (any, range, repeating) ${_lt("Additional values or ranges to consider for uniqueness.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => (isDefined(a) ? acc.add(a) : acc), new Set()).size;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTUNIQUEIFS
    // -----------------------------------------------------------------------------
    const COUNTUNIQUEIFS = {
        description: _lt("Counts number of unique values in a range, filtered by a set of criteria."),
        args: args(`
    range (any, range) ${_lt("The range of cells from which the number of unique values will be counted.")}
    criteria_range1 (any, range) ${_lt("The range of cells over which to evaluate criterion1.")}
    criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.")}
    criteria_range2 (any, range, repeating) ${_lt("Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.")}
    criterion2 (string, repeating) ${_lt("The pattern or test to apply to criteria_range2.")}
  `),
        returns: ["NUMBER"],
        compute: function (range, ...args) {
            let uniqueValues = new Set();
            visitMatchingRanges(args, (i, j) => {
                const value = range[i][j];
                if (isDefined(value)) {
                    uniqueValues.add(value);
                }
            });
            return uniqueValues.size;
        },
    };
    // -----------------------------------------------------------------------------
    // CSC
    // -----------------------------------------------------------------------------
    const CSC = {
        description: _lt("Cosecant of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the cosecant of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            const _angle = toNumber(angle);
            if (_angle === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.sin(_angle);
        },
    };
    // -----------------------------------------------------------------------------
    // CSCH
    // -----------------------------------------------------------------------------
    const CSCH = {
        description: _lt("Hyperbolic cosecant of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic cosecant of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return 1 / Math.sinh(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // DECIMAL
    // -----------------------------------------------------------------------------
    const decimalErrorParameter2 = (parameterName, base, value) => _lt("Function DECIMAL expects the parameter '%s' to be a valid base %s representation. Change '%s' from [%s] to a valid base %s representation.", parameterName, base, parameterName, value, base);
    const DECIMAL = {
        description: _lt("Converts from another base to decimal."),
        args: args(`
    value (string) ${_lt("The number to convert.")},
    base (number) ${_lt("The base to convert the value from.")},
  `),
        returns: ["NUMBER"],
        compute: function (value, base) {
            let _base = toNumber(base);
            _base = Math.floor(_base);
            if (_base < 2 || _base > 36) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] expects the parameter '%s' to be between 2 and 36 inclusive. Change '%s' from [%s] to a value between 2 and 36.", DECIMAL.args[1].name, DECIMAL.args[1].name, _base.toString()));
            }
            const _value = toString(value);
            if (_value === "") {
                return 0;
            }
            /**
             * @compatibility: on Google sheets, expects the parameter 'value' to be positive.
             * Return error if 'value' is positive.
             * Remove '-?' in the next regex to catch this error.
             */
            if (!_value.match(/^-?[a-z0-9]+$/i)) {
                throw new Error(decimalErrorParameter2(DECIMAL.args[0].name, _base, _value));
            }
            const deci = parseInt(_value, _base);
            if (isNaN(deci)) {
                throw new Error(decimalErrorParameter2(DECIMAL.args[0].name, _base, _value));
            }
            return deci;
        },
    };
    // -----------------------------------------------------------------------------
    // DEGREES
    // -----------------------------------------------------------------------------
    const DEGREES = {
        description: _lt(`Converts an angle value in radians to degrees.`),
        args: args(`
    angle (number)  ${_lt("The angle to convert from radians to degrees.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return (toNumber(angle) * 180) / Math.PI;
        },
    };
    // -----------------------------------------------------------------------------
    // EXP
    // -----------------------------------------------------------------------------
    const EXP = {
        description: _lt(`Euler's number, e (~2.718) raised to a power.`),
        args: args(`
    value (number) ${_lt("The exponent to raise e.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.exp(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // FLOOR
    // -----------------------------------------------------------------------------
    const FLOOR = {
        description: _lt(`Rounds number down to nearest multiple of factor.`),
        args: args(`
    value (number) ${_lt("The value to round down to the nearest integer multiple of factor.")}
    factor (number, default=1) ${_lt("The number to whose multiples value will be rounded.")}
  `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value, factor = 1) {
            const _value = toNumber(value);
            const _factor = toNumber(factor);
            if (_value > 0 && _factor < 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] expects the parameter '%s' to be positive when parameter '%s' is positive. Change '%s' from [%s] to a positive value.", FLOOR.args[1].name, FLOOR.args[0].name, FLOOR.args[1].name, _factor.toString()));
            }
            return _factor ? Math.floor(_value / _factor) * _factor : 0;
        },
    };
    // -----------------------------------------------------------------------------
    // FLOOR.MATH
    // -----------------------------------------------------------------------------
    const FLOOR_MATH = {
        description: _lt(`Rounds number down to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round down to the nearest integer multiple of significance.")}
    significance (number, default=1) ${_lt("The number to whose multiples number will be rounded. The sign of significance will be ignored.")}
    mode (number, default=0) ${_lt("If number is negative, specifies the rounding direction. If 0 or blank, it is rounded away from zero. Otherwise, it is rounded towards zero.")}
  `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (number, significance = 1, mode = 0) {
            let _significance = toNumber(significance);
            if (_significance === 0) {
                return 0;
            }
            const _number = toNumber(number);
            _significance = Math.abs(_significance);
            if (_number >= 0) {
                return Math.floor(_number / _significance) * _significance;
            }
            const _mode = toNumber(mode);
            if (_mode === 0) {
                return -Math.ceil(Math.abs(_number) / _significance) * _significance;
            }
            return -Math.floor(Math.abs(_number) / _significance) * _significance;
        },
    };
    // -----------------------------------------------------------------------------
    // FLOOR.PRECISE
    // -----------------------------------------------------------------------------
    const FLOOR_PRECISE = {
        description: _lt(`Rounds number down to nearest multiple of factor.`),
        args: args(`
    number (number) ${_lt("The value to round down to the nearest integer multiple of significance.")}
    significance (number, default=1) ${_lt("The number to whose multiples number will be rounded.")}
  `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (number, significance = 1) {
            return FLOOR_MATH.compute(number, significance, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // ISEVEN
    // -----------------------------------------------------------------------------
    const ISEVEN = {
        description: _lt(`Whether the provided value is even.`),
        args: args(`
    value (number) ${_lt("The value to be verified as even.")}
  `),
        returns: ["BOOLEAN"],
        compute: function (value) {
            const _value = strictToNumber(value);
            return Math.floor(Math.abs(_value)) & 1 ? false : true;
        },
    };
    // -----------------------------------------------------------------------------
    // ISO.CEILING
    // -----------------------------------------------------------------------------
    const ISO_CEILING = {
        description: _lt(`Rounds number up to nearest multiple of factor.`),
        args: args(`
      number (number) ${_lt("The value to round up to the nearest integer multiple of significance.")}
      significance (number, default=1) ${_lt("The number to whose multiples number will be rounded.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (number, significance) {
            return CEILING_MATH.compute(number, significance, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // ISODD
    // -----------------------------------------------------------------------------
    const ISODD = {
        description: _lt(`Whether the provided value is even.`),
        args: args(`
    value (number) ${_lt("The value to be verified as even.")}
  `),
        returns: ["BOOLEAN"],
        compute: function (value) {
            const _value = strictToNumber(value);
            return Math.floor(Math.abs(_value)) & 1 ? true : false;
        },
    };
    // -----------------------------------------------------------------------------
    // LN
    // -----------------------------------------------------------------------------
    const LN = {
        description: _lt(`The logarithm of a number, base e (euler's number).`),
        args: args(`
    value (number) ${_lt("The value for which to calculate the logarithm, base e.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            const _value = toNumber(value);
            if (_value <= 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value is %s. It should be greater than 0.", _value.toString()));
            }
            return Math.log(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // MOD
    // -----------------------------------------------------------------------------
    const MOD = {
        description: _lt(`Modulo (remainder) operator.`),
        args: args(`
      dividend (number) ${_lt("The number to be divided to find the remainder.")}
      divisor (number) ${_lt("The number to divide by.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (dividend, divisor) {
            const _divisor = toNumber(divisor);
            if (_divisor === 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] expects the parameter '%s' to be different from 0. Change '%s' to a value other than 0.", MOD.args[1].name, MOD.args[1].name));
            }
            const _dividend = toNumber(dividend);
            const modulus = _dividend % _divisor;
            // -42 % 10 = -2 but we want 8, so need the code below
            if ((modulus > 0 && _divisor < 0) || (modulus < 0 && _divisor > 0)) {
                return modulus + _divisor;
            }
            return modulus;
        },
    };
    // -----------------------------------------------------------------------------
    // ODD
    // -----------------------------------------------------------------------------
    const ODD = {
        description: _lt(`Rounds a number up to the nearest odd integer.`),
        args: args(`
      value (number) ${_lt("The value to round to the next greatest odd number.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value) {
            const _value = toNumber(value);
            let temp = Math.ceil(Math.abs(_value));
            temp = temp & 1 ? temp : temp + 1;
            return _value < 0 ? -temp : temp;
        },
    };
    // -----------------------------------------------------------------------------
    // PI
    // -----------------------------------------------------------------------------
    const PI = {
        description: _lt(`The number pi.`),
        args: [],
        returns: ["NUMBER"],
        compute: function () {
            return Math.PI;
        },
    };
    // -----------------------------------------------------------------------------
    // POWER
    // -----------------------------------------------------------------------------
    const POWER = {
        description: _lt(`A number raised to a power.`),
        args: args(`
      base (number) ${_lt("The number to raise to the exponent power.")}
      exponent (number) ${_lt("The exponent to raise base to.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (base, exponent) {
            const _base = toNumber(base);
            const _exponent = toNumber(exponent);
            if (_base >= 0) {
                return Math.pow(_base, _exponent);
            }
            if (!Number.isInteger(_exponent)) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] expects the parameter '%s' to be an integer when parameter '%s' is negative. Change '%s' from [%s] to an integer value.", POWER.args[1].name, POWER.args[0].name, POWER.args[1].name, _exponent.toString()));
            }
            return Math.pow(_base, _exponent);
        },
    };
    // -----------------------------------------------------------------------------
    // PRODUCT
    // -----------------------------------------------------------------------------
    const PRODUCT = {
        description: _lt("Result of multiplying a series of numbers together."),
        args: args(`
      factor1 (number, range<number>) ${_lt("The first number or range to calculate for the product.")}
      factor2 (number, range<number>, repeating) ${_lt("More numbers or ranges to calculate for the product.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let count = 0;
            let acc = 1;
            for (let n of arguments) {
                if (Array.isArray(n)) {
                    for (let i of n) {
                        for (let j of i) {
                            if (typeof j === "number") {
                                acc *= j;
                                count += 1;
                            }
                        }
                    }
                }
                else if (n !== null) {
                    acc *= strictToNumber(n);
                    count += 1;
                }
            }
            if (count === 0) {
                return 0;
            }
            return acc;
        },
    };
    // -----------------------------------------------------------------------------
    // RAND
    // -----------------------------------------------------------------------------
    const RAND = {
        description: _lt("A random number between 0 inclusive and 1 exclusive."),
        args: [],
        returns: ["NUMBER"],
        compute: function () {
            return Math.random();
        },
    };
    // -----------------------------------------------------------------------------
    // RANDBETWEEN
    // -----------------------------------------------------------------------------
    const RANDBETWEEN = {
        description: _lt("Random integer between two values, inclusive."),
        args: args(`
      low (number) ${_lt("The low end of the random range.")}
      high (number) ${_lt("The high end of the random range.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (low, high) {
            let _low = toNumber(low);
            if (!Number.isInteger(_low)) {
                _low = Math.ceil(_low);
            }
            let _high = toNumber(high);
            if (!Number.isInteger(_high)) {
                _high = Math.floor(_high);
            }
            if (_high < _low) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter '%s' value is %s. It should be greater than or equal to [%s].", RANDBETWEEN.args[1].name, _high.toString(), _low.toString()));
            }
            return _low + Math.ceil((_high - _low + 1) * Math.random()) - 1;
        },
    };
    // -----------------------------------------------------------------------------
    // ROUND
    // -----------------------------------------------------------------------------
    const ROUND = {
        description: _lt("Rounds a number according to standard rules."),
        args: args(`
      value (number) ${_lt("The value to round to places number of places.")}
      places (number, default=0) ${_lt("The number of decimal places to which to round.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value, places = 0) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            const absValue = Math.abs(_value);
            let tempResult;
            if (_places === 0) {
                tempResult = Math.round(absValue);
            }
            else {
                if (!Number.isInteger(_places)) {
                    _places = Math.trunc(_places);
                }
                tempResult = Math.round(absValue * Math.pow(10, _places)) / Math.pow(10, _places);
            }
            return _value >= 0 ? tempResult : -tempResult;
        },
    };
    // -----------------------------------------------------------------------------
    // ROUNDDOWN
    // -----------------------------------------------------------------------------
    const ROUNDDOWN = {
        description: _lt(`Rounds down a number.`),
        args: args(`
      value (number) ${_lt("The value to round to places number of places, always rounding down.")}
      places (number, default=0) ${_lt("The number of decimal places to which to round.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value, places = 0) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            const absValue = Math.abs(_value);
            let tempResult;
            if (_places === 0) {
                tempResult = Math.floor(absValue);
            }
            else {
                if (!Number.isInteger(_places)) {
                    _places = Math.trunc(_places);
                }
                tempResult = Math.floor(absValue * Math.pow(10, _places)) / Math.pow(10, _places);
            }
            return _value >= 0 ? tempResult : -tempResult;
        },
    };
    // -----------------------------------------------------------------------------
    // ROUNDUP
    // -----------------------------------------------------------------------------
    const ROUNDUP = {
        description: _lt(`Rounds up a number.`),
        args: args(`
      value (number) ${_lt("The value to round to places number of places, always rounding up.")}
      places (number, default=0) ${_lt("The number of decimal places to which to round.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value, places) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            const absValue = Math.abs(_value);
            let tempResult;
            if (_places === 0) {
                tempResult = Math.ceil(absValue);
            }
            else {
                if (!Number.isInteger(_places)) {
                    _places = Math.trunc(_places);
                }
                tempResult = Math.ceil(absValue * Math.pow(10, _places)) / Math.pow(10, _places);
            }
            return _value >= 0 ? tempResult : -tempResult;
        },
    };
    // -----------------------------------------------------------------------------
    // SEC
    // -----------------------------------------------------------------------------
    const SEC = {
        description: _lt("Secant of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the secant of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return 1 / Math.cos(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // SECH
    // -----------------------------------------------------------------------------
    const SECH = {
        description: _lt("Hyperbolic secant of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic secant of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return 1 / Math.cosh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // SIN
    // -----------------------------------------------------------------------------
    const SIN = {
        description: _lt("Sine of an angle provided in radians."),
        args: args(`
      angle (number) ${_lt("The angle to find the sine of, in radians.")}
    `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return Math.sin(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // SINH
    // -----------------------------------------------------------------------------
    const SINH = {
        description: _lt("Hyperbolic sine of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic sine of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.sinh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // SQRT
    // -----------------------------------------------------------------------------
    const SQRT = {
        description: _lt("Positive square root of a positive number."),
        args: args(`
      value (number) ${_lt("The number for which to calculate the positive square root.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value) {
            const _value = toNumber(value);
            if (_value < 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter '%s' value is negative. It should be positive or zero. Change '%s' from [%s] to a positive value.", SQRT.args[0].name, SQRT.args[0].name, _value.toString()));
            }
            return Math.sqrt(_value);
        },
    };
    // -----------------------------------------------------------------------------
    // SUM
    // -----------------------------------------------------------------------------
    const SUM = {
        description: _lt("Sum of a series of numbers and/or cells."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first number or range to add together.")}
      value2 (number, range<number>, repeating) ${_lt("Additional numbers or ranges to add to value1.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            return reduceNumbers(arguments, (acc, a) => acc + a, 0);
        },
    };
    // -----------------------------------------------------------------------------
    // SUMIF
    // -----------------------------------------------------------------------------
    const SUMIF = {
        description: _lt("A conditional sum across a range."),
        args: args(`
      criteria_range (any, range) ${_lt("The range which is tested against criterion.")}
      criterion (string) ${_lt("The pattern or test to apply to range.")}
      sum_range (any, range, default=${_lt("criteria_range")}) ${_lt("The range to be summed, if different from range.")}
    `),
        returns: ["NUMBER"],
        compute: function (criteriaRange, criterion, sumRange = undefined) {
            if (sumRange === undefined) {
                sumRange = criteriaRange;
            }
            let sum = 0;
            visitMatchingRanges([criteriaRange, criterion], (i, j) => {
                const value = sumRange[i][j];
                if (typeof value === "number") {
                    sum += value;
                }
            });
            return sum;
        },
    };
    // -----------------------------------------------------------------------------
    // SUMIFS
    // -----------------------------------------------------------------------------
    const SUMIFS = {
        description: _lt("Sums a range depending on multiple criteria."),
        args: args(`
      sum_range (any, range) ${_lt("The range to sum.")}
      criteria_range1 (any, range) ${_lt("The range to check against criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1.")}
      criteria_range2 (any, range, repeating) ${_lt("Additional ranges to check.")}
      criterion2 (string, repeating) ${_lt("Additional criteria to check.")}
    `),
        returns: ["NUMBER"],
        compute: function (sumRange, ...args) {
            let sum = 0;
            visitMatchingRanges(args, (i, j) => {
                const value = sumRange[i][j];
                if (typeof value === "number") {
                    sum += value;
                }
            });
            return sum;
        },
    };
    // -----------------------------------------------------------------------------
    // TAN
    // -----------------------------------------------------------------------------
    const TAN = {
        description: _lt("Tangent of an angle provided in radians."),
        args: args(`
    angle (number) ${_lt("The angle to find the tangent of, in radians.")}
  `),
        returns: ["NUMBER"],
        compute: function (angle) {
            return Math.tan(toNumber(angle));
        },
    };
    // -----------------------------------------------------------------------------
    // TANH
    // -----------------------------------------------------------------------------
    const TANH = {
        description: _lt("Hyperbolic tangent of any real number."),
        args: args(`
    value (number) ${_lt("Any real value to calculate the hyperbolic tangent of.")}
  `),
        returns: ["NUMBER"],
        compute: function (value) {
            return Math.tanh(toNumber(value));
        },
    };
    // -----------------------------------------------------------------------------
    // TRUNC
    // -----------------------------------------------------------------------------
    const TRUNC = {
        description: _lt("Truncates a number."),
        args: args(`
      value (number) ${_lt("The value to be truncated.")}
      places (number, default=0) ${_lt("The number of significant digits to the right of the decimal point to retain.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value, places = 0) {
            const _value = toNumber(value);
            let _places = toNumber(places);
            if (_places === 0) {
                return Math.trunc(_value);
            }
            if (!Number.isInteger(_places)) {
                _places = Math.trunc(_places);
            }
            return Math.trunc(_value * Math.pow(10, _places)) / Math.pow(10, _places);
        },
    };

    var math = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ACOS: ACOS,
        ACOSH: ACOSH,
        ACOT: ACOT,
        ACOTH: ACOTH,
        ASIN: ASIN,
        ASINH: ASINH,
        ATAN: ATAN,
        ATAN2: ATAN2,
        ATANH: ATANH,
        CEILING: CEILING,
        CEILING_MATH: CEILING_MATH,
        CEILING_PRECISE: CEILING_PRECISE,
        COS: COS,
        COSH: COSH,
        COT: COT,
        COTH: COTH,
        COUNTBLANK: COUNTBLANK,
        COUNTIF: COUNTIF,
        COUNTIFS: COUNTIFS,
        COUNTUNIQUE: COUNTUNIQUE,
        COUNTUNIQUEIFS: COUNTUNIQUEIFS,
        CSC: CSC,
        CSCH: CSCH,
        DECIMAL: DECIMAL,
        DEGREES: DEGREES,
        EXP: EXP,
        FLOOR: FLOOR,
        FLOOR_MATH: FLOOR_MATH,
        FLOOR_PRECISE: FLOOR_PRECISE,
        ISEVEN: ISEVEN,
        ISO_CEILING: ISO_CEILING,
        ISODD: ISODD,
        LN: LN,
        MOD: MOD,
        ODD: ODD,
        PI: PI,
        POWER: POWER,
        PRODUCT: PRODUCT,
        RAND: RAND,
        RANDBETWEEN: RANDBETWEEN,
        ROUND: ROUND,
        ROUNDDOWN: ROUNDDOWN,
        ROUNDUP: ROUNDUP,
        SEC: SEC,
        SECH: SECH,
        SIN: SIN,
        SINH: SINH,
        SQRT: SQRT,
        SUM: SUM,
        SUMIF: SUMIF,
        SUMIFS: SUMIFS,
        TAN: TAN,
        TANH: TANH,
        TRUNC: TRUNC
    });

    const colors = [
        "#ff851b",
        "#0074d9",
        "#ffdc00",
        "#7fdbff",
        "#b10dc9",
        "#0ecc40",
        "#39cccc",
        "#f012be",
        "#3d9970",
        "#111111",
        "#01ff70",
        "#ff4136",
        "#aaaaaa",
        "#85144b",
        "#001f3f",
    ];
    /*
     * transform a color number (R * 256^2 + G * 256 + B) into classic RGB
     * */
    function colorNumberString(color) {
        return color.toString(16).padStart(6, "0");
    }
    let colorIndex = 0;
    function getNextColor() {
        colorIndex = ++colorIndex % colors.length;
        return colors[colorIndex];
    }

    //------------------------------------------------------------------------------
    // Coordinate
    //------------------------------------------------------------------------------
    /**
     * Convert a (col) number to the corresponding letter.
     *
     * Examples:
     *     0 => 'A'
     *     25 => 'Z'
     *     26 => 'AA'
     *     27 => 'AB'
     */
    function numberToLetters(n) {
        if (n < 26) {
            return String.fromCharCode(65 + n);
        }
        else {
            return numberToLetters(Math.floor(n / 26) - 1) + numberToLetters(n % 26);
        }
    }
    /**
     * Convert a string (describing a column) to its number value.
     *
     * Examples:
     *     'A' => 0
     *     'Z' => 25
     *     'AA' => 26
     */
    function lettersToNumber(letters) {
        let result = 0;
        const l = letters.length;
        for (let i = 0; i < l; i++) {
            let n = letters.charCodeAt(i) - 65 + (i < l - 1 ? 1 : 0);
            result += n * 26 ** (l - i - 1);
        }
        return result;
    }
    /**
     * Convert a "XC" coordinate to cartesian coordinates.
     *
     * Examples:
     *   A1 => [0,0]
     *   B3 => [1,2]
     *
     * Note: it also accepts lowercase coordinates, but not fixed references
     */
    function toCartesian(xc) {
        xc = xc.toUpperCase();
        const [m, letters, numbers] = xc.match(/\$?([A-Z]*)\$?([0-9]*)/);
        if (m !== xc) {
            throw new Error(`Invalid cell description: ${xc}`);
        }
        const col = lettersToNumber(letters);
        const row = parseInt(numbers, 10) - 1;
        return [col, row];
    }
    /**
     * Convert from cartesian coordinate to the "XC" coordinate system.
     *
     * Examples:
     *   [0,0] => A1
     *   [1,2] => B3
     *
     * Note: it does not support fixed references
     */
    function toXC(col, row) {
        return numberToLetters(col) + String(row + 1);
    }

    /**
     * Convert from a cartesian reference to a Zone
     *
     * Examples:
     *    "A1" ==> Top 0, Bottom 0, Left: 0, Right: 0
     *    "B1:B3" ==> Top 0, Bottom 3, Left: 1, Right: 1
     *    "Sheet1!A1" ==> Top 0, Bottom 0, Left: 0, Right: 0
     *    "Sheet1!B1:B3" ==> Top 0, Bottom 3, Left: 1, Right: 1
     *
     * @param xc the string reference to convert
     * @param keepBoundaries if true, the boundaries of the range will be kept in the same order as the
     *                       ones in the text: C3:A1 will have a zone {top:2,left:2:bottom:0,right:0} else
     *                       the zone will be inverted {top:0,bottom:2,left:0, bottom:2}
     *
     */
    function toZone(xc, keepBoundaries = false) {
        xc = xc.split("!").pop();
        const ranges = xc.replace(/\$/g, "").split(":");
        let top, bottom, left, right;
        let c = toCartesian(ranges[0].trim());
        left = right = c[0];
        top = bottom = c[1];
        if (ranges.length === 2) {
            let d = toCartesian(ranges[1].trim());
            right = d[0];
            bottom = d[1];
            if (!keepBoundaries) {
                if (right < left) {
                    [right, left] = [left, right];
                }
                if (bottom < top) {
                    [bottom, top] = [top, bottom];
                }
            }
        }
        return { top, bottom, left, right };
    }
    /**
     * Convert from zone to a cartesian reference
     *
     */
    function zoneToXc(zone) {
        const { top, bottom, left, right } = zone;
        const isOneCell = top === bottom && left === right;
        return isOneCell ? toXC(left, top) : `${toXC(left, top)}:${toXC(right, bottom)}`;
    }
    /**
     * Compute the union of two zones. It is the smallest zone which contains the
     * two arguments.
     */
    function union(z1, z2) {
        return {
            top: Math.min(z1.top, z2.top),
            left: Math.min(z1.left, z2.left),
            bottom: Math.max(z1.bottom, z2.bottom),
            right: Math.max(z1.right, z2.right),
        };
    }
    /**
     * Two zones are equal if they represent the same area, so we clearly cannot use
     * reference equality.
     */
    function isEqual(z1, z2) {
        return (z1.left === z2.left && z1.right === z2.right && z1.top === z2.top && z1.bottom === z2.bottom);
    }
    /**
     * Return true if two zones overlap, false otherwise.
     */
    function overlap(z1, z2) {
        if (z1.bottom < z2.top || z2.bottom < z1.top) {
            return false;
        }
        if (z1.right < z2.left || z2.right < z1.left) {
            return false;
        }
        return true;
    }
    function isInside(col, row, zone) {
        const { left, right, top, bottom } = zone;
        return col >= left && col <= right && row >= top && row <= bottom;
    }
    /**
     * Recompute the ranges of the zone to contain all the cells in zones, without the cells in toRemoveZones
     * Also regroup zones together to shorten the string
     * (A1, A2, B1, B2, [C1:C2], C3 => [A1:B2],[C1:C3])
     * To do so, the cells are separated and remerged in zones by columns, and then
     * if possible zones in adjacent columns are merged together.
     */
    function recomputeZones(zones, toRemoveZones) {
        const zonesPerColumn = {};
        //separate the existing zones per column
        for (let z of zones) {
            if (z) {
                const zone = toZone(z);
                for (let col = zone.left; col <= zone.right; col++) {
                    if (zonesPerColumn[col] === undefined) {
                        zonesPerColumn[col] = [];
                    }
                    zonesPerColumn[col].push({
                        top: zone.top,
                        bottom: zone.bottom,
                        remove: false,
                    });
                }
            }
        }
        //separate the to deleted zones per column
        for (let z of toRemoveZones) {
            const zone = toZone(z);
            for (let col = zone.left; col <= zone.right; col++) {
                if (zonesPerColumn[col] === undefined) {
                    zonesPerColumn[col] = [];
                }
                zonesPerColumn[col].push({
                    top: zone.top,
                    bottom: zone.bottom,
                    remove: true,
                });
            }
        }
        const OptimizedZonePerColumn = [];
        //regroup zones per column
        for (let [col, zones] of Object.entries(zonesPerColumn)) {
            OptimizedZonePerColumn.push({
                col: parseInt(col),
                ranges: optimiseColumn(zones),
            });
        }
        //merge zones that spread over multiple columns that can be merged
        const result = mergeColumns(OptimizedZonePerColumn);
        return result.map(zoneToXc);
    }
    /**
     * Recompute the ranges of a column, without the remove cells.
     * takes as input a array of {top, bottom, remove} where top and bottom
     * are the start and end of ranges in the column and remove expresses if the
     * cell should be kept or not.
     */
    function optimiseColumn(zones) {
        const toKeep = new Set();
        const toRemove = new Set();
        for (let zone of zones) {
            for (let x = zone.top; x <= zone.bottom; x++) {
                zone.remove ? toRemove.add(x) : toKeep.add(x);
            }
        }
        const finalElements = [...toKeep]
            .filter((x) => !toRemove.has(x))
            .sort((a, b) => {
            return a - b;
        });
        const newZones = [];
        let currentZone;
        for (let x of finalElements) {
            if (!currentZone) {
                currentZone = { top: x, bottom: x };
            }
            else if (x === currentZone.bottom + 1) {
                currentZone.bottom = x;
            }
            else {
                newZones.push({ top: currentZone.top, bottom: currentZone.bottom });
                currentZone = { top: x, bottom: x };
            }
        }
        if (currentZone) {
            newZones.push({ top: currentZone.top, bottom: currentZone.bottom });
        }
        return newZones;
    }
    /**
     * Verify if ranges in two adjacent columns can be merged in one in one range,
     * and if they can, merge them in the same range.
     */
    function mergeColumns(zonePerCol) {
        const orderedZones = zonePerCol.sort((a, b) => {
            return a.col - b.col;
        });
        const finalZones = [];
        let inProgressZones = [];
        let currentCol = 0;
        for (let index = 0; index <= orderedZones.length - 1; index++) {
            let newInProgress = [];
            if (currentCol + 1 === orderedZones[index].col) {
                for (let z1 of orderedZones[index].ranges) {
                    let merged = false;
                    for (let z2 of inProgressZones) {
                        //extend existing zone with the adjacent col
                        if (z1.top == z2.top && z1.bottom == z2.bottom) {
                            newInProgress.push(z2);
                            merged = true;
                        }
                    }
                    // create new zone as it could not be merged with a previous one
                    if (!merged) {
                        newInProgress.push({ top: z1.top, bottom: z1.bottom, startCol: orderedZones[index].col });
                    }
                }
            }
            else {
                // create new zone as it was not adjacent to the previous zones
                newInProgress = orderedZones[index].ranges.map((zone) => {
                    return {
                        top: zone.top,
                        bottom: zone.bottom,
                        startCol: orderedZones[index].col,
                    };
                });
            }
            //All the zones from inProgressZones that are not transferred in newInprogress
            //are zones that were not extended and are therefore final.
            const difference = inProgressZones.filter((x) => !newInProgress.includes(x));
            for (let x of difference) {
                finalZones.push({ top: x.top, bottom: x.bottom, left: x.startCol, right: currentCol });
            }
            currentCol = orderedZones[index].col;
            inProgressZones = newInProgress;
        }
        //after the last iteration, the unfinished zones need to be finalized to.
        for (let x of inProgressZones) {
            finalZones.push({ top: x.top, bottom: x.bottom, left: x.startCol, right: currentCol });
        }
        return finalZones;
    }
    function mapCellsInZone(zone, sheet, callback, emptyCellValue = undefined, stepX = 1, stepY = 1) {
        const { top, bottom, left, right } = zone;
        const result = new Array(Math.floor((right - left + 1) / stepX));
        for (let c = left; c <= right; c += stepX) {
            let col = new Array(Math.floor((bottom - top + 1) / stepY));
            result[c - left] = col;
            for (let r = top; r <= bottom; r += stepY) {
                let cell = sheet.rows[r].cells[c];
                col[(r - top) / stepY] = cell ? callback(cell) : emptyCellValue;
            }
        }
        return result;
    }
    function zoneToDimension(zone) {
        return {
            height: zone.bottom - zone.top + 1,
            width: zone.right - zone.left + 1,
        };
    }

    /*
     * Contains all method to update ranges with grid_manipulation
     */
    function updateRemoveColumns(range, columns) {
        let { left, right, top, bottom } = toZone(range);
        columns = columns.slice().sort((a, b) => b - a);
        for (let column of columns) {
            if (left > column) {
                left -= 1;
            }
            if (left >= column || right >= column) {
                right -= 1;
            }
        }
        if (left > right) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }
    function updateRemoveRows(range, rows) {
        let { left, right, top, bottom } = toZone(range);
        rows = rows.slice().sort((a, b) => b - a);
        for (let row of rows) {
            if (top > row) {
                top -= 1;
            }
            if (top >= row || bottom >= row) {
                bottom -= 1;
            }
        }
        if (top > bottom) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }
    function updateAddColumns(range, column, step) {
        let { left, right, top, bottom } = toZone(range);
        if (left >= column) {
            left += step;
        }
        if (left >= column || right >= column) {
            right += step;
        }
        if (left > right) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }
    function updateAddRows(range, row, step) {
        let { left, right, top, bottom } = toZone(range);
        if (top >= row) {
            top += step;
        }
        if (top >= row || bottom >= row) {
            bottom += step;
        }
        if (top > bottom) {
            return null;
        }
        return toXC(left, top) + ":" + toXC(right, bottom);
    }

    const fontSizes = [
        { pt: 7.5, px: 10 },
        { pt: 8, px: 11 },
        { pt: 9, px: 12 },
        { pt: 10, px: 13 },
        { pt: 10.5, px: 14 },
        { pt: 11, px: 15 },
        { pt: 12, px: 16 },
        { pt: 14, px: 18.7 },
        { pt: 15, px: 20 },
        { pt: 16, px: 21.3 },
        { pt: 18, px: 24 },
        { pt: 22, px: 29.3 },
        { pt: 24, px: 32 },
        { pt: 26, px: 34.7 },
        { pt: 36, px: 48 },
    ];
    const fontSizeMap = {};
    for (let font of fontSizes) {
        fontSizeMap[font.pt] = font.px;
    }

    //------------------------------------------------------------------------------
    /**
     * Stringify an object, like JSON.stringify, except that the first level of keys
     * is ordered.
     */
    function stringify(obj) {
        return JSON.stringify(obj, Object.keys(obj).sort());
    }
    /**
     * Sanitize the name of a sheet, by eventually removing quotes
     * @param sheetName name of the sheet, potentially quoted with single quotes
     */
    function getUnquotedSheetName(sheetName) {
        if (sheetName.startsWith("'")) {
            sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
        }
        return sheetName;
    }
    /**
     * Add quotes around the sheet name if it contains a space
     * @param sheetName Name of the sheet
     */
    function getComposerSheetName(sheetName) {
        if (sheetName.includes(" ")) {
            sheetName = `'${sheetName}'`;
        }
        return sheetName;
    }
    function clip(val, min, max) {
        return val < min ? min : val > max ? max : val;
    }
    function computeTextWidth(context, text, style) {
        const italic = style.italic ? "italic " : "";
        const weight = style.bold ? "bold" : DEFAULT_FONT_WEIGHT;
        const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
        const size = fontSizeMap[sizeInPt];
        context.font = `${italic}${weight} ${size}px ${DEFAULT_FONT}`;
        return context.measureText(text).width;
    }
    /**
     * Create a range from start (included) to end (excluded)
     * range(10, 13) => [10, 11, 12]
     */
    function range(start, end) {
        if (end <= start) {
            return [];
        }
        const array = Array(end - start);
        for (let i = 0; i < end - start; i++) {
            array[i] = start + i;
        }
        return array;
    }
    /**
     * Groups consecutive numbers.
     * The input array is assumed to be sorted
     * @param numbers
     */
    function groupConsecutive(numbers) {
        return numbers.reduce((groups, currentRow, index, rows) => {
            if (Math.abs(currentRow - rows[index - 1]) === 1) {
                const lastGroup = groups[groups.length - 1];
                lastGroup.push(currentRow);
            }
            else {
                groups.push([currentRow]);
            }
            return groups;
        }, []);
    }
    /**
     * This helper function can be used as a type guard when filtering arrays.
     * const foo: number[] = [1, 2, undefined, 4].filter(isDefined)
     */
    function isDefined$1(argument) {
        return argument !== undefined;
    }
    const DEBUG = {};

    /*
     * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
     * */
    let isFastIdStrategy = false;
    let fastIdStart = 0;
    function setIsFastStrategy(isFast) {
        isFastIdStrategy = isFast;
    }
    function uuidv4() {
        if (isFastIdStrategy) {
            fastIdStart++;
            return String(fastIdStart);
        }
        else if (window.crypto && window.crypto.getRandomValues) {
            //@ts-ignore
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
        }
        else {
            // mainly for jest and other browsers that do not have the crypto functionality
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                var r = (Math.random() * 16) | 0, v = c == "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }
    }

    // Note: dataY and dataX may not have the same dimension
    function covariance(dataY, dataX, isSample) {
        let flatDataY = [];
        let flatDataX = [];
        let lenY = 0;
        let lenX = 0;
        visitAny(dataY, (y) => {
            flatDataY.push(y);
            lenY += 1;
        });
        visitAny(dataX, (x) => {
            flatDataX.push(x);
            lenX += 1;
        });
        if (lenY !== lenX) {
            throw new Error(_lt("[[FUNCTION_NAME]] has mismatched argument count %s vs %s.", lenY.toString(), lenX.toString()));
        }
        let count = 0;
        let sumY = 0;
        let sumX = 0;
        for (let i = 0; i < lenY; i++) {
            const valueY = flatDataY[i];
            const valueX = flatDataX[i];
            if (typeof valueY === "number" && typeof valueX === "number") {
                count += 1;
                sumY += valueY;
                sumX += valueX;
            }
        }
        if (count === 0 || (isSample && count === 1)) {
            throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
        }
        const averageY = sumY / count;
        const averageX = sumX / count;
        let acc = 0;
        for (let i = 0; i < lenY; i++) {
            const valueY = flatDataY[i];
            const valueX = flatDataX[i];
            if (typeof valueY === "number" && typeof valueX === "number") {
                acc += (valueY - averageY) * (valueX - averageX);
            }
        }
        return acc / (count - (isSample ? 1 : 0));
    }
    function variance(args, isSample, textAs0) {
        let count = 0;
        let sum = 0;
        const reduceFuction = textAs0 ? reduceNumbersTextAs0 : reduceNumbers;
        sum = reduceFuction(args, (acc, a) => {
            count += 1;
            return acc + a;
        }, 0);
        if (count === 0 || (isSample && count === 1)) {
            throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
        }
        const average = sum / count;
        return (reduceFuction(args, (acc, a) => acc + Math.pow(a - average, 2), 0) /
            (count - (isSample ? 1 : 0)));
    }
    function centile(data, percent, isInclusive) {
        const _percent = toNumber(percent);
        if (_percent < 0 || 1 < _percent || (!isInclusive && (_percent === 0 || _percent === 1))) {
            throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value is out of range.`));
        }
        let sortedArray = [];
        let index;
        let count = 0;
        visitAny(data, (d) => {
            if (typeof d === "number") {
                index = dichotomicPredecessorSearch(sortedArray, d);
                sortedArray.splice(index + 1, 0, d);
                count++;
            }
        });
        if (count === 0) {
            throw new Error(_lt(`[[FUNCTION_NAME]] has no valid input data.`));
        }
        let percentIndex = (count + (isInclusive ? -1 : 1)) * _percent;
        if (!isInclusive) {
            if (percentIndex < 1 || count < percentIndex) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value is out of range.`));
            }
            percentIndex--;
        }
        if (Number.isInteger(percentIndex)) {
            return sortedArray[percentIndex];
        }
        const indexSup = Math.ceil(percentIndex);
        const indexLow = Math.floor(percentIndex);
        return (sortedArray[indexSup] * (percentIndex - indexLow) +
            sortedArray[indexLow] * (indexSup - percentIndex));
    }
    // -----------------------------------------------------------------------------
    // AVEDEV
    // -----------------------------------------------------------------------------
    const AVEDEV = {
        description: _lt("Average magnitude of deviations from mean."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            const sum = reduceNumbers(arguments, (acc, a) => {
                count += 1;
                return acc + a;
            }, 0);
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            const average = sum / count;
            return reduceNumbers(arguments, (acc, a) => acc + Math.abs(average - a), 0) / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGE
    // -----------------------------------------------------------------------------
    const AVERAGE = {
        description: _lt(`Numerical average value in a dataset, ignoring text.`),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the average value.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to consider when calculating the average value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let count = 0;
            const sum = reduceNumbers(arguments, (acc, a) => {
                count += 1;
                return acc + a;
            }, 0);
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGE.WEIGHTED
    // -----------------------------------------------------------------------------
    const rangeError = _lt(`[[FUNCTION_NAME]] has mismatched range sizes.`);
    const negativeWeightError = _lt(`[[FUNCTION_NAME]] expects the weight to be positive or equal to 0.`);
    const AVERAGE_WEIGHTED = {
        description: _lt(`Weighted average.`),
        args: args(`
      values (number, range<number>) ${_lt("Values to average.")}
      weights (number, range<number>) ${_lt("Weights for each corresponding value.")}
      additional_values (number, range<number>, repeating) ${_lt("Additional values to average.")}
      additional_weights (number, range<number>, repeating) ${_lt("Additional weights.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let sum = 0;
            let count = 0;
            let value;
            let weight;
            if (arguments.length % 2 === 1) {
                throw new Error(_lt(`Wrong number of arguments. Expected an even number of arguments.`));
            }
            for (let n = 0; n < arguments.length - 1; n += 2) {
                value = arguments[n];
                weight = arguments[n + 1];
                // if (typeof value != typeof weight) {
                //   throw new Error(rangeError);
                // }
                if (Array.isArray(value)) {
                    if (!Array.isArray(weight)) {
                        throw new Error(rangeError);
                    }
                    let dimColValue = value.length;
                    let dimLinValue = value[0].length;
                    if (dimColValue !== weight.length || dimLinValue != weight[0].length) {
                        throw new Error(rangeError);
                    }
                    for (let i = 0; i < dimColValue; i++) {
                        for (let j = 0; j < dimLinValue; j++) {
                            let subValue = value[i][j];
                            let subWeight = weight[i][j];
                            let subValueIsNumber = typeof subValue === "number";
                            let subWeightIsNumber = typeof subWeight === "number";
                            // typeof subValue or subWeight can be 'number' or 'undefined'
                            if (subValueIsNumber !== subWeightIsNumber) {
                                throw new Error(_lt(`[[FUNCTION_NAME]] expects number values.`));
                            }
                            if (subWeightIsNumber) {
                                if (subWeight < 0) {
                                    throw new Error(negativeWeightError);
                                }
                                sum += subValue * subWeight;
                                count += subWeight;
                            }
                        }
                    }
                }
                else {
                    weight = toNumber(weight);
                    value = toNumber(value);
                    if (weight < 0) {
                        throw new Error(negativeWeightError);
                    }
                    sum += value * weight;
                    count += weight;
                }
            }
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGEA
    // -----------------------------------------------------------------------------
    const AVERAGEA = {
        description: _lt(`Numerical average value in a dataset.`),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the average value.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to consider when calculating the average value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let count = 0;
            const sum = reduceNumbersTextAs0(arguments, (acc, a) => {
                count += 1;
                return acc + a;
            }, 0);
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGEIF
    // -----------------------------------------------------------------------------
    const AVERAGEIF = {
        description: _lt(`Average of values depending on criteria.`),
        args: args(`
      criteria_range (any, range) ${_lt("The range to check against criterion.")}
      criterion (string) ${_lt("The pattern or test to apply to criteria_range.")}
      average_range (any, range, default=${_lt("criteria_range")}) ${_lt("The range to average. If not included, criteria_range is used for the average instead.")}
    `),
        returns: ["NUMBER"],
        compute: function (criteriaRange, criterion, averageRange = undefined) {
            if (averageRange === undefined) {
                averageRange = criteriaRange;
            }
            let count = 0;
            let sum = 0;
            visitMatchingRanges([criteriaRange, criterion], (i, j) => {
                const value = averageRange[i][j];
                if (typeof value === "number") {
                    count += 1;
                    sum += value;
                }
            });
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // AVERAGEIFS
    // -----------------------------------------------------------------------------
    const AVERAGEIFS = {
        description: _lt(`Average of values depending on multiple criteria.`),
        args: args(`
      average_range (any, range) ${_lt("The range to average.")}
      criteria_range1 (any, range) ${_lt("The range to check against criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1.")}
      criteria_range2 (any, range, repeating) ${_lt("Additional ranges to check.")}
      criterion2 (string, repeating) ${_lt("Additional criteria to check.")}
    `),
        returns: ["NUMBER"],
        compute: function (averageRange, ...args) {
            let count = 0;
            let sum = 0;
            visitMatchingRanges(args, (i, j) => {
                const value = averageRange[i][j];
                if (typeof value === "number") {
                    count += 1;
                    sum += value;
                }
            });
            if (count === 0) {
                throw new Error(_lt(`Evaluation of function [[FUNCTION_NAME]] caused a divide by zero error.`));
            }
            return sum / count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNT
    // -----------------------------------------------------------------------------
    const COUNT = {
        description: _lt(`The number of numeric values in dataset.`),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range to consider when counting.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to consider when counting.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            let count = 0;
            for (let n of arguments) {
                if (Array.isArray(n)) {
                    for (let i of n) {
                        for (let j of i) {
                            if (typeof j === "number") {
                                count += 1;
                            }
                        }
                    }
                }
                else if (typeof n !== "string" || isNumber(n)) {
                    count += 1;
                }
            }
            return count;
        },
    };
    // -----------------------------------------------------------------------------
    // COUNTA
    // -----------------------------------------------------------------------------
    const COUNTA = {
        description: _lt(`The number of values in a dataset.`),
        args: args(`
    value1 (any, range) ${_lt("The first value or range to consider when counting.")}
    value2 (any, range, repeating) ${_lt("Additional values or ranges to consider when counting.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => (a !== undefined && a !== null ? acc + 1 : acc), 0);
        },
    };
    // -----------------------------------------------------------------------------
    // COVAR
    // -----------------------------------------------------------------------------
    // Note: Unlike the VAR function which corresponds to the variance over a sample (VAR.S),
    // the COVAR function corresponds to the covariance over an entire population (COVAR.P)
    const COVAR = {
        description: _lt(`The covariance of a dataset.`),
        args: args(`
    data_y (any, range) ${_lt("The range representing the array or matrix of dependent data.")}
    data_x (any, range) ${_lt("The range representing the array or matrix of independent data.")}
  `),
        returns: ["NUMBER"],
        compute: function (dataY, dataX) {
            return covariance(dataY, dataX, false);
        },
    };
    // -----------------------------------------------------------------------------
    // COVARIANCE.P
    // -----------------------------------------------------------------------------
    const COVARIANCE_P = {
        description: _lt(`The covariance of a dataset.`),
        args: args(`
    data_y (any, range) ${_lt("The range representing the array or matrix of dependent data.")}
    data_x (any, range) ${_lt("The range representing the array or matrix of independent data.")}
  `),
        returns: ["NUMBER"],
        compute: function (dataY, dataX) {
            return covariance(dataY, dataX, false);
        },
    };
    // -----------------------------------------------------------------------------
    // COVARIANCE.S
    // -----------------------------------------------------------------------------
    const COVARIANCE_S = {
        description: _lt(`The sample covariance of a dataset.`),
        args: args(`
    data_y (any, range) ${_lt("The range representing the array or matrix of dependent data.")}
    data_x (any, range) ${_lt("The range representing the array or matrix of independent data.")}
  `),
        returns: ["NUMBER"],
        compute: function (dataY, dataX) {
            return covariance(dataY, dataX, true);
        },
    };
    // -----------------------------------------------------------------------------
    // LARGE
    // -----------------------------------------------------------------------------
    const LARGE = {
        description: _lt("Nth largest element from a data set."),
        args: args(`
      data (any, range) ${_lt("Array or range containing the dataset to consider.")}
      n (number) ${_lt("The rank from largest to smallest of the element to return.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, n) {
            n = Math.trunc(toNumber(n));
            let largests = [];
            let index;
            let count = 0;
            visitAny(data, (d) => {
                if (typeof d === "number") {
                    index = dichotomicPredecessorSearch(largests, d);
                    largests.splice(index + 1, 0, d);
                    count++;
                    if (count > n) {
                        largests.shift();
                        count--;
                    }
                }
            });
            const result = largests.shift();
            if (result === undefined) {
                throw new Error(_lt(`[[FUNCTION_NAME]] has no valid input data.`));
            }
            if (count < n) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value %s is out of range.", n.toString()));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // MAX
    // -----------------------------------------------------------------------------
    const MAX = {
        description: _lt("Maximum value in a numeric dataset."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the maximum value.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to consider when calculating the maximum value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            const result = reduceNumbers(arguments, (acc, a) => (acc < a ? a : acc), -Infinity);
            return result === -Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // MAXA
    // -----------------------------------------------------------------------------
    const MAXA = {
        description: _lt("Maximum numeric value in a dataset."),
        args: args(`
      value1 (any, range) ${_lt("The first value or range to consider when calculating the maximum value.")}
      value2 (ant, range, repeating) ${_lt("Additional values or ranges to consider when calculating the maximum value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let maxa = -Infinity;
            for (let n of arguments) {
                if (Array.isArray(n)) {
                    for (let i of n) {
                        for (let j of i) {
                            if (j != undefined) {
                                j = typeof j === "number" ? j : 0;
                                if (maxa < j) {
                                    maxa = j;
                                }
                            }
                        }
                    }
                }
                else {
                    n = toNumber(n);
                    if (maxa < n) {
                        maxa = n;
                    }
                }
            }
            return maxa === -Infinity ? 0 : maxa;
        },
    };
    // -----------------------------------------------------------------------------
    // MAXIFS
    // -----------------------------------------------------------------------------
    const MAXIFS = {
        description: _lt("Returns the maximum value in a range of cells, filtered by a set of criteria."),
        args: args(`
      range (any, range) ${_lt("The range of cells from which the maximum will be determined.")}
      criteria_range1 (any, range) ${_lt("The range of cells over which to evaluate criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.")}
      criteria_range2 (any, range, repeating) ${_lt("Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.")}
      criterion2 (string, repeating) ${_lt("The pattern or test to apply to criteria_range2.")}
    `),
        returns: ["NUMBER"],
        compute: function (range, ...args) {
            let result = -Infinity;
            visitMatchingRanges(args, (i, j) => {
                const value = range[i][j];
                if (typeof value === "number") {
                    result = result < value ? value : result;
                }
            });
            return result === -Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // MEDIAN
    // -----------------------------------------------------------------------------
    const MEDIAN = {
        description: _lt("Median value in a numeric dataset."),
        args: args(`
      value1 (any, range) ${_lt("The first value or range to consider when calculating the median value.")}
      value2 (any, range, repeating) ${_lt("Additional values or ranges to consider when calculating the median value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let data = [];
            visitNumbers(arguments, (arg) => {
                data.push(arg);
            });
            return centile([data], 0.5, true);
        },
    };
    // -----------------------------------------------------------------------------
    // MIN
    // -----------------------------------------------------------------------------
    const MIN = {
        description: _lt("Minimum value in a numeric dataset."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the minimum value.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to consider when calculating the minimum value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            const result = reduceNumbers(arguments, (acc, a) => (a < acc ? a : acc), Infinity);
            return result === Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // MINA
    // -----------------------------------------------------------------------------
    const MINA = {
        description: _lt("Minimum numeric value in a dataset."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range to consider when calculating the minimum value.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to consider when calculating the minimum value.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function () {
            let mina = Infinity;
            for (let n of arguments) {
                if (Array.isArray(n)) {
                    for (let i of n) {
                        for (let j of i) {
                            if (j != undefined) {
                                j = typeof j === "number" ? j : 0;
                                if (j < mina) {
                                    mina = j;
                                }
                            }
                        }
                    }
                }
                else {
                    n = toNumber(n);
                    if (n < mina) {
                        mina = n;
                    }
                }
            }
            return mina === Infinity ? 0 : mina;
        },
    };
    // -----------------------------------------------------------------------------
    // MINIFS
    // -----------------------------------------------------------------------------
    const MINIFS = {
        description: _lt("Returns the minimum value in a range of cells, filtered by a set of criteria."),
        args: args(`
      range (any, range) ${_lt("The range of cells from which the minimum will be determined.")}
      criteria_range1 (any, range) ${_lt("The range of cells over which to evaluate criterion1.")}
      criterion1 (string) ${_lt("The pattern or test to apply to criteria_range1, such that each cell that evaluates to TRUE will be included in the filtered set.")}
      criteria_range2 (any, range, repeating) ${_lt("Additional ranges over which to evaluate the additional criteria. The filtered set will be the intersection of the sets produced by each criterion-range pair.")}
      criterion2 (string, repeating) ${_lt("The pattern or test to apply to criteria_range2.")}
    `),
        returns: ["NUMBER"],
        compute: function (range, ...args) {
            let result = Infinity;
            visitMatchingRanges(args, (i, j) => {
                const value = range[i][j];
                if (typeof value === "number") {
                    result = result > value ? value : result;
                }
            });
            return result === Infinity ? 0 : result;
        },
    };
    // -----------------------------------------------------------------------------
    // PERCENTILE
    // -----------------------------------------------------------------------------
    const PERCENTILE = {
        description: _lt("Value at a given percentile of a dataset."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      percentile (number) ${_lt("The percentile whose value within data will be calculated and returned.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, percentile) {
            return PERCENTILE_INC.compute(data, percentile);
        },
    };
    // -----------------------------------------------------------------------------
    // PERCENTILE.EXC
    // -----------------------------------------------------------------------------
    const PERCENTILE_EXC = {
        description: _lt("Value at a given percentile of a dataset exclusive of 0 and 1."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      percentile (number) ${_lt("The percentile, exclusive of 0 and 1, whose value within 'data' will be calculated and returned.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, percentile) {
            return centile(data, percentile, false);
        },
    };
    // -----------------------------------------------------------------------------
    // PERCENTILE.INC
    // -----------------------------------------------------------------------------
    const PERCENTILE_INC = {
        description: _lt("Value at a given percentile of a dataset."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      percentile (number) ${_lt("The percentile whose value within data will be calculated and returned.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, percentile) {
            return centile(data, percentile, true);
        },
    };
    // -----------------------------------------------------------------------------
    // QUARTILE
    // -----------------------------------------------------------------------------
    const QUARTILE = {
        description: _lt("Value nearest to a specific quartile of a dataset."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      quartile_number (number) ${_lt("Which quartile value to return.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, quartileNumber) {
            return QUARTILE_INC.compute(data, quartileNumber);
        },
    };
    // -----------------------------------------------------------------------------
    // QUARTILE.EXC
    // -----------------------------------------------------------------------------
    const QUARTILE_EXC = {
        description: _lt("Value nearest to a specific quartile of a dataset exclusive of 0 and 4."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      quartile_number (number) ${_lt("Which quartile value, exclusive of 0 and 4, to return.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, quartileNumber) {
            const _quartileNumber = Math.trunc(toNumber(quartileNumber));
            return centile(data, 0.25 * _quartileNumber, false);
        },
    };
    // -----------------------------------------------------------------------------
    // QUARTILE.INC
    // -----------------------------------------------------------------------------
    const QUARTILE_INC = {
        description: _lt("Value nearest to a specific quartile of a dataset."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      quartile_number (number) ${_lt("Which quartile value to return.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, quartileNumber) {
            const _quartileNumber = Math.trunc(toNumber(quartileNumber));
            return centile(data, 0.25 * _quartileNumber, true);
        },
    };
    // -----------------------------------------------------------------------------
    // SMALL
    // -----------------------------------------------------------------------------
    const SMALL = {
        description: _lt("Nth smallest element in a data set."),
        args: args(`
      data (any, range) ${_lt("The array or range containing the dataset to consider.")}
      n (number) ${_lt("The rank from smallest to largest of the element to return.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (data, n) {
            n = Math.trunc(toNumber(n));
            let largests = [];
            let index;
            let count = 0;
            visitAny(data, (d) => {
                if (typeof d === "number") {
                    index = dichotomicPredecessorSearch(largests, d);
                    largests.splice(index + 1, 0, d);
                    count++;
                    if (count > n) {
                        largests.pop();
                        count--;
                    }
                }
            });
            const result = largests.pop();
            if (result === undefined) {
                throw new Error(_lt(`[[FUNCTION_NAME]] has no valid input data.`));
            }
            if (count < n) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value %s is out of range.", n.toString()));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // STDEV
    // -----------------------------------------------------------------------------
    const STDEV = {
        description: _lt("Standard deviation."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VAR.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEV.P
    // -----------------------------------------------------------------------------
    const STDEV_P = {
        description: _lt("Standard deviation of entire population."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the population.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the population.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VAR_P.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEV.S
    // -----------------------------------------------------------------------------
    const STDEV_S = {
        description: _lt("Standard deviation."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VAR_S.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEVA
    // -----------------------------------------------------------------------------
    const STDEVA = {
        description: _lt("Standard deviation of sample (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VARA.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEVP
    // -----------------------------------------------------------------------------
    const STDEVP = {
        description: _lt("Standard deviation of entire population."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VARP.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // STDEVPA
    // -----------------------------------------------------------------------------
    const STDEVPA = {
        description: _lt("Standard deviation of entire population (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return Math.sqrt(VARPA.compute(...arguments));
        },
    };
    // -----------------------------------------------------------------------------
    // VAR
    // -----------------------------------------------------------------------------
    const VAR = {
        description: _lt("Variance."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, true, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VAR.P
    // -----------------------------------------------------------------------------
    const VAR_P = {
        description: _lt("Variance of entire population."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the population.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the population.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, false, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VAR.S
    // -----------------------------------------------------------------------------
    const VAR_S = {
        description: _lt("Variance."),
        args: args(`
      value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
      value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
    `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, true, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VARA
    // -----------------------------------------------------------------------------
    const VARA = {
        description: _lt("Variance of sample (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the sample.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the sample.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, true, true);
        },
    };
    // -----------------------------------------------------------------------------
    // VARP
    // -----------------------------------------------------------------------------
    const VARP = {
        description: _lt("Variance of entire population."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, false, false);
        },
    };
    // -----------------------------------------------------------------------------
    // VARPA
    // -----------------------------------------------------------------------------
    const VARPA = {
        description: _lt("Variance of entire population (text as 0)."),
        args: args(`
    value1 (number, range<number>) ${_lt("The first value or range of the population.")}
    value2 (number, range<number>, repeating) ${_lt("Additional values or ranges to include in the population.")}
  `),
        returns: ["NUMBER"],
        compute: function () {
            return variance(arguments, false, true);
        },
    };

    var statistical = /*#__PURE__*/Object.freeze({
        __proto__: null,
        AVEDEV: AVEDEV,
        AVERAGE: AVERAGE,
        AVERAGE_WEIGHTED: AVERAGE_WEIGHTED,
        AVERAGEA: AVERAGEA,
        AVERAGEIF: AVERAGEIF,
        AVERAGEIFS: AVERAGEIFS,
        COUNT: COUNT,
        COUNTA: COUNTA,
        COVAR: COVAR,
        COVARIANCE_P: COVARIANCE_P,
        COVARIANCE_S: COVARIANCE_S,
        LARGE: LARGE,
        MAX: MAX,
        MAXA: MAXA,
        MAXIFS: MAXIFS,
        MEDIAN: MEDIAN,
        MIN: MIN,
        MINA: MINA,
        MINIFS: MINIFS,
        PERCENTILE: PERCENTILE,
        PERCENTILE_EXC: PERCENTILE_EXC,
        PERCENTILE_INC: PERCENTILE_INC,
        QUARTILE: QUARTILE,
        QUARTILE_EXC: QUARTILE_EXC,
        QUARTILE_INC: QUARTILE_INC,
        SMALL: SMALL,
        STDEV: STDEV,
        STDEV_P: STDEV_P,
        STDEV_S: STDEV_S,
        STDEVA: STDEVA,
        STDEVP: STDEVP,
        STDEVPA: STDEVPA,
        VAR: VAR,
        VAR_P: VAR_P,
        VAR_S: VAR_S,
        VARA: VARA,
        VARP: VARP,
        VARPA: VARPA
    });

    function getMatchingCells(database, field, criteria) {
        // Exemple :
        //
        // # DATABASE             # CRITERIA          # field = "C"
        //
        // | A | B | C |          | A | C |
        // |===========|          |=======|
        // | 1 | x | j |          |<2 | j |
        // | 1 | Z | k |          |   | 7 |
        // | 5 | y | 7 |
        // 1 - Select coordinates of database columns
        const indexColNameDB = new Map();
        const dimRowDB = database.length;
        for (let indexCol = dimRowDB - 1; indexCol >= 0; indexCol--) {
            indexColNameDB.set(toString(database[indexCol][0]).toUpperCase(), indexCol);
        } // Ex: indexColNameDB = {A => 0, B => 1, C => 2}
        // 2 - Check if the field parameter exists in the column names of the database
        const typeofField = typeof field;
        let index;
        if (typeofField === "number") {
            // field may either be a text label corresponding to a column header in the
            // first row of database or a numeric index indicating which column to consider,
            // where the first column has the value 1.
            index = Math.trunc(field) - 1;
            if (index < 0 || index > dimRowDB - 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value is %s. Valid values are between 1 and %s inclusive.", field, dimRowDB));
            }
        }
        else {
            const colName = typeofField === "string" ? field.toUpperCase() : field;
            index = indexColNameDB.get(colName);
            if (index === undefined) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value is %s. It should be one of: %s.", field, [...indexColNameDB.keys()].map((v) => "'" + v + "'").join(", ")));
            }
        } // Ex: index = 2
        // 3 - For each criteria row, find database row that correspond
        const dimColCriteria = criteria[0].length;
        if (dimColCriteria < 2) {
            throw new Error(_lt(`[[FUNCTION_NAME]] criteria range must be at least 2 rows.`));
        }
        let matchingRows = new Set();
        const dimColDB = database[0].length;
        for (let indexRow = 1; indexRow < dimColCriteria; indexRow++) {
            let args = [];
            let existColNameDB = true;
            for (let indexCol = 0; indexCol < criteria.length; indexCol++) {
                const curentName = toString(criteria[indexCol][0]).toUpperCase();
                const indexColDB = indexColNameDB.get(curentName);
                const criter = criteria[indexCol][indexRow];
                if (criter !== undefined) {
                    if (indexColDB !== undefined) {
                        args.push([database[indexColDB].slice(1, dimColDB)]);
                        args.push(criter);
                    }
                    else {
                        existColNameDB = false;
                        break;
                    }
                }
            }
            // Ex: args1 = [[1,1,5], "<2", ["j","k",7], "j"]
            // Ex: args2 = [["j","k",7], "7"]
            if (existColNameDB) {
                if (args.length > 0) {
                    visitMatchingRanges(args, (i, j) => {
                        matchingRows.add(j);
                    }, true);
                }
                else {
                    // return indices of each database row when a criteria table row is void
                    matchingRows = new Set(Array(dimColDB - 1).keys());
                    break;
                }
            }
        } // Ex: matchingRows = {0, 2}
        // 4 - return for each database row corresponding, the cells corresponding to
        // the field parameter
        const fieldCol = database[index];
        // Ex: fieldCol = ["C", "j", "k", 7]
        const matchingCells = [...matchingRows].map((x) => fieldCol[x + 1]);
        // Ex: matchingCells = ["j", 7]
        return matchingCells;
    }
    const databaseArgs = args(`
  database (array) ${_lt("The array or range containing the data to consider, structured in such a way that the first row contains the labels for each column's values.")}
  field (any) ${_lt("Indicates which column in database contains the values to be extracted and operated on.")}
  criteria (array) ${_lt("An array or range containing zero or more criteria to filter the database values by before operating.")}
`);
    // -----------------------------------------------------------------------------
    // DAVERAGE
    // -----------------------------------------------------------------------------
    const DAVERAGE = {
        description: _lt("Average of a set of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return AVERAGE.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DCOUNT
    // -----------------------------------------------------------------------------
    const DCOUNT = {
        description: _lt("Counts values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return COUNT.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DCOUNTA
    // -----------------------------------------------------------------------------
    const DCOUNTA = {
        description: _lt("Counts values and text from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return COUNTA.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DGET
    // -----------------------------------------------------------------------------
    const DGET = {
        description: _lt("Single value from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            if (cells.length > 1) {
                throw new Error(_lt(`More than one match found in DGET evaluation.`));
            }
            return cells[0];
        },
    };
    // -----------------------------------------------------------------------------
    // DMAX
    // -----------------------------------------------------------------------------
    const DMAX = {
        description: _lt("Maximum of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return MAX.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DMIN
    // -----------------------------------------------------------------------------
    const DMIN = {
        description: _lt("Minimum of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return MIN.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DPRODUCT
    // -----------------------------------------------------------------------------
    const DPRODUCT = {
        description: _lt("Product of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return PRODUCT.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DSTDEV
    // -----------------------------------------------------------------------------
    const DSTDEV = {
        description: _lt("Standard deviation of population sample from table."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return STDEV.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DSTDEVP
    // -----------------------------------------------------------------------------
    const DSTDEVP = {
        description: _lt("Standard deviation of entire population from table."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return STDEVP.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DSUM
    // -----------------------------------------------------------------------------
    const DSUM = {
        description: _lt("Sum of values from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return SUM.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DVAR
    // -----------------------------------------------------------------------------
    const DVAR = {
        description: _lt("Variance of population sample from table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return VAR.compute([cells]);
        },
    };
    // -----------------------------------------------------------------------------
    // DVARP
    // -----------------------------------------------------------------------------
    const DVARP = {
        description: _lt("Variance of a population from a table-like range."),
        args: databaseArgs,
        returns: ["NUMBER"],
        compute: function (database, field, criteria) {
            const cells = getMatchingCells(database, field, criteria);
            return VARP.compute([cells]);
        },
    };

    var database = /*#__PURE__*/Object.freeze({
        __proto__: null,
        DAVERAGE: DAVERAGE,
        DCOUNT: DCOUNT,
        DCOUNTA: DCOUNTA,
        DGET: DGET,
        DMAX: DMAX,
        DMIN: DMIN,
        DPRODUCT: DPRODUCT,
        DSTDEV: DSTDEV,
        DSTDEVP: DSTDEVP,
        DSUM: DSUM,
        DVAR: DVAR,
        DVARP: DVARP
    });

    const INITIAL_1900_DAY$1 = new Date(1899, 11, 30);
    // -----------------------------------------------------------------------------
    // DATE
    // -----------------------------------------------------------------------------
    const DATE = {
        description: _lt("Converts year/month/day into a date."),
        args: args(`
    year (number) ${_lt("The year component of the date.")}")}
    month (number) ${_lt("The month component of the date.")}")}
    day (number) ${_lt("The day component of the date.")}")}
    `),
        returns: ["DATE"],
        returnFormat: { specificFormat: "m/d/yyyy" },
        compute: function (year, month, day) {
            let _year = Math.trunc(toNumber(year));
            const _month = Math.trunc(toNumber(month));
            const _day = Math.trunc(toNumber(day));
            // For years less than 0 or greater than 10000, return #ERROR.
            if (_year < 0 || 10000 <= _year) {
                throw new Error(_lt(`function [[FUNCTION_NAME]] parameter year should be greater or equal to 0 and lesser than 10000.`));
            }
            // Between 0 and 1899, we add that value to 1900 to calculate the year
            if (_year < 1900) {
                _year += 1900;
            }
            const jsDate = new Date(_year, _month - 1, _day);
            const delta = jsDate.getTime() - INITIAL_1900_DAY$1.getTime();
            if (delta < 0) {
                throw new Error(_lt(`function [[FUNCTION_NAME]] result should not be lesser than 01/01/1900`));
            }
            return Math.round(delta / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // DATEVALUE
    // -----------------------------------------------------------------------------
    const DATEVALUE = {
        description: _lt("Converts a date string to a date value."),
        args: args(`
      date_string (string) ${_lt("The string representing the date.")}
    `),
        returns: ["NUMBER"],
        compute: function (dateString) {
            const _dateString = toString(dateString);
            const internalDate = parseDateTime(_dateString);
            if (internalDate === null) {
                throw new Error(_lt("[[FUNCTION_NAME]] parameter '%s' cannot be parsed to date/time.", _dateString));
            }
            return Math.trunc(internalDate.value);
        },
    };
    // -----------------------------------------------------------------------------
    // DAY
    // -----------------------------------------------------------------------------
    const DAY = {
        description: _lt("Day of the month that a specific date falls on."),
        args: args(`
      date (string) ${_lt("The date from which to extract the day.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toJsDate(date).getDate();
        },
    };
    // -----------------------------------------------------------------------------
    // DAYS
    // -----------------------------------------------------------------------------
    const DAYS = {
        description: _lt("Number of days between two dates."),
        args: args(`
      end_date (date) ${_lt("The end of the date range.")}
      start_date (date) ${_lt("The start of the date range.")}
    `),
        returns: ["NUMBER"],
        compute: function (endDate, startDate) {
            const _endDate = toJsDate(endDate);
            const _startDate = toJsDate(startDate);
            const dateDif = _endDate.getTime() - _startDate.getTime();
            return Math.round(dateDif / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // EDATE
    // -----------------------------------------------------------------------------
    const EDATE = {
        description: _lt("Date a number of months before/after another date."),
        args: args(`
    start_date (date) ${_lt("The date from which to calculate the result.")}
    months (number) ${_lt("The number of months before (negative) or after (positive) 'start_date' to calculate.")}
    `),
        returns: ["DATE"],
        returnFormat: { specificFormat: "m/d/yyyy" },
        compute: function (startDate, months) {
            const _startDate = toJsDate(startDate);
            const _months = Math.trunc(toNumber(months));
            const yStart = _startDate.getFullYear();
            const mStart = _startDate.getMonth();
            const dStart = _startDate.getDate();
            const jsDate = new Date(yStart, mStart + _months, dStart);
            const delta = jsDate.getTime() - INITIAL_1900_DAY$1.getTime();
            return Math.round(delta / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // EOMONTH
    // -----------------------------------------------------------------------------
    const EOMONTH = {
        description: _lt("Last day of a month before or after a date."),
        args: args(`
    start_date (date) ${_lt("The date from which to calculate the result.")}
    months (number) ${_lt("The number of months before (negative) or after (positive) 'start_date' to consider.")}
    `),
        returns: ["DATE"],
        returnFormat: { specificFormat: "m/d/yyyy" },
        compute: function (startDate, months) {
            const _startDate = toJsDate(startDate);
            const _months = Math.trunc(toNumber(months));
            const yStart = _startDate.getFullYear();
            const mStart = _startDate.getMonth();
            const jsDate = new Date(yStart, mStart + _months + 1, 0);
            const delta = jsDate.getTime() - INITIAL_1900_DAY$1.getTime();
            return Math.round(delta / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // HOUR
    // -----------------------------------------------------------------------------
    const HOUR = {
        description: _lt("Hour component of a specific time."),
        args: args(`
    time (date) ${_lt("The time from which to calculate the hour component.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toJsDate(date).getHours();
        },
    };
    // -----------------------------------------------------------------------------
    // ISOWEEKNUM
    // -----------------------------------------------------------------------------
    const ISOWEEKNUM = {
        description: _lt("ISO week number of the year."),
        args: args(`
    date (date) ${_lt("The date for which to determine the ISO week number. Must be a reference to a cell containing a date, a function returning a date type, or a number.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            const _date = toJsDate(date);
            const y = _date.getFullYear();
            // 1 - As the 1st week of a year can start the previous year or after the 1st
            // january we first look if the date is in the weeks of the current year, previous
            // year or year after.
            // A - We look for the current year, the first days of the first week
            // and the last days of the last week
            // The first week of the year is the week that contains the first
            // Thursday of the year.
            let firstThursday = 1;
            while (new Date(y, 0, firstThursday).getDay() !== 4) {
                firstThursday += 1;
            }
            const firstDayOfFirstWeek = new Date(y, 0, firstThursday - 3);
            // The last week of the year is the week that contains the last Thursday of
            // the year.
            let lastThursday = 31;
            while (new Date(y, 11, lastThursday).getDay() !== 4) {
                lastThursday -= 1;
            }
            const lastDayOfLastWeek = new Date(y, 11, lastThursday + 3);
            // B - If our date > lastDayOfLastWeek then it's in the weeks of the year after
            // If our date < firstDayOfFirstWeek then it's in the weeks of the year before
            let offsetYear;
            if (firstDayOfFirstWeek.getTime() <= _date.getTime()) {
                if (_date.getTime() <= lastDayOfLastWeek.getTime()) {
                    offsetYear = 0;
                }
                else {
                    offsetYear = 1;
                }
            }
            else {
                offsetYear = -1;
            }
            // 2 - now that the year is known, we are looking at the difference between
            // the first day of this year and the date. The difference in days divided by
            // 7 gives us the week number
            let firstDay;
            switch (offsetYear) {
                case 0:
                    firstDay = firstDayOfFirstWeek;
                    break;
                case 1:
                    // firstDay is the 1st day of the 1st week of the year after
                    // firstDay = lastDayOfLastWeek + 1 Day
                    firstDay = new Date(y, 11, lastThursday + 3 + 1);
                    break;
                case -1:
                    // firstDay is the 1st day of the 1st week of the previous year.
                    // The first week of the previous year is the week that contains the
                    // first Thursday of the previous year.
                    let firstThursdayPreviousYear = 1;
                    while (new Date(y - 1, 0, firstThursdayPreviousYear).getDay() !== 4) {
                        firstThursdayPreviousYear += 1;
                    }
                    firstDay = new Date(y - 1, 0, firstThursdayPreviousYear - 3);
                    break;
            }
            const dif = (_date.getTime() - firstDay.getTime()) / 86400000;
            return Math.floor(dif / 7) + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // MINUTE
    // -----------------------------------------------------------------------------
    const MINUTE = {
        description: _lt("Minute component of a specific time."),
        args: args(`
      time (date) ${_lt("The time from which to calculate the minute component.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toJsDate(date).getMinutes();
        },
    };
    // -----------------------------------------------------------------------------
    // MONTH
    // -----------------------------------------------------------------------------
    const MONTH = {
        description: _lt("Month of the year a specific date falls in"),
        args: args(`
      date (date) ${_lt("The date from which to extract the month.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toJsDate(date).getMonth() + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // NETWORKDAYS
    // -----------------------------------------------------------------------------
    const NETWORKDAYS = {
        description: _lt("Net working days between two provided days."),
        args: args(`
      start_date (date) ${_lt("The start date of the period from which to calculate the number of net working days.")}
      end_date (date) ${_lt("The end date of the period from which to calculate the number of net working days.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the date serial numbers to consider holidays.")}
    `),
        returns: ["NUMBER"],
        compute: function (startDate, endDate, holidays) {
            return NETWORKDAYS_INTL.compute(startDate, endDate, 1, holidays);
        },
    };
    // -----------------------------------------------------------------------------
    // NETWORKDAYS.INTL
    // -----------------------------------------------------------------------------
    /**
     * Transform weekend Spreadsheet informations into Date Day JavaScript informations.
     * Take string (String method) or number (Number method), return array of numbers.
     *
     * String method: weekends can be specified using seven 0’s and 1’s, where the
     * first number in the set represents Monday and the last number is for Sunday.
     * A zero means that the day is a work day, a 1 means that the day is a weekend.
     * For example, “0000011” would mean Saturday and Sunday are weekends.
     *
     * Number method: instead of using the string method above, a single number can
     * be used. 1 = Saturday/Sunday are weekends, 2 = Sunday/Monday, and this pattern
     * repeats until 7 = Friday/Saturday. 11 = Sunday is the only weekend, 12 = Monday
     * is the only weekend, and this pattern repeats until 17 = Saturday is the only
     * weekend.
     *
     * Exemple:
     * - 11 return [0] (correspond to Sunday)
     * - 12 return [1] (correspond to Monday)
     * - 3 return [1,2] (correspond to Monday and Tuesday)
     * - "0101010" return [2,4,6] (correspond to Tuesday, Thursday and Saturday)
     */
    function weekendToDayNumber(weekend) {
        if (typeof weekend === "string") {
            let result = [];
            if (weekend.length === 7) {
                for (let i = 0; i < 7; i++) {
                    switch (weekend.charAt(i)) {
                        case "0":
                            break;
                        case "1":
                            // "1000000" corespond to Monday [1]
                            // "0000010" corespond to Saturday [6]
                            // "0000001" corespond to Sunday [0]
                            result.push(i + 1 === 7 ? 0 : i + 1);
                            break;
                        default:
                            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 3 requires a string composed of 0 or 1. Actual string is '%s'.", weekend));
                    }
                }
                return result;
            }
            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 3 requires a string with 7 characters. Actual string is '%s'.", weekend));
        }
        if (typeof weekend === "number") {
            if (1 <= weekend && weekend <= 7) {
                // 1 = Saturday/Sunday are weekends
                // 2 = Sunday/Monday
                // ...
                // 7 = Friday/Saturday.
                return [weekend - 2 === -1 ? 6 : weekend - 2, weekend - 1];
            }
            if (11 <= weekend && weekend <= 17) {
                // 11 = Sunday is the only weekend
                // 12 = Monday is the only weekend
                // ...
                // 17 = Saturday is the only weekend.
                return [weekend - 11];
            }
            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 3 requires a string or a number in the range 1-7 or 11-17. Actual number is %s.", weekend.toString()));
        }
        throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 3 requires a number or a string.`));
    }
    const NETWORKDAYS_INTL = {
        description: _lt("Net working days between two dates (specifying weekends)."),
        args: args(`
      start_date (date) ${_lt("The start date of the period from which to calculate the number of net working days.")}
      end_date (date) ${_lt("The end date of the period from which to calculate the number of net working days.")}
      weekend (any, default=1) ${_lt("A number or string representing which days of the week are considered weekends.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the dates to consider as holidays.")}
    `),
        returns: ["NUMBER"],
        compute: function (startDate, endDate, weekend = 1, holidays = undefined) {
            const _startDate = toJsDate(startDate);
            const _endDate = toJsDate(endDate);
            const daysWeekend = weekendToDayNumber(weekend);
            let timesHoliday = new Set();
            if (holidays !== undefined) {
                visitAny(holidays, (h) => {
                    const holiday = toJsDate(h);
                    timesHoliday.add(holiday.getTime());
                });
            }
            const invertDate = _startDate.getTime() > _endDate.getTime();
            const stopDate = new Date((invertDate ? _startDate : _endDate).getTime());
            let stepDate = new Date((invertDate ? _endDate : _startDate).getTime());
            const timeStopDate = stopDate.getTime();
            let timeStepDate = stepDate.getTime();
            let netWorkingDay = 0;
            while (timeStepDate <= timeStopDate) {
                if (!daysWeekend.includes(stepDate.getDay()) && !timesHoliday.has(timeStepDate)) {
                    netWorkingDay += 1;
                }
                stepDate.setDate(stepDate.getDate() + 1);
                timeStepDate = stepDate.getTime();
            }
            return invertDate ? -netWorkingDay : netWorkingDay;
        },
    };
    // -----------------------------------------------------------------------------
    // NOW
    // -----------------------------------------------------------------------------
    const NOW = {
        description: _lt("Current date and time as a date value."),
        args: [],
        returns: ["DATE"],
        returnFormat: { specificFormat: "m/d/yyyy hh:mm:ss" },
        compute: function () {
            let today = new Date();
            today.setMilliseconds(0);
            const delta = today.getTime() - INITIAL_1900_DAY$1.getTime();
            const time = today.getHours() / 24 + today.getMinutes() / 1440 + today.getSeconds() / 86400;
            return Math.floor(delta / 86400000) + time;
        },
    };
    // -----------------------------------------------------------------------------
    // SECOND
    // -----------------------------------------------------------------------------
    const SECOND = {
        description: _lt("Minute component of a specific time."),
        args: args(`
      time (date) ${_lt("The time from which to calculate the second component.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toJsDate(date).getSeconds();
        },
    };
    // -----------------------------------------------------------------------------
    // TIME
    // -----------------------------------------------------------------------------
    const TIME = {
        description: _lt("Converts hour/minute/second into a time."),
        args: args(`
    hour (number) ${_lt("The hour component of the time.")}
    minute (number) ${_lt("The minute component of the time.")}
    second (number) ${_lt("The second component of the time.")}
    `),
        returns: ["DATE"],
        returnFormat: { specificFormat: "hh:mm:ss a" },
        compute: function (hour, minute, second) {
            let _hour = Math.trunc(toNumber(hour));
            let _minute = Math.trunc(toNumber(minute));
            let _second = Math.trunc(toNumber(second));
            _minute += Math.floor(_second / 60);
            _second = (_second % 60) + (_second < 0 ? 60 : 0);
            _hour += Math.floor(_minute / 60);
            _minute = (_minute % 60) + (_minute < 0 ? 60 : 0);
            _hour %= 24;
            if (_hour < 0) {
                throw new Error(_lt(`function [[FUNCTION_NAME]] result should not be negative`));
            }
            return _hour / 24 + _minute / (24 * 60) + _second / (24 * 60 * 60);
        },
    };
    // -----------------------------------------------------------------------------
    // TIMEVALUE
    // -----------------------------------------------------------------------------
    const TIMEVALUE = {
        description: _lt("Converts a time string into its serial number representation."),
        args: args(`
      time_string (string) ${_lt("The string that holds the time representation.")}
    `),
        returns: ["NUMBER"],
        compute: function (timeString) {
            const _timeString = toString(timeString);
            const internalDate = parseDateTime(_timeString);
            if (internalDate === null) {
                throw new Error(_lt("[[FUNCTION_NAME]] parameter '%s' cannot be parsed to date/time.", _timeString));
            }
            const result = internalDate.value - Math.trunc(internalDate.value);
            return result < 0 ? 1 + result : result;
        },
    };
    // -----------------------------------------------------------------------------
    // TODAY
    // -----------------------------------------------------------------------------
    const TODAY = {
        description: _lt("Current date as a date value."),
        args: [],
        returns: ["DATE"],
        returnFormat: { specificFormat: "m/d/yyyy" },
        compute: function () {
            const today = new Date();
            const jsDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const delta = jsDate.getTime() - INITIAL_1900_DAY$1.getTime();
            return Math.round(delta / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // WEEKDAY
    // -----------------------------------------------------------------------------
    const WEEKDAY = {
        description: _lt("Day of the week of the date provided (as number)."),
        args: args(`
    date (date) ${_lt("The date for which to determine the day of the week. Must be a reference to a cell containing a date, a function returning a date type, or a number.")}
    type (number, default=1) ${_lt("A number indicating which numbering system to use to represent weekdays. By default, counts starting with Sunday = 1.")}
  `),
        returns: ["NUMBER"],
        compute: function (date, type = 1) {
            const _date = toJsDate(date);
            const _type = Math.round(toNumber(type));
            const m = _date.getDay();
            switch (_type) {
                case 1:
                    return m + 1;
                case 2:
                    return m === 0 ? 7 : m;
                case 3:
                    return m === 0 ? 6 : m - 1;
            }
            throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value %s is out of range.", _type.toString()));
        },
    };
    // -----------------------------------------------------------------------------
    // WEEKNUM
    // -----------------------------------------------------------------------------
    const WEEKNUM = {
        description: _lt("Week number of the year."),
        args: args(`
    date (date) ${_lt("The date for which to determine the week number. Must be a reference to a cell containing a date, a function returning a date type, or a number.")}
    type (number, default=1) ${_lt("A number representing the day that a week starts on. Sunday = 1.")}
    `),
        returns: ["NUMBER"],
        compute: function (date, type = 1) {
            const _date = toJsDate(date);
            const _type = Math.round(toNumber(type));
            let startDayOfWeek;
            if (_type === 1 || _type === 2) {
                startDayOfWeek = _type - 1;
            }
            else if (11 <= _type && _type <= 17) {
                startDayOfWeek = _type - 10 === 7 ? 0 : _type - 10;
            }
            else if (_type === 21) {
                return ISOWEEKNUM.compute(date);
            }
            else {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 value %s is out of range.", _type.toString()));
            }
            const y = _date.getFullYear();
            let dayStart = 1;
            let startDayOfFirstWeek = new Date(y, 0, dayStart);
            while (startDayOfFirstWeek.getDay() !== startDayOfWeek) {
                dayStart += 1;
                startDayOfFirstWeek = new Date(y, 0, dayStart);
            }
            const dif = (_date.getTime() - startDayOfFirstWeek.getTime()) / 86400000;
            if (dif < 0) {
                return 1;
            }
            return Math.floor(dif / 7) + (dayStart === 1 ? 1 : 2);
        },
    };
    // -----------------------------------------------------------------------------
    // WORKDAY
    // -----------------------------------------------------------------------------
    const WORKDAY = {
        description: _lt("Number of working days from start date."),
        args: args(`
      start_date (date) ${_lt("The date from which to begin counting.")}
      num_days (number) ${_lt("The number of working days to advance from start_date. If negative, counts backwards.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the dates to consider holidays.")}
      `),
        returns: ["NUMBER"],
        returnFormat: { specificFormat: "m/d/yyyy" },
        compute: function (startDate, numDays, holidays = undefined) {
            return WORKDAY_INTL.compute(startDate, numDays, 1, holidays);
        },
    };
    // -----------------------------------------------------------------------------
    // WORKDAY.INTL
    // -----------------------------------------------------------------------------
    const WORKDAY_INTL = {
        description: _lt("Net working days between two dates (specifying weekends)."),
        args: args(`
      start_date (date) ${_lt("The date from which to begin counting.")}
      num_days (number) ${_lt("The number of working days to advance from start_date. If negative, counts backwards.")}
      weekend (any, default=1) ${_lt("A number or string representing which days of the week are considered weekends.")}
      holidays (date, range<date>, optional) ${_lt("A range or array constant containing the dates to consider holidays.")}
    `),
        returns: ["DATE"],
        returnFormat: { specificFormat: "m/d/yyyy" },
        compute: function (startDate, numDays, weekend = 1, holidays = undefined) {
            let _startDate = toJsDate(startDate);
            let _numDays = Math.trunc(toNumber(numDays));
            if (weekend === "1111111") {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 3 cannot be equal to '1111111'.`));
            }
            const daysWeekend = weekendToDayNumber(weekend);
            let timesHoliday = new Set();
            if (holidays !== undefined) {
                visitAny(holidays, (h) => {
                    const holiday = toJsDate(h);
                    timesHoliday.add(holiday.getTime());
                });
            }
            let stepDate = new Date(_startDate.getTime());
            let timeStepDate = stepDate.getTime();
            const unitDay = Math.sign(_numDays);
            let stepDay = Math.abs(_numDays);
            while (stepDay > 0) {
                stepDate.setDate(stepDate.getDate() + unitDay);
                timeStepDate = stepDate.getTime();
                if (!daysWeekend.includes(stepDate.getDay()) && !timesHoliday.has(timeStepDate)) {
                    stepDay -= 1;
                }
            }
            const delta = timeStepDate - INITIAL_1900_DAY$1.getTime();
            return Math.round(delta / 86400000);
        },
    };
    // -----------------------------------------------------------------------------
    // YEAR
    // -----------------------------------------------------------------------------
    const YEAR = {
        description: _lt("Year specified by a given date."),
        args: args(`
    date (date) ${_lt("The date from which to extract the year.")}
    `),
        returns: ["NUMBER"],
        compute: function (date) {
            return toJsDate(date).getFullYear();
        },
    };

    var date = /*#__PURE__*/Object.freeze({
        __proto__: null,
        DATE: DATE,
        DATEVALUE: DATEVALUE,
        DAY: DAY,
        DAYS: DAYS,
        EDATE: EDATE,
        EOMONTH: EOMONTH,
        HOUR: HOUR,
        ISOWEEKNUM: ISOWEEKNUM,
        MINUTE: MINUTE,
        MONTH: MONTH,
        NETWORKDAYS: NETWORKDAYS,
        NETWORKDAYS_INTL: NETWORKDAYS_INTL,
        NOW: NOW,
        SECOND: SECOND,
        TIME: TIME,
        TIMEVALUE: TIMEVALUE,
        TODAY: TODAY,
        WEEKDAY: WEEKDAY,
        WEEKNUM: WEEKNUM,
        WORKDAY: WORKDAY,
        WORKDAY_INTL: WORKDAY_INTL,
        YEAR: YEAR
    });

    // -----------------------------------------------------------------------------
    // ISERROR
    // -----------------------------------------------------------------------------
    const ISERROR = {
        description: _lt("Whether a value is an error."),
        args: args(`value (any, lazy) ${_lt("The value to be verified as an error type.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            try {
                value();
                return false;
            }
            catch (e) {
                return true;
            }
        },
    };
    // -----------------------------------------------------------------------------
    // ISLOGICAL
    // -----------------------------------------------------------------------------
    const ISLOGICAL = {
        description: _lt("Whether a value is `true` or `false`."),
        args: args(`value (any) ${_lt("The value to be verified as a logical TRUE or FALSE.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value === "boolean";
        },
    };
    // -----------------------------------------------------------------------------
    // ISNONTEXT
    // -----------------------------------------------------------------------------
    const ISNONTEXT = {
        description: _lt("Whether a value is non-textual."),
        args: args(`value (any) ${_lt("The value to be checked.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value !== "string";
        },
    };
    // -----------------------------------------------------------------------------
    // ISNUMBER
    // -----------------------------------------------------------------------------
    const ISNUMBER = {
        description: _lt("Whether a value is a number."),
        args: args(`value (any) ${_lt("The value to be verified as a number.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value === "number";
        },
    };
    // -----------------------------------------------------------------------------
    // ISTEXT
    // -----------------------------------------------------------------------------
    const ISTEXT = {
        description: _lt("Whether a value is text."),
        args: args(`value (any) ${_lt("The value to be verified as text.")}`),
        returns: ["BOOLEAN"],
        compute: function (value) {
            return typeof value === "string";
        },
    };

    var info = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ISERROR: ISERROR,
        ISLOGICAL: ISLOGICAL,
        ISNONTEXT: ISNONTEXT,
        ISNUMBER: ISNUMBER,
        ISTEXT: ISTEXT
    });

    // -----------------------------------------------------------------------------
    // WAIT
    // -----------------------------------------------------------------------------
    const WAIT = {
        description: _lt("Wait"),
        args: args(`ms (number) ${_lt("wait time in milliseconds")}`),
        returns: ["ANY"],
        async: true,
        compute: function (delay) {
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    resolve(delay);
                }, delay);
            });
        },
    };
    // -----------------------------------------------------------------------------
    // AND
    // -----------------------------------------------------------------------------
    const AND = {
        description: _lt("Logical `and` operator."),
        args: args(`
      logical_expression1 (boolean, range<boolean>) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE, or an expression that can be coerced to a logical value.")}
      logical_expression1 (boolean, range<boolean>, repeating) ${_lt("More expressions that represent logical values.")}
    `),
        returns: ["BOOLEAN"],
        compute: function () {
            let result = true;
            let foundBoolean = false;
            visitBooleans(arguments, (b) => {
                result = result && b;
                foundBoolean = true;
                return result;
            });
            if (!foundBoolean) {
                throw new Error(_lt(`[[FUNCTION_NAME]] has no valid input data.`));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // IF
    // -----------------------------------------------------------------------------
    const IF = {
        description: _lt("Returns value depending on logical expression."),
        args: args(`
      logical_expression (boolean) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE.")}
      value_if_true (any, lazy) ${_lt("The value the function returns if logical_expression is TRUE.")}
      value_if_false (any, lazy, default=FALSE) ${_lt("The value the function returns if logical_expression is FALSE.")}
    `),
        returns: ["ANY"],
        compute: function (logicalExpression, valueIfTrue, valueIfFalse = () => false) {
            const result = toBoolean(logicalExpression) ? valueIfTrue() : valueIfFalse();
            return result === null ? "" : result;
        },
    };
    // -----------------------------------------------------------------------------
    // IFERROR
    // -----------------------------------------------------------------------------
    const IFERROR = {
        description: _lt("Value if it is not an error, otherwise 2nd argument."),
        args: args(`
    value (any, lazy) ${_lt("The value to return if value itself is not an error.")}
    value_if_error (any, lazy, default=${_lt("An empty value")}) ${_lt("The value the function returns if value is an error.")}
  `),
        returns: ["ANY"],
        compute: function (value, valueIfError = () => "") {
            let result;
            try {
                result = value();
            }
            catch (e) {
                result = valueIfError();
            }
            return result === null ? "" : result;
        },
    };
    // -----------------------------------------------------------------------------
    // IFS
    // -----------------------------------------------------------------------------
    const IFS = {
        description: _lt("Returns a value depending on multiple logical expressions."),
        args: args(`
      condition1 (boolean, lazy) ${_lt("The first condition to be evaluated. This can be a boolean, a number, an array, or a reference to any of those.")}
      value1 (any, lazy) ${_lt("The returned value if condition1 is TRUE.")}
      condition2 (boolean, lazy, repeating) ${_lt("Additional conditions to be evaluated if the previous ones are FALSE.")}
      value2 (any, lazy, repeating) ${_lt("Additional values to be returned if their corresponding conditions are TRUE.")}
  `),
        returns: ["ANY"],
        compute: function () {
            if (arguments.length % 2 === 1) {
                throw new Error(_lt(`Wrong number of arguments. Expected an even number of arguments.`));
            }
            for (let n = 0; n < arguments.length - 1; n += 2) {
                if (toBoolean(arguments[n]())) {
                    return arguments[n + 1]();
                }
            }
            throw new Error(_lt(`No match.`));
        },
    };
    // -----------------------------------------------------------------------------
    // NOT
    // -----------------------------------------------------------------------------
    const NOT = {
        description: _lt("Returns opposite of provided logical value."),
        args: args(`logical_expression (boolean) ${_lt("An expression or reference to a cell holding an expression that represents some logical value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (logicalExpression) {
            return !toBoolean(logicalExpression);
        },
    };
    // -----------------------------------------------------------------------------
    // OR
    // -----------------------------------------------------------------------------
    const OR = {
        description: _lt("Logical `or` operator."),
        args: args(`
      logical_expression1 (boolean, range<boolean>) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE, or an expression that can be coerced to a logical value.")}
      logical_expression2 (boolean, range<boolean>, repeating) ${_lt("More expressions that evaluate to logical values.")}
    `),
        returns: ["BOOLEAN"],
        compute: function () {
            let result = false;
            let foundBoolean = false;
            visitBooleans(arguments, (b) => {
                result = result || b;
                foundBoolean = true;
                return !result;
            });
            if (!foundBoolean) {
                throw new Error(_lt(`[[FUNCTION_NAME]] has no valid input data.`));
            }
            return result;
        },
    };
    // -----------------------------------------------------------------------------
    // XOR
    // -----------------------------------------------------------------------------
    const XOR = {
        description: _lt("Logical `xor` operator."),
        args: args(`
      logical_expression1 (boolean, range<boolean>) ${_lt("An expression or reference to a cell containing an expression that represents some logical value, i.e. TRUE or FALSE, or an expression that can be coerced to a logical value.")}
      logical_expression2 (boolean, range<boolean>, repeating) ${_lt("More expressions that evaluate to logical values.")}
    `),
        returns: ["BOOLEAN"],
        compute: function () {
            let result = false;
            let foundBoolean = false;
            visitBooleans(arguments, (b) => {
                result = result ? !b : b;
                foundBoolean = true;
                return true;
            });
            if (!foundBoolean) {
                throw new Error(_lt(`[[FUNCTION_NAME]] has no valid input data.`));
            }
            return result;
        },
    };

    var logical = /*#__PURE__*/Object.freeze({
        __proto__: null,
        WAIT: WAIT,
        AND: AND,
        IF: IF,
        IFERROR: IFERROR,
        IFS: IFS,
        NOT: NOT,
        OR: OR,
        XOR: XOR
    });

    /**
     * Perform a linear search and return the index of the perfect match.
     * -1 is returned if no value is found.
     *
     * Example:
     * - [3, 6, 10], 3 => 0
     * - [3, 6, 10], 6 => 1
     * - [3, 6, 10], 9 => -1
     * - [3, 6, 10], 2 => -1
     */
    function linearSearch(range, target) {
        for (let i = 0; i < range.length; i++) {
            if (range[i] === target) {
                return i;
            }
        }
        // no value is found, -1 is returned
        return -1;
    }
    // -----------------------------------------------------------------------------
    // COLUMN
    // -----------------------------------------------------------------------------
    const COLUMN = {
        description: _lt("Column number of a specified cell."),
        args: args(`cell_reference (meta, default=${_lt("The cell in which the formula is entered")}) ${_lt("The cell whose column number will be returned. Column A corresponds to 1.")}
    `),
        returns: ["NUMBER"],
        compute: function (cellReference) {
            let zone;
            if (cellReference) {
                zone = toZone(cellReference);
            }
            else {
                if (this.__originCellXC) {
                    zone = toZone(this.__originCellXC);
                }
                else {
                    throw new Error(_lt(`In this context, the function [[FUNCTION_NAME]] needs to have a cell or range in parameter.`));
                }
            }
            return zone.left + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // COLUMNS
    // -----------------------------------------------------------------------------
    const COLUMNS = {
        description: _lt("Number of columns in a specified array or range."),
        args: args(`range (meta) ${_lt("The range whose column count will be returned.")}`),
        returns: ["NUMBER"],
        compute: function (range) {
            const zone = toZone(range);
            return zone.right - zone.left + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // HLOOKUP
    // -----------------------------------------------------------------------------
    const HLOOKUP = {
        description: _lt(`Horizontal lookup`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      range (any, range) ${_lt("The range to consider for the search. The first row in the range is searched for the key specified in search_key.")}
      index (number) ${_lt("The row index of the value to be returned, where the first row in range is numbered 1.")}
      is_sorted (boolean, default=TRUE) ${_lt("Indicates whether the row to be searched (the first row of the specified range) is sorted, in which case the closest match for search_key will be returned.")}
  `),
        returns: ["ANY"],
        compute: function (searchKey, range, index, isSorted = true) {
            const _index = Math.trunc(toNumber(index));
            if (_index < 1 || range[0].length < _index) {
                throw new Error(_lt(`[[FUNCTION_NAME]] evaluates to an out of bounds range.`));
            }
            const _isSorted = toBoolean(isSorted);
            const firstRow = range.map((col) => col[0]);
            let colIndex;
            if (_isSorted) {
                colIndex = dichotomicPredecessorSearch(firstRow, searchKey);
            }
            else {
                colIndex = linearSearch(firstRow, searchKey);
            }
            if (colIndex > -1) {
                return range[colIndex][_index - 1];
            }
            else {
                throw new Error(_lt("Did not find value '%s' in [[FUNCTION_NAME]] evaluation.", searchKey));
            }
        },
    };
    // -----------------------------------------------------------------------------
    // LOOKUP
    // -----------------------------------------------------------------------------
    const LOOKUP = {
        description: _lt(`Look up a value.`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      search_array (any, range) ${_lt("One method of using this function is to provide a single sorted row or column search_array to look through for the search_key with a second argument result_range. The other way is to combine these two arguments into one search_array where the first row or column is searched and a value is returned from the last row or column in the array. If search_key is not found, a non-exact match may be returned.")}
      result_range (any, range, optional) ${_lt("The range from which to return a result. The value returned corresponds to the location where search_key is found in search_range. This range must be only a single row or column and should not be used if using the search_result_array method.")}
  `),
        returns: ["ANY"],
        compute: function (searchKey, searchArray, resultRange = undefined) {
            const verticalSearch = searchArray[0].length >= searchArray.length;
            const searchRange = verticalSearch ? searchArray[0] : searchArray.map((c) => c[0]);
            const index = dichotomicPredecessorSearch(searchRange, searchKey);
            if (index === -1) {
                throw new Error(_lt("Did not find value '%s' in [[FUNCTION_NAME]] evaluation.", searchKey));
            }
            if (resultRange === undefined) {
                return verticalSearch ? searchArray.pop()[index] : searchArray[index].pop();
            }
            const nbCol = resultRange.length;
            const nbRow = resultRange[0].length;
            if (nbCol > 1 && nbRow > 1) {
                throw new Error(_lt(`[[FUNCTION_NAME]] range must be a single row or a single column.`));
            }
            if (nbCol > 1) {
                if (nbCol - 1 < index) {
                    throw new Error(_lt("[[FUNCTION_NAME]] evaluates to an out of range row value %s.", (index + 1).toString()));
                }
                return resultRange[index][0];
            }
            if (nbRow - 1 < index) {
                throw new Error(_lt("[[FUNCTION_NAME]] evaluates to an out of range column value %s.", (index + 1).toString()));
            }
            return resultRange[0][index];
        },
    };
    // -----------------------------------------------------------------------------
    // MATCH
    // -----------------------------------------------------------------------------
    const MATCH = {
        description: _lt(`Position of item in range that matches value.`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      range (any, range) ${_lt("The one-dimensional array to be searched.")}
      search_type (number, default=1) ${_lt("The search method. 1 (default) finds the largest value less than or equal to search_key when range is sorted in ascending order. 0 finds the exact value when range is unsorted. -1 finds the smallest value greater than or equal to search_key when range is sorted in descending order.")}
  `),
        returns: ["NUMBER"],
        compute: function (searchKey, range, searchType = 1) {
            let _searchType = toNumber(searchType);
            const nbCol = range.length;
            const nbRow = range[0].length;
            if (nbCol > 1 && nbRow > 1) {
                throw new Error(_lt(`[[FUNCTION_NAME]] range must be a single row or a single column.`));
            }
            let index = -1;
            range = range.flat();
            _searchType = Math.sign(_searchType);
            switch (_searchType) {
                case 1:
                    index = dichotomicPredecessorSearch(range, searchKey);
                    break;
                case 0:
                    index = linearSearch(range, searchKey);
                    break;
                case -1:
                    index = dichotomicSuccessorSearch(range, searchKey);
                    break;
            }
            if (index > -1) {
                return index + 1;
            }
            else {
                throw new Error(_lt("Did not find value '%s' in [[FUNCTION_NAME]] evaluation.", searchKey));
            }
        },
    };
    // -----------------------------------------------------------------------------
    // ROW
    // -----------------------------------------------------------------------------
    const ROW = {
        description: _lt("Row number of a specified cell."),
        args: args(`cell_reference (meta, default=${_lt("The cell in which the formula is entered by default")}) ${_lt("The cell whose row number will be returned.")}`),
        returns: ["NUMBER"],
        compute: function (cellReference) {
            let zone;
            if (cellReference) {
                zone = toZone(cellReference);
            }
            else {
                if (this.__originCellXC) {
                    zone = toZone(this.__originCellXC);
                }
                else {
                    throw Error(`In this context, the function [[FUNCTION_NAME]] needs to have a cell or range in parameter.`);
                }
            }
            return zone.top + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // ROWS
    // -----------------------------------------------------------------------------
    const ROWS = {
        description: _lt("Number of rows in a specified array or range."),
        args: args(`range (meta) ${_lt("The range whose row count will be returned.")}`),
        returns: ["NUMBER"],
        compute: function (range) {
            const zone = toZone(range);
            return zone.bottom - zone.top + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // VLOOKUP
    // -----------------------------------------------------------------------------
    const VLOOKUP = {
        description: _lt(`Vertical lookup.`),
        args: args(`
      search_key (any) ${_lt("The value to search for. For example, 42, 'Cats', or I24.")}
      range (any, range) ${_lt("The range to consider for the search. The first column in the range is searched for the key specified in search_key.")}
      index (number) ${_lt("The column index of the value to be returned, where the first column in range is numbered 1.")}
      is_sorted (boolean, default=TRUE) ${_lt("Indicates whether the column to be searched (the first column of the specified range) is sorted, in which case the closest match for search_key will be returned.")}
  `),
        returns: ["ANY"],
        compute: function (searchKey, range, index, isSorted = true) {
            const _index = Math.trunc(toNumber(index));
            if (_index < 1 || range.length < _index) {
                throw new Error(_lt(`[[FUNCTION_NAME]] evaluates to an out of bounds range.`));
            }
            const _isSorted = toBoolean(isSorted);
            const firstCol = range[0];
            let rowIndex;
            if (_isSorted) {
                rowIndex = dichotomicPredecessorSearch(firstCol, searchKey);
            }
            else {
                rowIndex = linearSearch(firstCol, searchKey);
            }
            if (rowIndex > -1) {
                return range[_index - 1][rowIndex];
            }
            else {
                throw new Error(_lt("Did not find value '%s' in [[FUNCTION_NAME]] evaluation.", searchKey));
            }
        },
    };

    var lookup = /*#__PURE__*/Object.freeze({
        __proto__: null,
        COLUMN: COLUMN,
        COLUMNS: COLUMNS,
        HLOOKUP: HLOOKUP,
        LOOKUP: LOOKUP,
        MATCH: MATCH,
        ROW: ROW,
        ROWS: ROWS,
        VLOOKUP: VLOOKUP
    });

    // -----------------------------------------------------------------------------
    // ADD
    // -----------------------------------------------------------------------------
    const ADD = {
        description: _lt(`Sum of two numbers.`),
        args: args(`
      value1 (number) ${_lt("The first addend.")}
      value2 (number) ${_lt("The second addend.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value1, value2) {
            return toNumber(value1) + toNumber(value2);
        },
    };
    // -----------------------------------------------------------------------------
    // CONCAT
    // -----------------------------------------------------------------------------
    const CONCAT = {
        description: _lt(`Concatenation of two values.`),
        args: args(`
      value1 (string) ${_lt("The value to which value2 will be appended.")}
      value2 (string) ${_lt("The value to append to value1.")}
    `),
        returns: ["STRING"],
        compute: function (value1, value2) {
            return toString(value1) + toString(value2);
        },
    };
    // -----------------------------------------------------------------------------
    // DIVIDE
    // -----------------------------------------------------------------------------
    const DIVIDE = {
        description: _lt(`One number divided by another.`),
        args: args(`
      dividend (number) ${_lt("The number to be divided.")}
      divisor (number) ${_lt("The number to divide by.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (dividend, divisor) {
            const _divisor = toNumber(divisor);
            if (_divisor === 0) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 2 cannot be zero."));
            }
            return toNumber(dividend) / _divisor;
        },
    };
    // -----------------------------------------------------------------------------
    // EQ
    // -----------------------------------------------------------------------------
    function isEmpty(value) {
        return value === null || value === undefined;
    }
    const getNeutral = { number: 0, string: "", boolean: false };
    const EQ = {
        description: _lt(`Equal.`),
        args: args(`
      value1 (any) ${_lt("The first value.")}
      value2 (any) ${_lt("The value to test against value1 for equality.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            value1 = isEmpty(value1) ? getNeutral[typeof value2] : value1;
            value2 = isEmpty(value2) ? getNeutral[typeof value1] : value2;
            if (typeof value1 === "string") {
                value1 = value1.toUpperCase();
            }
            if (typeof value2 === "string") {
                value2 = value2.toUpperCase();
            }
            return value1 === value2;
        },
    };
    // -----------------------------------------------------------------------------
    // GT
    // -----------------------------------------------------------------------------
    function applyRelationalOperator(value1, value2, cb) {
        value1 = isEmpty(value1) ? getNeutral[typeof value2] : value1;
        value2 = isEmpty(value2) ? getNeutral[typeof value1] : value2;
        if (typeof value1 !== "number") {
            value1 = toString(value1).toUpperCase();
        }
        if (typeof value2 !== "number") {
            value2 = toString(value2).toUpperCase();
        }
        const tV1 = typeof value1;
        const tV2 = typeof value2;
        if (tV1 === "string" && tV2 === "number") {
            return true;
        }
        if (tV2 === "string" && tV1 === "number") {
            return false;
        }
        return cb(value1, value2);
    }
    const GT = {
        description: _lt(`Strictly greater than.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being greater than value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return applyRelationalOperator(value1, value2, (v1, v2) => {
                return v1 > v2;
            });
        },
    };
    // -----------------------------------------------------------------------------
    // GTE
    // -----------------------------------------------------------------------------
    const GTE = {
        description: _lt(`Greater than or equal to.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being greater than or equal to value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return applyRelationalOperator(value1, value2, (v1, v2) => {
                return v1 >= v2;
            });
        },
    };
    // -----------------------------------------------------------------------------
    // LT
    // -----------------------------------------------------------------------------
    const LT = {
        description: _lt(`Less than.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being less than value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return !GTE.compute(value1, value2);
        },
    };
    // -----------------------------------------------------------------------------
    // LTE
    // -----------------------------------------------------------------------------
    const LTE = {
        description: _lt(`Less than or equal to.`),
        args: args(`
      value1 (any) ${_lt("The value to test as being less than or equal to value2.")}
      value2 (any) ${_lt("The second value.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return !GT.compute(value1, value2);
        },
    };
    // -----------------------------------------------------------------------------
    // MINUS
    // -----------------------------------------------------------------------------
    const MINUS = {
        description: _lt(`Difference of two numbers.`),
        args: args(`
      value1 (number) ${_lt("The minuend, or number to be subtracted from.")}
      value2 (number) ${_lt("The subtrahend, or number to subtract from value1.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (value1, value2) {
            return toNumber(value1) - toNumber(value2);
        },
    };
    // -----------------------------------------------------------------------------
    // MULTIPLY
    // -----------------------------------------------------------------------------
    const MULTIPLY = {
        description: _lt(`Product of two numbers`),
        args: args(`
      factor1 (number) ${_lt("The first multiplicand.")}
      factor2 (number) ${_lt("The second multiplicand.")}
    `),
        returns: ["NUMBER"],
        returnFormat: ReturnFormatType.FormatFromArgument,
        compute: function (factor1, factor2) {
            return toNumber(factor1) * toNumber(factor2);
        },
    };
    // -----------------------------------------------------------------------------
    // NE
    // -----------------------------------------------------------------------------
    const NE = {
        description: _lt(`Not equal.`),
        args: args(`
      value1 (any) ${_lt("The first value.")}
      value2 (any) ${_lt("The value to test against value1 for inequality.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (value1, value2) {
            return !EQ.compute(value1, value2);
        },
    };
    // -----------------------------------------------------------------------------
    // POW
    // -----------------------------------------------------------------------------
    const POW = {
        description: _lt(`A number raised to a power.`),
        args: args(`
      base (number) ${_lt("The number to raise to the exponent power.")}
      exponent (number) ${_lt("The exponent to raise base to.")}
    `),
        returns: ["BOOLEAN"],
        compute: function (base, exponent) {
            return POWER.compute(base, exponent);
        },
    };
    // -----------------------------------------------------------------------------
    // UMINUS
    // -----------------------------------------------------------------------------
    const UMINUS = {
        description: _lt(`A number with the sign reversed.`),
        args: args(`
      value (number) ${_lt("The number to have its sign reversed. Equivalently, the number to multiply by -1.")}
    `),
        returnFormat: ReturnFormatType.FormatFromArgument,
        returns: ["NUMBER"],
        compute: function (value) {
            return -toNumber(value);
        },
    };
    // -----------------------------------------------------------------------------
    // UNARY_PERCENT
    // -----------------------------------------------------------------------------
    const UNARY_PERCENT = {
        description: _lt(`Value interpreted as a percentage.`),
        args: args(`
      percentage (number) ${_lt("The value to interpret as a percentage.")}
    `),
        returns: ["NUMBER"],
        compute: function (percentage) {
            return toNumber(percentage) / 100;
        },
    };
    // -----------------------------------------------------------------------------
    // UPLUS
    // -----------------------------------------------------------------------------
    const UPLUS = {
        description: _lt(`A specified number, unchanged.`),
        args: args(`
      value (any) ${_lt("The number to return.")}
    `),
        returnFormat: ReturnFormatType.FormatFromArgument,
        returns: ["ANY"],
        compute: function (value) {
            return value;
        },
    };

    var operators = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ADD: ADD,
        CONCAT: CONCAT,
        DIVIDE: DIVIDE,
        EQ: EQ,
        GT: GT,
        GTE: GTE,
        LT: LT,
        LTE: LTE,
        MINUS: MINUS,
        MULTIPLY: MULTIPLY,
        NE: NE,
        POW: POW,
        UMINUS: UMINUS,
        UNARY_PERCENT: UNARY_PERCENT,
        UPLUS: UPLUS
    });

    // -----------------------------------------------------------------------------
    // CHAR
    // -----------------------------------------------------------------------------
    const CHAR = {
        description: _lt("Gets character associated with number."),
        args: args(`
      table_number (number) ${_lt("The number of the character to look up from the current Unicode table in decimal format.")}
  `),
        returns: ["STRING"],
        compute: function (tableNumber) {
            const _tableNumber = Math.trunc(toNumber(tableNumber));
            if (_tableNumber < 1) {
                throw new Error(_lt("Function [[FUNCTION_NAME]] parameter 1 value %s is out of range.", _tableNumber.toString()));
            }
            return String.fromCharCode(_tableNumber);
        },
    };
    // -----------------------------------------------------------------------------
    // CONCATENATE
    // -----------------------------------------------------------------------------
    const CONCATENATE = {
        description: _lt("Appends strings to one another."),
        args: args(`
      string1 (string, range<string>) ${_lt("The initial string.")}
      string2 (string, range<string>, repeating) ${_lt("More strings to append in sequence.")}
  `),
        returns: ["STRING"],
        compute: function () {
            return reduceArgs(arguments, (acc, a) => acc + toString(a), "");
        },
    };
    // -----------------------------------------------------------------------------
    // EXACT
    // -----------------------------------------------------------------------------
    const EXACT = {
        description: _lt("Tests whether two strings are identical."),
        args: args(`
      string1 (string) ${_lt("The first string to compare.")}
      string2 (string) ${_lt("The second string to compare.")}
  `),
        returns: ["BOOLEAN"],
        compute: function (string1, string2) {
            return toString(string1) === toString(string2);
        },
    };
    // -----------------------------------------------------------------------------
    // FIND
    // -----------------------------------------------------------------------------
    const FIND = {
        description: _lt("First position of string found in text, case-sensitive."),
        args: args(`
      search_for (string) ${_lt("The string to look for within text_to_search.")}
      text_to_search (string) ${_lt("The text to search for the first occurrence of search_for.")}
      starting_at (number, default=1 ) ${_lt("The character within text_to_search at which to start the search.")}
  `),
        returns: ["NUMBER"],
        compute: function (searchFor, textToSearch, startingAt = 1) {
            const _textToSearch = toString(textToSearch);
            if (_textToSearch === "") {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value should be non-empty.`));
            }
            const _startingAt = toNumber(startingAt);
            if (_startingAt === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 3 value is 0. It should be greater than or equal to 1.`));
            }
            const _searchFor = toString(searchFor);
            const result = _textToSearch.indexOf(_searchFor, _startingAt - 1);
            if (result < 0) {
                throw new Error(_lt("In [[FUNCTION_NAME]] evaluation, cannot find '%s' within '%s'.", _searchFor.toString(), _textToSearch));
            }
            return result + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // JOIN
    // -----------------------------------------------------------------------------
    const JOIN = {
        description: _lt("Concatenates elements of arrays with delimiter."),
        args: args(`
      delimiter (string) ${_lt("The character or string to place between each concatenated value.")}
      value_or_array1 (string, range<string>) ${_lt("The value or values to be appended using delimiter.")}
      value_or_array2 (string, range<string>, repeating) ${_lt("More values to be appended using delimiter.")}
  `),
        returns: ["STRING"],
        compute: function (delimiter, ...valuesOrArrays) {
            const _delimiter = toString(delimiter);
            return reduceArgs(valuesOrArrays, (acc, a) => (acc ? acc + _delimiter : "") + toString(a), "");
        },
    };
    // -----------------------------------------------------------------------------
    // LEFT
    // -----------------------------------------------------------------------------
    const LEFT = {
        description: _lt("Substring from beginning of specified string."),
        args: args(`
      text (string) ${_lt("The string from which the left portion will be returned.")}
      number_of_characters (number, default=1) ${_lt("The number of characters to return from the left side of string.")}
  `),
        returns: ["STRING"],
        compute: function (text, numberOfCharacters = 1) {
            const _numberOfCharacters = toNumber(numberOfCharacters);
            if (_numberOfCharacters < 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value is negative. It should be positive or zero.`));
            }
            return toString(text).substring(0, _numberOfCharacters);
        },
    };
    // -----------------------------------------------------------------------------
    // LEN
    // -----------------------------------------------------------------------------
    const LEN = {
        description: _lt("Length of a string."),
        args: args(`
      text (string) ${_lt("The string whose length will be returned.")}
  `),
        returns: ["NUMBER"],
        compute: function (text) {
            return toString(text).length;
        },
    };
    // -----------------------------------------------------------------------------
    // LOWER
    // -----------------------------------------------------------------------------
    const LOWER = {
        description: _lt("Converts a specified string to lowercase."),
        args: args(`
      text (string) ${_lt("The string to convert to lowercase.")}
  `),
        returns: ["STRING"],
        compute: function (text) {
            return toString(text).toLowerCase();
        },
    };
    // -----------------------------------------------------------------------------
    // REPLACE
    // -----------------------------------------------------------------------------
    const REPLACE = {
        description: _lt("Replaces part of a text string with different text."),
        args: args(`
      text (string) ${_lt("The text, a part of which will be replaced.")}
      position (number) ${_lt("The position where the replacement will begin (starting from 1).")}
      length (number) ${_lt("The number of characters in the text to be replaced.")}
      new_text (string) ${_lt("The text which will be inserted into the original text.")}
  `),
        returns: ["STRING"],
        compute: function (text, position, length, newText) {
            const _position = toNumber(position);
            if (_position < 1) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value is ${_position}. It should be greater than or equal to 1.`));
            }
            const _text = toString(text);
            const _length = toNumber(length);
            const _newText = toString(newText);
            return _text.substring(0, _position - 1) + _newText + _text.substring(_position - 1 + _length);
        },
    };
    // -----------------------------------------------------------------------------
    // RIGHT
    // -----------------------------------------------------------------------------
    const RIGHT = {
        description: _lt("A substring from the end of a specified string."),
        args: args(`
      text (string) ${_lt("The string from which the right portion will be returned.")}
      number_of_characters (number, default=1) ${_lt("The number of characters to return from the right side of string.")}
  `),
        returns: ["STRING"],
        compute: function (text, numberOfCharacters = 1) {
            const _numberOfCharacters = toNumber(numberOfCharacters);
            if (_numberOfCharacters < 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value is negative. It should be positive or zero.`));
            }
            const _text = toString(text);
            const stringLength = _text.length;
            return _text.substring(stringLength - _numberOfCharacters, stringLength);
        },
    };
    // -----------------------------------------------------------------------------
    // SEARCH
    // -----------------------------------------------------------------------------
    const SEARCH = {
        description: _lt("First position of string found in text, ignoring case."),
        args: args(`
      search_for (string) ${_lt("The string to look for within text_to_search.")}
      text_to_search (string) ${_lt("The text to search for the first occurrence of search_for.")}
      starting_at (number, default=1 ) ${_lt("The character within text_to_search at which to start the search.")}
  `),
        returns: ["NUMBER"],
        compute: function (searchFor, textToDearch, startingAt = 1) {
            const _textToSearch = toString(textToDearch).toLowerCase();
            if (_textToSearch === "") {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 2 value should be non-empty.`));
            }
            const _startingAt = toNumber(startingAt);
            if (_startingAt === 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 3 value is 0. It should be greater than or equal to 1.`));
            }
            const _searchFor = toString(searchFor).toLowerCase();
            const result = _textToSearch.indexOf(_searchFor, _startingAt - 1);
            if (result < 0) {
                throw new Error(_lt("In [[FUNCTION_NAME]] evaluation, cannot find '%s' within '%s'.", _searchFor, _textToSearch));
            }
            return result + 1;
        },
    };
    // -----------------------------------------------------------------------------
    // SUBSTITUTE
    // -----------------------------------------------------------------------------
    const SUBSTITUTE = {
        description: _lt("Replaces existing text with new text in a string."),
        args: args(`
      text_to_search (string) ${_lt("The text within which to search and replace.")}
      search_for (string) ${_lt("The string to search for within text_to_search.")}
      replace_with (string) ${_lt("The string that will replace search_for.")}
      occurrence_number (number, optional) ${_lt("The instance of search_for within text_to_search to replace with replace_with. By default, all occurrences of search_for are replaced; however, if occurrence_number is specified, only the indicated instance of search_for is replaced.")}
  `),
        returns: ["NUMBER"],
        compute: function (textToSearch, searchFor, replaceWith, occurrenceNumber = undefined) {
            const _occurrenceNumber = toNumber(occurrenceNumber);
            if (_occurrenceNumber < 0) {
                throw new Error(_lt(`Function [[FUNCTION_NAME]] parameter 4 value is negative. It should be positive or zero.`));
            }
            const _textToSearch = toString(textToSearch);
            const _searchFor = toString(searchFor);
            if (_searchFor === "") {
                return _textToSearch;
            }
            const _replaceWith = toString(replaceWith);
            const reg = new RegExp(_searchFor, "g");
            if (_occurrenceNumber === 0) {
                return _textToSearch.replace(reg, _replaceWith);
            }
            let n = 0;
            return _textToSearch.replace(reg, (text) => (++n === _occurrenceNumber ? _replaceWith : text));
        },
    };
    // -----------------------------------------------------------------------------
    // TEXTJOIN
    // -----------------------------------------------------------------------------
    const TEXTJOIN = {
        description: _lt("Combines text from multiple strings and/or arrays."),
        args: args(`
      delimiter (string) ${_lt(" A string, possible empty, or a reference to a valid string. If empty, the text will be simply concatenated.")}
      ignore_empty (bollean) ${_lt("A boolean; if TRUE, empty cells selected in the text arguments won't be included in the result.")}
      text1 (string, range<string>) ${_lt("Any text item. This could be a string, or an array of strings in a range.")}
      text2 (string, range<string>, repeating) ${_lt("Additional text item(s).")}
  `),
        returns: ["STRING"],
        compute: function (delimiter, ignoreEmpty, ...textsOrArrays) {
            const _delimiter = toString(delimiter);
            const _ignoreEmpty = toBoolean(ignoreEmpty);
            let n = 0;
            return reduceArgs(textsOrArrays, (acc, a) => !(_ignoreEmpty && toString(a) === "") ? (n++ ? acc + _delimiter : "") + toString(a) : acc, "");
        },
    };
    // -----------------------------------------------------------------------------
    // TRIM
    // -----------------------------------------------------------------------------
    const TRIM = {
        description: _lt("Removes space characters."),
        args: args(`
      text (string) ${_lt("The text or reference to a cell containing text to be trimmed.")}
  `),
        returns: ["STRING"],
        compute: function (text) {
            return toString(text).trim();
        },
    };
    // -----------------------------------------------------------------------------
    // UPPER
    // -----------------------------------------------------------------------------
    const UPPER = {
        description: _lt("Converts a specified string to uppercase."),
        args: args(`
      text (string) ${_lt("The string to convert to uppercase.")}
  `),
        returns: ["STRING"],
        compute: function (text) {
            return toString(text).toUpperCase();
        },
    };

    var text = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CHAR: CHAR,
        CONCATENATE: CONCATENATE,
        EXACT: EXACT,
        FIND: FIND,
        JOIN: JOIN,
        LEFT: LEFT,
        LEN: LEN,
        LOWER: LOWER,
        REPLACE: REPLACE,
        RIGHT: RIGHT,
        SEARCH: SEARCH,
        SUBSTITUTE: SUBSTITUTE,
        TEXTJOIN: TEXTJOIN,
        TRIM: TRIM,
        UPPER: UPPER
    });

    const functions = {
        database,
        date,
        info,
        lookup,
        logical,
        math,
        operators,
        statistical,
        text,
    };
    //------------------------------------------------------------------------------
    // Function registry
    //------------------------------------------------------------------------------
    class FunctionRegistry extends Registry {
        constructor() {
            super(...arguments);
            this.mapping = {};
        }
        add(name, addDescr) {
            name = name.toUpperCase().replace("_", ".");
            const descr = addMetaInfoFromArg(addDescr);
            validateArguments(descr.args);
            this.mapping[name] = descr.compute;
            super.add(name, descr);
            return this;
        }
    }
    const functionRegistry = new FunctionRegistry();
    for (let category in functions) {
        const fns = functions[category];
        for (let name in fns) {
            const addDescr = fns[name];
            addDescr.category = category;
            functionRegistry.add(name, addDescr);
        }
    }

    /**
     * BasePlugin
     *
     * Since the spreadsheet internal state is quite complex, it is split into
     * multiple parts, each managing a specific concern.
     *
     * This file introduce the BasePlugin, which is the common class that defines
     * how each of these model sub parts should interact with each other.
     * There are two kind of plugins: core plugins handling persistent data
     * and UI plugins handling transient data.
     */
    class BasePlugin {
        constructor(history, dispatch, config) {
            this.history = Object.assign(Object.create(history), {
                update: history.updateStateFromRoot.bind(history, this),
            });
            this.dispatch = dispatch;
            this.currentMode = config.mode;
        }
        // ---------------------------------------------------------------------------
        // Command handling
        // ---------------------------------------------------------------------------
        /**
         * Before a command is accepted, the model will ask each plugin if the command
         * is allowed.  If all of then return true, then we can proceed. Otherwise,
         * the command is cancelled.
         *
         * There should not be any side effects in this method.
         */
        allowDispatch(command) {
            return { status: "SUCCESS" };
        }
        /**
         * This method is useful when a plugin need to perform some action before a
         * command is handled in another plugin. This should only be used if it is not
         * possible to do the work in the handle method.
         */
        beforeHandle(command) { }
        /**
         * This is the standard place to handle any command. Most of the plugin
         * command handling work should take place here.
         */
        handle(command) { }
        /**
         * Sometimes, it is useful to perform some work after a command (and all its
         * subcommands) has been completely handled.  For example, when we paste
         * multiple cells, we only want to reevaluate the cell values once at the end.
         */
        finalize(command) { }
    }
    BasePlugin.getters = [];
    BasePlugin.modes = ["headless", "normal", "readonly"];

    /**
     * Core plugins handle spreadsheet data.
     * They are responsible to import, export and maintain the spreadsheet
     * persisted state.
     * They should not be concerned about UI parts or transient state.
     */
    class CorePlugin extends BasePlugin {
        constructor(getters, history, dispatch, config) {
            super(history, dispatch, config);
            this.getters = getters;
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) { }
        export(data) { }
    }

    /**
     * Formatting plugin.
     *
     * This plugin manages all things related to a cell look:
     * - borders
     */
    class BordersPlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.borders = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "SET_FORMATTING":
                    try {
                        this.getters.getSheet(cmd.sheetId);
                        break;
                    }
                    catch (error) {
                        return { status: "CANCELLED", reason: 15 /* InvalidSheetId */ };
                    }
            }
            return { status: "SUCCESS" };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_MERGE":
                    if (!cmd.interactive) {
                        this.addBordersToMerge(cmd.sheetId, cmd.zone);
                    }
                    break;
                case "SET_BORDER":
                    this.setBorder(cmd.sheetId, cmd.col, cmd.row, cmd.border);
                    break;
                case "SET_FORMATTING":
                    if (cmd.border) {
                        const sheet = this.getters.getSheet(cmd.sheetId);
                        const target = cmd.target.map((zone) => this.getters.expandZone(cmd.sheetId, zone));
                        this.setBorders(sheet, target, cmd.border);
                    }
                    break;
                case "CLEAR_FORMATTING":
                    this.clearBorders(cmd.sheetId, cmd.target);
                    break;
                case "REMOVE_COLUMNS":
                    for (let col of cmd.columns) {
                        this.shiftBordersHorizontally(cmd.sheetId, col + 1, -1);
                    }
                    break;
                case "REMOVE_ROWS":
                    for (let row of cmd.rows) {
                        this.shiftBordersVertically(cmd.sheetId, row + 1, -1);
                    }
                    break;
                case "ADD_COLUMNS":
                    this.handleAddColumns(cmd);
                    break;
                case "ADD_ROWS":
                    this.handleAddRows(cmd);
                    break;
            }
        }
        /**
         * Move borders according to the inserted columns.
         * Ensure borders continuity.
         */
        handleAddColumns(cmd) {
            // The new columns have already been inserted in the sheet at this point.
            const sheet = this.getters.getSheet(cmd.sheetId);
            let colLeftOfInsertion;
            let colRightOfInsertion;
            if (cmd.position === "before") {
                this.shiftBordersHorizontally(cmd.sheetId, cmd.column, cmd.quantity, {
                    moveFirstLeftBorder: true,
                });
                colLeftOfInsertion = cmd.column - 1;
                colRightOfInsertion = cmd.column + cmd.quantity;
            }
            else {
                this.shiftBordersHorizontally(cmd.sheetId, cmd.column + 1, cmd.quantity, {
                    moveFirstLeftBorder: false,
                });
                colLeftOfInsertion = cmd.column;
                colRightOfInsertion = cmd.column + cmd.quantity + 1;
            }
            this.ensureColumnBorderContinuity(sheet, colLeftOfInsertion, colRightOfInsertion);
        }
        /**
         * Move borders according to the inserted rows.
         * Ensure borders continuity.
         */
        handleAddRows(cmd) {
            // The new rows have already been inserted at this point.
            const sheet = this.getters.getSheet(cmd.sheetId);
            let rowAboveInsertion;
            let rowBelowInsertion;
            if (cmd.position === "before") {
                this.shiftBordersVertically(sheet.id, cmd.row, cmd.quantity, { moveFirstTopBorder: true });
                rowAboveInsertion = cmd.row - 1;
                rowBelowInsertion = cmd.row + cmd.quantity;
            }
            else {
                this.shiftBordersVertically(sheet.id, cmd.row + 1, cmd.quantity, {
                    moveFirstTopBorder: false,
                });
                rowAboveInsertion = cmd.row;
                rowBelowInsertion = cmd.row + cmd.quantity + 1;
            }
            this.ensureRowBorderContinuity(sheet, rowAboveInsertion, rowBelowInsertion);
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getCellBorder(sheetId, col, row) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const border = {
                top: (_c = (_b = (_a = this.borders[sheetId]) === null || _a === void 0 ? void 0 : _a[col]) === null || _b === void 0 ? void 0 : _b[row]) === null || _c === void 0 ? void 0 : _c.horizontal,
                bottom: (_f = (_e = (_d = this.borders[sheetId]) === null || _d === void 0 ? void 0 : _d[col]) === null || _e === void 0 ? void 0 : _e[row + 1]) === null || _f === void 0 ? void 0 : _f.horizontal,
                left: (_j = (_h = (_g = this.borders[sheetId]) === null || _g === void 0 ? void 0 : _g[col]) === null || _h === void 0 ? void 0 : _h[row]) === null || _j === void 0 ? void 0 : _j.vertical,
                right: (_m = (_l = (_k = this.borders[sheetId]) === null || _k === void 0 ? void 0 : _k[col + 1]) === null || _l === void 0 ? void 0 : _l[row]) === null || _m === void 0 ? void 0 : _m.vertical,
            };
            if (!border.bottom && !border.left && !border.right && !border.top) {
                return null;
            }
            return border;
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        /**
         * Ensure border continuity between two columns.
         * If the two columns have the same borders (at each row respectively),
         * the same borders are applied to each cell in between.
         */
        ensureColumnBorderContinuity(sheet, leftColumn, rightColumn) {
            const targetCols = range(leftColumn + 1, rightColumn);
            for (let row = 0; row < sheet.rows.length; row++) {
                const leftBorder = this.getCellBorder(sheet.id, leftColumn, row);
                const rightBorder = this.getCellBorder(sheet.id, rightColumn, row);
                if (leftBorder && rightBorder) {
                    const commonSides = this.getCommonSides(leftBorder, rightBorder);
                    for (let col of targetCols) {
                        this.addBorder(sheet.id, col, row, commonSides);
                    }
                }
            }
        }
        /**
         * Ensure border continuity between two rows.
         * If the two rows have the same borders (at each column respectively),
         * the same borders are applied to each cell in between.
         */
        ensureRowBorderContinuity(sheet, topRow, bottomRow) {
            const targetRows = range(topRow + 1, bottomRow);
            for (let col = 0; col < sheet.cols.length; col++) {
                const aboveBorder = this.getCellBorder(sheet.id, col, topRow);
                const belowBorder = this.getCellBorder(sheet.id, col, bottomRow);
                if (aboveBorder && belowBorder) {
                    const commonSides = this.getCommonSides(aboveBorder, belowBorder);
                    for (let row of targetRows) {
                        this.addBorder(sheet.id, col, row, commonSides);
                    }
                }
            }
        }
        /**
         * From two borders, return a new border with sides defined in both borders.
         * i.e. the intersection of two borders.
         */
        getCommonSides(border1, border2) {
            const commonBorder = {};
            for (let side of ["top", "bottom", "left", "right"]) {
                if (border1[side] && border1[side] === border2[side]) {
                    commonBorder[side] = border1[side];
                }
            }
            return commonBorder;
        }
        /**
         * Get all the columns which contains at least a border
         */
        getColumnsWithBorders(sheetId) {
            const sheetBorders = this.borders[sheetId];
            if (!sheetBorders)
                return [];
            return Object.keys(sheetBorders).map((index) => parseInt(index, 10));
        }
        /**
         * Get the range of all the rows in the sheet
         */
        getRowsRange(sheetId) {
            const sheetBorders = this.borders[sheetId];
            if (!sheetBorders)
                return [];
            const sheet = this.getters.getSheet(sheetId);
            return range(0, sheet.rows.length + 1);
        }
        /**
         * Move borders of a sheet horizontally.
         * @param sheetId
         * @param start starting column (included)
         * @param delta how much borders will be moved (negative if moved to the left)
         */
        shiftBordersHorizontally(sheetId, start, delta, { moveFirstLeftBorder } = {}) {
            const borders = this.borders[sheetId];
            if (!borders)
                return;
            if (delta < 0) {
                this.moveBordersOfColumn(sheetId, start, delta, "vertical", {
                    destructive: false,
                });
            }
            this.getColumnsWithBorders(sheetId)
                .filter((col) => col >= start)
                .sort((a, b) => (delta < 0 ? a - b : b - a)) // start by the end when moving up
                .forEach((col) => {
                if ((col === start && moveFirstLeftBorder) || col !== start) {
                    this.moveBordersOfColumn(sheetId, col, delta, "vertical");
                }
                this.moveBordersOfColumn(sheetId, col, delta, "horizontal");
            });
        }
        /**
         * Move borders of a sheet vertically.
         * @param sheetId
         * @param start starting row (included)
         * @param delta how much borders will be moved (negative if moved to the above)
         */
        shiftBordersVertically(sheetId, start, delta, { moveFirstTopBorder } = {}) {
            const borders = this.borders[sheetId];
            if (!borders)
                return;
            if (delta < 0) {
                this.moveBordersOfRow(sheetId, start, delta, "horizontal", {
                    destructive: false,
                });
            }
            this.getRowsRange(sheetId)
                .filter((row) => row >= start)
                .sort((a, b) => (delta < 0 ? a - b : b - a)) // start by the end when moving up
                .forEach((row) => {
                if ((row === start && moveFirstTopBorder) || row !== start) {
                    this.moveBordersOfRow(sheetId, row, delta, "horizontal");
                }
                this.moveBordersOfRow(sheetId, row, delta, "vertical");
            });
        }
        /**
         * Moves the borders (left if `vertical` or top if `horizontal` depending on
         * `borderDirection`) of all cells in an entire row `delta` rows to the right
         * (`delta` > 0) or to the left (`delta` < 0).
         * Note that as the left of a cell is the right of the cell-1, if the left is
         * moved the right is also moved. However, if `horizontal`, the bottom border
         * is not moved.
         * It does it by replacing the target border by the moved border. If the
         * argument `destructive` is given false, the target border is preserved if
         * the moved border is empty
         */
        moveBordersOfRow(sheetId, row, delta, borderDirection, { destructive } = { destructive: true }) {
            const borders = this.borders[sheetId];
            if (!borders)
                return;
            this.getColumnsWithBorders(sheetId).forEach((col) => {
                var _a, _b, _c, _d;
                const targetBorder = (_b = (_a = borders[col]) === null || _a === void 0 ? void 0 : _a[row + delta]) === null || _b === void 0 ? void 0 : _b[borderDirection];
                const movedBorder = (_d = (_c = borders[col]) === null || _c === void 0 ? void 0 : _c[row]) === null || _d === void 0 ? void 0 : _d[borderDirection];
                this.history.update("borders", sheetId, col, row + delta, borderDirection, destructive ? movedBorder : movedBorder || targetBorder);
                this.history.update("borders", sheetId, col, row, borderDirection, undefined);
            });
        }
        /**
         * Moves the borders (left if `vertical` or top if `horizontal` depending on
         * `borderDirection`) of all cells in an entire column `delta` columns below
         * (`delta` > 0) or above (`delta` < 0).
         * Note that as the top of a cell is the bottom of the cell-1, if the top is
         * moved the bottom is also moved. However, if `vertical`, the right border
         * is not moved.
         * It does it by replacing the target border by the moved border. If the
         * argument `destructive` is given false, the target border is preserved if
         * the moved border is empty
         */
        moveBordersOfColumn(sheetId, col, delta, borderDirection, { destructive } = { destructive: true }) {
            const borders = this.borders[sheetId];
            if (!borders)
                return;
            this.getRowsRange(sheetId).forEach((row) => {
                var _a, _b, _c, _d;
                const targetBorder = (_b = (_a = borders[col + delta]) === null || _a === void 0 ? void 0 : _a[row]) === null || _b === void 0 ? void 0 : _b[borderDirection];
                const movedBorder = (_d = (_c = borders[col]) === null || _c === void 0 ? void 0 : _c[row]) === null || _d === void 0 ? void 0 : _d[borderDirection];
                this.history.update("borders", sheetId, col + delta, row, borderDirection, destructive ? movedBorder : movedBorder || targetBorder);
                this.history.update("borders", sheetId, col, row, borderDirection, undefined);
            });
        }
        /**
         * Set the borders of a cell.
         * Note that it override the current border
         */
        setBorder(sheetId, col, row, border) {
            this.history.update("borders", sheetId, col, row, {
                vertical: border === null || border === void 0 ? void 0 : border.left,
                horizontal: border === null || border === void 0 ? void 0 : border.top,
            });
            this.history.update("borders", sheetId, col + 1, row, "vertical", border === null || border === void 0 ? void 0 : border.right);
            this.history.update("borders", sheetId, col, row + 1, "horizontal", border === null || border === void 0 ? void 0 : border.bottom);
        }
        /**
         * Remove the borders of a zone
         */
        clearBorders(sheetId, zones) {
            for (let zone of zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    this.history.update("borders", sheetId, zone.right + 1, row, "vertical", undefined);
                    for (let col = zone.left; col <= zone.right; col++) {
                        this.history.update("borders", sheetId, col, row, undefined);
                    }
                }
                for (let col = zone.left; col <= zone.right; col++) {
                    this.history.update("borders", sheetId, col, zone.bottom + 1, "horizontal", undefined);
                }
            }
        }
        /**
         * Add a border to the existing one to a cell
         */
        addBorder(sheetId, col, row, border) {
            this.setBorder(sheetId, col, row, {
                ...this.getCellBorder(sheetId, col, row),
                ...border,
            });
        }
        /**
         * Set the borders of a zone by computing the borders to add from the given
         * command
         */
        setBorders(sheet, zones, command) {
            const sheetId = sheet.id;
            if (command === "clear") {
                return this.clearBorders(sheetId, zones);
            }
            for (let zone of zones) {
                if (command === "h" || command === "hv" || command === "all") {
                    for (let row = zone.top + 1; row <= zone.bottom; row++) {
                        for (let col = zone.left; col <= zone.right; col++) {
                            this.addBorder(sheetId, col, row, { top: DEFAULT_BORDER_DESC });
                        }
                    }
                }
                if (command === "v" || command === "hv" || command === "all") {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        for (let col = zone.left + 1; col <= zone.right; col++) {
                            this.addBorder(sheetId, col, row, { left: DEFAULT_BORDER_DESC });
                        }
                    }
                }
                if (command === "left" || command === "all" || command === "external") {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        this.addBorder(sheetId, zone.left, row, { left: DEFAULT_BORDER_DESC });
                    }
                }
                if (command === "right" || command === "all" || command === "external") {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        this.addBorder(sheetId, zone.right + 1, row, { left: DEFAULT_BORDER_DESC });
                    }
                }
                if (command === "top" || command === "all" || command === "external") {
                    for (let col = zone.left; col <= zone.right; col++) {
                        this.addBorder(sheetId, col, zone.top, { top: DEFAULT_BORDER_DESC });
                    }
                }
                if (command === "bottom" || command === "all" || command === "external") {
                    for (let col = zone.left; col <= zone.right; col++) {
                        this.addBorder(sheetId, col, zone.bottom + 1, { top: DEFAULT_BORDER_DESC });
                    }
                }
            }
        }
        /**
         * Compute the borders to add to the given zone merged.
         */
        addBordersToMerge(sheetId, zone) {
            const sheet = this.getters.getSheet(sheetId);
            const { left, right, top, bottom } = zone;
            const bordersTopLeft = this.getCellBorder(sheet.id, left, top);
            const bordersBottomRight = this.getCellBorder(sheet.id, right, bottom);
            this.clearBorders(sheetId, [zone]);
            if (bordersTopLeft === null || bordersTopLeft === void 0 ? void 0 : bordersTopLeft.top) {
                this.setBorders(sheet, [{ ...zone, bottom: top }], "top");
            }
            if (bordersTopLeft === null || bordersTopLeft === void 0 ? void 0 : bordersTopLeft.left) {
                this.setBorders(sheet, [{ ...zone, right: left }], "left");
            }
            if ((bordersBottomRight === null || bordersBottomRight === void 0 ? void 0 : bordersBottomRight.bottom) || (bordersTopLeft === null || bordersTopLeft === void 0 ? void 0 : bordersTopLeft.bottom)) {
                this.setBorders(sheet, [{ ...zone, top: bottom }], "bottom");
            }
            if ((bordersBottomRight === null || bordersBottomRight === void 0 ? void 0 : bordersBottomRight.right) || (bordersTopLeft === null || bordersTopLeft === void 0 ? void 0 : bordersTopLeft.right)) {
                this.setBorders(sheet, [{ ...zone, left: right }], "right");
            }
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            // Borders
            if (data.borders) {
                for (let sheet of data.sheets) {
                    for (let [xc, cell] of Object.entries(sheet.cells)) {
                        if (cell === null || cell === void 0 ? void 0 : cell.border) {
                            const border = data.borders[cell.border];
                            const [col, row] = toCartesian(xc);
                            this.setBorder(sheet.id, col, row, border);
                        }
                    }
                }
            }
            // Merges
            for (let sheetData of data.sheets) {
                if (sheetData.merges) {
                    for (let merge of sheetData.merges) {
                        this.addBordersToMerge(sheetData.id, toZone(merge));
                    }
                }
            }
        }
        export(data) {
            // Borders
            let borderId = 0;
            const borders = {};
            /**
             * Get the id of the given border. If the border does not exist, it creates
             * one.
             */
            function getBorderId(border) {
                for (let [key, value] of Object.entries(borders)) {
                    if (stringify(value) === stringify(border)) {
                        return parseInt(key, 10);
                    }
                }
                borders[++borderId] = border;
                return borderId;
            }
            for (let sheet of data.sheets) {
                for (let col = 0; col < sheet.colNumber; col++) {
                    for (let row = 0; row < sheet.rowNumber; row++) {
                        const border = this.getCellBorder(sheet.id, col, row);
                        if (border) {
                            const xc = toXC(col, row);
                            const cell = sheet.cells[xc];
                            const borderId = getBorderId(border);
                            if (cell) {
                                cell.border = borderId;
                            }
                            else {
                                sheet.cells[xc] = { border: borderId };
                            }
                        }
                    }
                }
            }
            data.borders = borders;
        }
    }
    BordersPlugin.getters = ["getCellBorder"];

    /**
     * Tokenizer
     *
     * A tokenizer is a piece of code whose job is to transform a string into a list
     * of "tokens". For example, "(12+" is converted into:
     *   [{type: "LEFT_PAREN", value: "("},
     *    {type: "NUMBER", value: "12"},
     *    {type: "OPERATOR", value: "+"}]
     *
     * As the example shows, a tokenizer does not care about the meaning behind those
     * tokens. It only cares about the structure.
     *
     * The tokenizer is usually the first step in a compilation pipeline.  Also, it
     * is useful for the composer, which needs to be able to work with incomplete
     * formulas.
     */
    const functions$1 = functionRegistry.content;
    const OPERATORS = "+,-,*,/,:,=,<>,>=,>,<=,<,%,^,&".split(",");
    function tokenize(str) {
        const chars = str.split("");
        const result = [];
        let tokenCount = 0;
        while (chars.length) {
            tokenCount++;
            if (tokenCount > 100) {
                throw new Error(_lt("This formula has over 100 parts. It can't be processed properly, consider splitting it into multiple cells"));
            }
            let token = tokenizeSpace(chars) ||
                tokenizeMisc(chars) ||
                tokenizeOperator(chars) ||
                tokenizeNumber(chars) ||
                tokenizeString(chars) ||
                tokenizeDebugger(chars) ||
                tokenizeNormalizedReferences(chars) ||
                tokenizeSymbol(chars);
            if (!token) {
                token = { type: "UNKNOWN", value: chars.shift() };
            }
            result.push(token);
        }
        return result;
    }
    const FORMULA_REF_IDENTIFIER = "|";
    function tokenizeNormalizedReferences(chars) {
        if (chars[0] === FORMULA_REF_IDENTIFIER) {
            chars.shift(); // consume the | even if it is incorrect
            const match = chars.join("").match(formulaNumberRegexp);
            if (match) {
                chars.splice(0, match[0].length);
            }
            else {
                return null;
            }
            if (chars[0] === FORMULA_REF_IDENTIFIER) {
                chars.shift();
            }
            return { type: "REFERENCE", value: match[0] };
        }
        return null;
    }
    function tokenizeDebugger(chars) {
        if (chars[0] === "?") {
            chars.shift();
            return { type: "DEBUGGER", value: "?" };
        }
        return null;
    }
    const misc = {
        ",": "COMMA",
        "(": "LEFT_PAREN",
        ")": "RIGHT_PAREN",
    };
    function tokenizeMisc(chars) {
        if (chars[0] in misc) {
            const value = chars.shift();
            const type = misc[value];
            return { type, value };
        }
        return null;
    }
    function startsWith(chars, op) {
        for (let i = 0; i < op.length; i++) {
            if (op[i] !== chars[i]) {
                return false;
            }
        }
        return true;
    }
    function tokenizeOperator(chars) {
        for (let op of OPERATORS) {
            if (startsWith(chars, op)) {
                chars.splice(0, op.length);
                return { type: "OPERATOR", value: op };
            }
        }
        return null;
    }
    function tokenizeNumber(chars) {
        const match = chars.join("").match(formulaNumberRegexp);
        if (match) {
            chars.splice(0, match[0].length);
            return { type: "NUMBER", value: match[0] };
        }
        return null;
    }
    function tokenizeString(chars) {
        if (chars[0] === '"') {
            const startChar = chars.shift();
            const letters = [startChar];
            while (chars[0] && (chars[0] !== startChar || letters[letters.length - 1] === "\\")) {
                letters.push(chars.shift());
            }
            if (chars[0] === '"') {
                letters.push(chars.shift());
            }
            return {
                type: "STRING",
                value: letters.join(""),
            };
        }
        return null;
    }
    const separatorRegexp = /\w|\.|!|\$/;
    /**
     * A "Symbol" is just basically any word-like element that can appear in a
     * formula, which is not a string. So:
     *   A1
     *   SUM
     *   CEILING.MATH
     *   A$1
     *   Sheet2!A2
     *   'Sheet 2'!A2
     *
     * are examples of symbols
     */
    function tokenizeSymbol(chars) {
        const result = [];
        // there are two main cases to manage: either something which starts with
        // a ', like 'Sheet 2'A2, or a word-like element.
        if (chars[0] === "'") {
            let lastChar = chars.shift();
            result.push(lastChar);
            while (chars[0]) {
                lastChar = chars.shift();
                result.push(lastChar);
                if (lastChar === "'") {
                    if (chars[0] && chars[0] === "'") {
                        lastChar = chars.shift();
                        result.push(lastChar);
                    }
                    else {
                        break;
                    }
                }
            }
            if (lastChar !== "'") {
                return {
                    type: "UNKNOWN",
                    value: result.join(""),
                };
            }
        }
        while (chars[0] && chars[0].match(separatorRegexp)) {
            result.push(chars.shift());
        }
        if (result.length) {
            const value = result.join("");
            const isFunction = value.toUpperCase() in functions$1;
            const type = isFunction ? "FUNCTION" : "SYMBOL";
            return { type, value };
        }
        return null;
    }
    const whiteSpaceRegexp = /\s/;
    function tokenizeSpace(chars) {
        let length = 0;
        while (chars[0] && chars[0].match(whiteSpaceRegexp)) {
            length++;
            chars.shift();
        }
        if (length) {
            return { type: "SPACE", value: " ".repeat(length) };
        }
        return null;
    }

    const functions$2 = functionRegistry.content;
    const UNARY_OPERATORS = ["-", "+"];
    const OP_PRIORITY = {
        "^": 30,
        "*": 20,
        "/": 20,
        ">": 10,
        "<>": 10,
        ">=": 10,
        "<": 10,
        "<=": 10,
        "=": 10,
        "-": 7,
    };
    const FUNCTION_BP = 6;
    function bindingPower(token) {
        switch (token.type) {
            case "NUMBER":
            case "SYMBOL":
                return 0;
            case "COMMA":
                return 3;
            case "LEFT_PAREN":
                return 5;
            case "RIGHT_PAREN":
                return 5;
            case "OPERATOR":
                return OP_PRIORITY[token.value] || 15;
        }
        throw new Error("?");
    }
    const cellReference = new RegExp(/\$?[A-Z]+\$?[0-9]+/, "i");
    const rangeReference = new RegExp(/^\s*(.*!)?\$?[A-Z]+\$?[0-9]+\s*(\s*:\s*\$?[A-Z]+\$?[0-9]+\s*)?$/, "i");
    function parsePrefix(current, tokens) {
        switch (current.type) {
            case "DEBUGGER":
                const next = parseExpression(tokens, 1000);
                next.debug = true;
                return next;
            case "NUMBER":
                return { type: current.type, value: parseNumber(current.value) };
            case "STRING":
                return { type: current.type, value: current.value };
            case "FUNCTION":
                if (tokens.shift().type !== "LEFT_PAREN") {
                    throw new Error(_lt("wrong function call"));
                }
                else {
                    const args = [];
                    if (tokens[0].type !== "RIGHT_PAREN") {
                        if (tokens[0].type === "COMMA") {
                            args.push({ type: "UNKNOWN", value: "" });
                        }
                        else {
                            args.push(parseExpression(tokens, FUNCTION_BP));
                        }
                        while (tokens[0].type === "COMMA") {
                            tokens.shift();
                            if (tokens[0].type === "RIGHT_PAREN") {
                                args.push({ type: "UNKNOWN", value: "" });
                                break;
                            }
                            if (tokens[0].type === "COMMA") {
                                args.push({ type: "UNKNOWN", value: "" });
                            }
                            else {
                                args.push(parseExpression(tokens, FUNCTION_BP));
                            }
                        }
                    }
                    if (tokens.shift().type !== "RIGHT_PAREN") {
                        throw new Error(_lt("wrong function call"));
                    }
                    const isAsync = functions$2[current.value.toUpperCase()].async;
                    const type = isAsync ? "ASYNC_FUNCALL" : "FUNCALL";
                    return { type, value: current.value, args };
                }
            case "REFERENCE":
                return {
                    type: "REFERENCE",
                    value: parseInt(current.value, 10),
                };
            case "SYMBOL":
                if (["TRUE", "FALSE"].includes(current.value.toUpperCase())) {
                    return { type: "BOOLEAN", value: current.value.toUpperCase() === "TRUE" };
                }
                else {
                    if (current.value) {
                        throw new Error(_lt("Invalid formula"));
                    }
                    return { type: "UNKNOWN", value: current.value };
                }
            case "LEFT_PAREN":
                const result = parseExpression(tokens, 5);
                if (!tokens.length || tokens[0].type !== "RIGHT_PAREN") {
                    throw new Error(_lt("unmatched left parenthesis"));
                }
                tokens.shift();
                return result;
            default:
                if (current.type === "OPERATOR" && UNARY_OPERATORS.includes(current.value)) {
                    return {
                        type: "UNARY_OPERATION",
                        value: current.value,
                        right: parseExpression(tokens, 15),
                    };
                }
                throw new Error(_lt("nope")); //todo: provide explicit error
        }
    }
    function parseInfix(left, current, tokens) {
        if (current.type === "OPERATOR") {
            const bp = bindingPower(current);
            const right = parseExpression(tokens, bp);
            return {
                type: "BIN_OPERATION",
                value: current.value,
                left,
                right,
            };
        }
        throw new Error(_lt("nope")); //todo: provide explicit error
    }
    function parseExpression(tokens, bp) {
        const token = tokens.shift();
        let expr = parsePrefix(token, tokens);
        while (tokens[0] && bindingPower(tokens[0]) > bp) {
            expr = parseInfix(expr, tokens.shift(), tokens);
        }
        return expr;
    }
    /**
     * Parse an expression (as a string) into an AST.
     */
    function parse(str) {
        const tokens = tokenize(str).filter((x) => x.type !== "SPACE");
        if (tokens[0].type === "OPERATOR" && tokens[0].value === "=") {
            tokens.splice(0, 1);
        }
        const result = parseExpression(tokens, 0);
        if (tokens.length) {
            throw new Error(_lt("invalid expression"));
        }
        return result;
    }
    /**
     * Converts an ast formula to the corresponding string
     */
    function astToFormula(ast) {
        switch (ast.type) {
            case "FUNCALL":
            case "ASYNC_FUNCALL":
                const args = ast.args.map((arg) => astToFormula(arg));
                return `${ast.value}(${args.join(",")})`;
            case "NUMBER":
                return ast.value.toString();
            case "STRING":
                return ast.value;
            case "BOOLEAN":
                return ast.value ? "TRUE" : "FALSE";
            case "UNARY_OPERATION":
                return ast.value + astToFormula(ast.right);
            case "BIN_OPERATION":
                return astToFormula(ast.left) + ast.value + astToFormula(ast.right);
            case "REFERENCE":
                return `${FORMULA_REF_IDENTIFIER}${ast.value}${FORMULA_REF_IDENTIFIER}`;
            default:
                return ast.value;
        }
    }

    const functions$3 = functionRegistry.content;
    const OPERATOR_MAP = {
        "=": "EQ",
        "+": "ADD",
        "-": "MINUS",
        "*": "MULTIPLY",
        "/": "DIVIDE",
        ">=": "GTE",
        "<>": "NE",
        ">": "GT",
        "<=": "LTE",
        "<": "LT",
        "^": "POWER",
        "&": "CONCATENATE",
    };
    const UNARY_OPERATOR_MAP = {
        "-": "UMINUS",
        "+": "UPLUS",
    };
    // this cache contains all compiled function code, grouped by "structure". For
    // example, "=2*sum(A1:A4)" and "=2*sum(B1:B4)" are compiled into the same
    // structural function.
    // It is only exported for testing purposes
    const functionCache = {};
    // -----------------------------------------------------------------------------
    // COMPILER
    // -----------------------------------------------------------------------------
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    function compile(str) {
        let isAsync = false;
        if (!functionCache[str.text]) {
            const ast = parse(str.text);
            let nextId = 1;
            const code = [`// ${str.text}`];
            if (ast.type === "BIN_OPERATION" && ast.value === ":") {
                throw new Error(_lt("Invalid formula"));
            }
            if (ast.type === "UNKNOWN") {
                throw new Error(_lt("Invalid formula"));
            }
            code.push(`return ${compileAST(ast)};`);
            const Constructor = isAsync ? AsyncFunction : Function;
            let baseFunction = new Constructor("deps", // the dependencies in the current formula
            "sheetId", // the sheet the formula is currently evaluating
            "ref", // a function to access a certain dependency at a given index
            "range", // same as above, but guarantee that the result is in the form of a range
            "ctx", code.join("\n"));
            functionCache[str.text] = baseFunction;
            functionCache[str.text].async = isAsync;
            functionCache[str.text].dependenciesFormat = formatAST(ast);
            /**
             * This function compile the function arguments. It is mostly straightforward,
             * except that there is a non trivial transformation in one situation:
             *
             * If a function argument is asking for a range, and get a cell, we transform
             * the cell value into a range. This allow the grid model to differentiate
             * between a cell value and a non cell value.
             */
            function compileFunctionArgs(ast) {
                const functionDefinition = functions$3[ast.value.toUpperCase()];
                const currentFunctionArguments = ast.args;
                // check if arguments are supplied in the correct quantities
                const nbrArg = currentFunctionArguments.length;
                if (nbrArg < functionDefinition.minArgRequired) {
                    throw new Error(_lt("Invalid number of arguments for the %s function. Expected %s minimum, but got %s instead.", ast.value.toUpperCase(), functionDefinition.minArgRequired.toString(), nbrArg.toString()));
                }
                if (nbrArg > functionDefinition.maxArgPossible) {
                    throw new Error(_lt("Invalid number of arguments for the %s function. Expected %s maximum, but got %s instead.", ast.value.toUpperCase(), functionDefinition.maxArgPossible.toString(), nbrArg.toString()));
                }
                const repeatingArg = functionDefinition.nbrArgRepeating;
                if (repeatingArg > 1) {
                    const argBeforeRepeat = functionDefinition.args.length - repeatingArg;
                    const nbrRepeatingArg = nbrArg - argBeforeRepeat;
                    if (nbrRepeatingArg % repeatingArg !== 0) {
                        throw new Error(_lt("Invalid number of arguments for the %s function. Expected all arguments after position %s to be supplied by groups of %s arguments", ast.value.toUpperCase(), argBeforeRepeat.toString(), repeatingArg.toString()));
                    }
                }
                let listArgs = [];
                for (let i = 0; i < nbrArg; i++) {
                    const argPosition = functionDefinition.getArgToFocus(i + 1) - 1;
                    if (0 <= argPosition && argPosition < functionDefinition.args.length) {
                        const currentArg = currentFunctionArguments[i];
                        const argDefinition = functionDefinition.args[argPosition];
                        const argTypes = argDefinition.type;
                        // detect when an argument need to be evaluated as a meta argument
                        const isMeta = argTypes.includes("META");
                        // detect when an argument need to be evaluated as a lazy argument
                        const isLazy = argDefinition.lazy;
                        // compile arguments
                        let argValue = compileAST(currentArg, isLazy, isMeta);
                        // asking for a range & get a cell --> transform cell value into a range
                        if (currentArg.type === "REFERENCE") {
                            const hasRange = argTypes.find((t) => t === "RANGE" ||
                                t === "RANGE<BOOLEAN>" ||
                                t === "RANGE<NUMBER>" ||
                                t === "RANGE<STRING>");
                            if (hasRange) {
                                argValue = `range(${currentArg.value}, deps, sheetId)`;
                            }
                        }
                        listArgs.push(argValue);
                    }
                }
                return listArgs;
            }
            /**
             * This function compiles all the information extracted by the parser into an
             * executable code for the evaluation of the cells content. It uses a cash to
             * not reevaluate identical code structures.
             *
             * The function is sensitive to two parameters “isLazy” and “isMeta”. These
             * parameters may vary when compiling function arguments:
             *
             * - isLazy: In some cases the function arguments does not need to be
             * evaluated before entering the functions. For example the IF function might
             * take invalid arguments that do not need to be evaluate and thus should not
             * create an error. For this we have lazy arguments.
             *
             * - isMeta: In some cases the function arguments expects information on the
             * cell/range other than the associated value(s). For example the COLUMN
             * function needs to receive as argument the coordinates of a cell rather
             * than its value. For this we have meta arguments.
             */
            function compileAST(ast, isLazy = false, isMeta = false) {
                let id, left, right, args, fnName, statement;
                if (ast.type !== "REFERENCE" && !(ast.type === "BIN_OPERATION" && ast.value === ":")) {
                    if (isMeta) {
                        throw new Error(_lt(`Argument must be a reference to a cell or range.`));
                    }
                }
                if (ast.debug) {
                    code.push("debugger;");
                }
                switch (ast.type) {
                    case "BOOLEAN":
                    case "NUMBER":
                    case "STRING":
                        if (!isLazy) {
                            return ast.value;
                        }
                        id = nextId++;
                        statement = `${ast.value}`;
                        break;
                    case "REFERENCE":
                        const referenceIndex = str.dependencies[ast.value];
                        if (!referenceIndex) {
                            id = nextId++;
                            statement = `null`;
                            break;
                        }
                        id = nextId++;
                        if (isMeta) {
                            statement = `ref(${ast.value}, deps, sheetId, ${isMeta})`;
                        }
                        else {
                            statement = `ref(${ast.value}, deps, sheetId)`;
                        }
                        break;
                    case "FUNCALL":
                        id = nextId++;
                        args = compileFunctionArgs(ast);
                        fnName = ast.value.toUpperCase();
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `ctx['${fnName}'](${args})`;
                        break;
                    case "ASYNC_FUNCALL":
                        id = nextId++;
                        isAsync = true;
                        args = compileFunctionArgs(ast);
                        fnName = ast.value.toUpperCase();
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `await ctx['${fnName}'](${args})`;
                        break;
                    case "UNARY_OPERATION":
                        id = nextId++;
                        right = compileAST(ast.right);
                        fnName = UNARY_OPERATOR_MAP[ast.value];
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `ctx['${fnName}']( ${right})`;
                        break;
                    case "BIN_OPERATION":
                        id = nextId++;
                        left = compileAST(ast.left);
                        right = compileAST(ast.right);
                        fnName = OPERATOR_MAP[ast.value];
                        code.push(`ctx.__lastFnCalled = '${fnName}'`);
                        statement = `ctx['${fnName}'](${left}, ${right})`;
                        break;
                    case "UNKNOWN":
                        if (!isLazy) {
                            return "null";
                        }
                        id = nextId++;
                        statement = `null`;
                        break;
                }
                code.push(`let _${id} = ` + (isLazy ? `()=> ` : ``) + statement);
                return `_${id}`;
            }
            /** Return a stack of formats corresponding to the priorities in which
             * formats should be tested.
             *
             * If the value of the stack is a number it corresponds to a dependency from
             * which the format can be inferred.
             *
             * If the value is a string it corresponds to a literal format which can be
             * applied directly.
             * */
            function formatAST(ast) {
                let fnDef;
                switch (ast.type) {
                    case "REFERENCE":
                        const referenceIndex = str.dependencies[ast.value];
                        if (referenceIndex) {
                            return [ast.value];
                        }
                        break;
                    case "FUNCALL":
                    case "ASYNC_FUNCALL":
                        fnDef = functions$3[ast.value.toUpperCase()];
                        if (fnDef.returnFormat) {
                            if (fnDef.returnFormat === "FormatFromArgument") {
                                if (ast.args.length > 0) {
                                    const argPosition = 0;
                                    const argType = fnDef.args[argPosition].type;
                                    if (!argType.includes("META")) {
                                        return formatAST(ast.args[argPosition]);
                                    }
                                }
                            }
                            else {
                                return [fnDef.returnFormat.specificFormat];
                            }
                        }
                        break;
                    case "UNARY_OPERATION":
                        return formatAST(ast.right);
                    case "BIN_OPERATION":
                        // the BIN_OPERATION ast is the only function case where we will look
                        // at the following argument when the current argument has't format.
                        // So this is the only place where the stack can grow.
                        fnDef = functions$3[OPERATOR_MAP[ast.value]];
                        if (fnDef.returnFormat) {
                            if (fnDef.returnFormat === "FormatFromArgument") {
                                const left = formatAST(ast.left);
                                // as a string represents a safe format, we don't need to know the
                                // format of the following arguments.
                                if (typeof left[left.length - 1] === "string") {
                                    return left;
                                }
                                const right = formatAST(ast.right);
                                return left.concat(right);
                            }
                            else {
                                return [fnDef.returnFormat.specificFormat];
                            }
                        }
                        break;
                }
                return [];
            }
        }
        return functionCache[str.text];
    }

    /**
     * Add the following information on tokens:
     * - length
     * - start
     * - end
     */
    function enrichTokens(tokens) {
        let current = 0;
        return tokens.map((x) => {
            const len = x.value.toString().length;
            const token = Object.assign({}, x, {
                start: current,
                end: current + len,
                length: len,
            });
            current = token.end;
            return token;
        });
    }
    /**
     * Remove information added on EnrichedToken to make a Token
     */
    function toSimpleTokens(composerTokens) {
        return composerTokens.map((x) => {
            return {
                type: x.type,
                value: x.value,
            };
        });
    }
    /**
     * finds a sequence of token that represent a range and replace them with a single token
     * The range can be
     *  ?spaces symbol ?spaces operator: ?spaces symbol ?spaces
     */
    function mergeSymbolsIntoRanges(result, removeSpace = false) {
        let operator = undefined;
        let refStart = undefined;
        let refEnd = undefined;
        let startIncludingSpaces = undefined;
        const reset = () => {
            startIncludingSpaces = undefined;
            refStart = undefined;
            operator = undefined;
            refEnd = undefined;
        };
        for (let i = 0; i < result.length; i++) {
            const token = result[i];
            if (startIncludingSpaces) {
                if (refStart) {
                    if (token.type === "SPACE") {
                        continue;
                    }
                    else if (token.type === "OPERATOR" && token.value === ":") {
                        operator = i;
                    }
                    else if (operator && token.type === "SYMBOL") {
                        refEnd = i;
                    }
                    else {
                        if (startIncludingSpaces && refStart && operator && refEnd) {
                            const newToken = {
                                type: "SYMBOL",
                                start: result[startIncludingSpaces].start,
                                end: result[i - 1].end,
                                length: result[i - 1].end - result[startIncludingSpaces].start,
                                value: result
                                    .slice(startIncludingSpaces, i)
                                    .filter((x) => !removeSpace || x.type !== "SPACE")
                                    .map((x) => x.value)
                                    .join(""),
                            };
                            result.splice(startIncludingSpaces, i - startIncludingSpaces, newToken);
                            i = startIncludingSpaces + 1;
                            reset();
                        }
                        else {
                            if (token.type === "SYMBOL") {
                                startIncludingSpaces = i;
                                refStart = i;
                                operator = undefined;
                            }
                            else {
                                reset();
                            }
                        }
                    }
                }
                else {
                    if (token.type === "SYMBOL") {
                        refStart = i;
                        operator = refEnd = undefined;
                    }
                    else {
                        reset();
                    }
                }
            }
            else {
                if (["SPACE", "SYMBOL"].includes(token.type)) {
                    startIncludingSpaces = i;
                    refStart = token.type === "SYMBOL" ? i : undefined;
                    operator = refEnd = undefined;
                }
                else {
                    reset();
                }
            }
        }
        const i = result.length - 1;
        if (startIncludingSpaces && refStart && operator && refEnd) {
            const newToken = {
                type: "SYMBOL",
                start: result[startIncludingSpaces].start,
                end: result[i].end,
                length: result[i].end - result[startIncludingSpaces].start,
                value: result
                    .slice(startIncludingSpaces, i + 1)
                    .filter((x) => !removeSpace || x.type !== "SPACE")
                    .map((x) => x.value)
                    .join(""),
            };
            result.splice(startIncludingSpaces, i - startIncludingSpaces + 1, newToken);
        }
        return result;
    }
    /**
     * Take the result of the tokenizer and transform it to be usable in the
     * manipulations of range
     *
     * @param formula
     */
    function rangeTokenize(formula) {
        const tokens = tokenize(formula);
        return toSimpleTokens(mergeSymbolsIntoRanges(enrichTokens(tokens), true));
    }

    /**
     * Take the result of the tokenizer and transform it to be usable in the composer.
     *
     * @param formula
     */
    function composerTokenize(formula) {
        const tokens = tokenize(formula);
        return mapParentFunction(mergeSymbolsIntoRanges(mapParenthesis(enrichTokens(tokens))));
    }
    /**
     * add on each token the length, start and end
     * also matches the opening to its closing parenthesis (using the same number)
     */
    function mapParenthesis(tokens) {
        let maxParen = 1;
        const stack = [];
        return tokens.map((token) => {
            if (token.type === "LEFT_PAREN") {
                stack.push(maxParen);
                token.parenIndex = maxParen;
                maxParen++;
            }
            else if (token.type === "RIGHT_PAREN") {
                token.parenIndex = stack.pop();
            }
            return token;
        });
    }
    /**
     * add on each token its parent function and the index corresponding to
     * its position as an argument of the function.
     * In this example "=MIN(42,SUM(MAX(1,2),3))":
     * - the parent function of the token correspond to number 42 is the MIN function
     * - the argument position of the token correspond to number 42 is 0
     * - the parent function of the token correspond to number 3 is the SUM function
     * - the argument position of the token correspond to number 3 is 1
     */
    function mapParentFunction(tokens) {
        let stack = [];
        let functionStarted = "";
        const res = tokens.map((token, i) => {
            if (!["SPACE", "LEFT_PAREN"].includes(token.type)) {
                functionStarted = "";
            }
            switch (token.type) {
                case "FUNCTION":
                    functionStarted = token.value;
                    break;
                case "LEFT_PAREN":
                    stack.push({ parent: functionStarted, argPosition: 0 });
                    functionStarted = "";
                    break;
                case "RIGHT_PAREN":
                    stack.pop();
                    break;
                case "COMMA":
                    if (stack.length) {
                        // increment position on current function
                        stack[stack.length - 1].argPosition++;
                    }
                    break;
            }
            if (stack.length) {
                const functionContext = stack[stack.length - 1];
                if (functionContext.parent) {
                    token.functionContext = Object.assign({}, functionContext);
                }
            }
            return token;
        });
        return res;
    }

    /**
     * parses a formula (as a string) into the same formula,
     * but with the references to other cells extracted
     *
     * =sum(a3:b1) + c3 --> =sum(|0|) + |1|
     *
     * @param formula
     */
    function normalize(formula) {
        const tokens = rangeTokenize(formula);
        let references = [];
        let noRefFormula = "".concat(...tokens.map((token) => {
            if (token.type === "SYMBOL" && cellReference.test(token.value)) {
                const value = token.value.trim();
                if (!references.includes(value)) {
                    references.push(value);
                }
                return `${FORMULA_REF_IDENTIFIER}${references.indexOf(value)}${FORMULA_REF_IDENTIFIER}`;
            }
            else {
                return token.value;
            }
        }));
        return { text: noRefFormula, dependencies: references };
    }

    const nbspRegexp = new RegExp(String.fromCharCode(160), "g");
    /**
     * Core Plugin
     *
     * This is the most fundamental of all plugins. It defines how to interact with
     * cell and sheet content.
     */
    class CellPlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.cells = {};
            this.NULL_FORMAT = "";
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "SET_FORMATTING":
                    if (cmd.style) {
                        this.setStyle(cmd.sheetId, cmd.target, cmd.style);
                    }
                    break;
                case "SET_DECIMAL":
                    this.setDecimal(cmd.sheetId, cmd.target, cmd.step);
                    break;
                case "SET_FORMATTER":
                    this.setFormatter(cmd.sheetId, cmd.target, cmd.formatter);
                    break;
                case "CLEAR_FORMATTING":
                    this.clearStyles(cmd.sheetId, cmd.target);
                    break;
                case "ADD_COLUMNS":
                    this.handleAddColumns(cmd);
                    break;
                case "ADD_ROWS":
                    this.handleAddRows(cmd);
                    break;
                case "UPDATE_CELL":
                    this.updateCell(this.getters.getSheet(cmd.sheetId), cmd.col, cmd.row, cmd);
                    break;
                case "CLEAR_CELL":
                    this.dispatch("UPDATE_CELL", {
                        sheetId: cmd.sheetId,
                        col: cmd.col,
                        row: cmd.row,
                        content: "",
                        style: undefined,
                        format: "",
                    });
                    break;
            }
        }
        /**
         * Set a format to all the cells in a zone
         */
        setFormatter(sheetId, zones, format) {
            for (let zone of zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    for (let col = zone.left; col <= zone.right; col++) {
                        this.dispatch("UPDATE_CELL", {
                            sheetId,
                            col,
                            row,
                            format,
                        });
                    }
                }
            }
        }
        /**
         * This function allows to adjust the quantity of decimal places after a decimal
         * point on cells containing number value. It does this by changing the cells
         * format. Values aren't modified.
         *
         * The change of the decimal quantity is done one by one, the sign of the step
         * variable indicates whether we are increasing or decreasing.
         *
         * If several cells are in the zone, the format resulting from the change of the
         * first cell (with number type) will be applied to the whole zone.
         */
        setDecimal(sheetId, zones, step) {
            // Find the first cell with a number value and get the format
            const numberFormat = this.searchNumberFormat(sheetId, zones);
            if (numberFormat !== undefined) {
                // Depending on the step sign, increase or decrease the decimal representation
                // of the format
                const newFormat = this.changeDecimalFormat(numberFormat, step);
                // Apply the new format on the whole zone
                this.setFormatter(sheetId, zones, newFormat);
            }
        }
        /**
         * Take a range of cells and return the format of the first cell containing a
         * number value. Returns a default format if the cell hasn't format. Returns
         * undefined if no number value in the range.
         */
        searchNumberFormat(sheetId, zones) {
            var _a;
            for (let zone of zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    for (let col = zone.left; col <= zone.right; col++) {
                        const cell = this.getters.getCell(sheetId, col, row);
                        if (cell &&
                            (cell.type === CellType.number ||
                                (cell.type === CellType.formula && typeof cell.value === "number")) &&
                            !((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT)) // reject dates
                        ) {
                            return cell.format || this.setDefaultNumberFormat(cell.value);
                        }
                    }
                }
            }
            return undefined;
        }
        /**
         * Function used to give the default format of a cell with a number for value.
         * It is considered that the default format of a number is 0 followed by as many
         * 0 as there are decimal places.
         *
         * Example:
         * - 1 --> '0'
         * - 123 --> '0'
         * - 12345 --> '0'
         * - 42.1 --> '0.0'
         * - 456.0001 --> '0.0000'
         */
        setDefaultNumberFormat(cellValue) {
            const strValue = cellValue.toString();
            const parts = strValue.split(".");
            if (parts.length === 1) {
                return "0";
            }
            return "0." + Array(parts[1].length + 1).join("0");
        }
        /**
         * This function take a cell format representation and return a new format representation
         * with more or less decimal places.
         *
         * If the format doesn't look like a digital format (means that not contain '0')
         * or if this one cannot be increased or decreased, the returned format will be
         * the same.
         *
         * This function aims to work with all possible formats as well as custom formats.
         *
         * Examples of format changed by this function:
         * - "0" (step = 1) --> "0.0"
         * - "0.000%" (step = 1) --> "0.0000%"
         * - "0.00" (step = -1) --> "0.0"
         * - "0%" (step = -1) --> "0%"
         * - "#,##0.0" (step = -1) --> "#,##0"
         * - "#,##0;0.0%;0.000" (step = 1) --> "#,##0.0;0.00%;0.0000"
         */
        changeDecimalFormat(format, step) {
            const sign = Math.sign(step);
            // According to the representation of the cell format. A format can contain
            // up to 4 sub-formats which can be applied depending on the value of the cell
            // (among positive / negative / zero / text), each of these sub-format is separated
            // by ';' in the format. We need to make the change on each sub-format.
            const subFormats = format.split(";");
            let newSubFormats = [];
            for (let subFormat of subFormats) {
                const decimalPointPosition = subFormat.indexOf(".");
                const exponentPosition = subFormat.toUpperCase().indexOf("E");
                let newSubFormat;
                // the 1st step is to find the part of the zeros located before the
                // exponent (when existed)
                const subPart = exponentPosition > -1 ? subFormat.slice(0, exponentPosition) : subFormat;
                const zerosAfterDecimal = decimalPointPosition > -1 ? subPart.slice(decimalPointPosition).match(/0/g).length : 0;
                // the 2nd step is to add (or remove) zero after the last zeros obtained in
                // step 1
                const lastZeroPosition = subPart.lastIndexOf("0");
                if (lastZeroPosition > -1) {
                    if (sign > 0) {
                        // in this case we want to add decimal information
                        if (zerosAfterDecimal < maximumDecimalPlaces) {
                            newSubFormat =
                                subFormat.slice(0, lastZeroPosition + 1) +
                                    (zerosAfterDecimal === 0 ? ".0" : "0") +
                                    subFormat.slice(lastZeroPosition + 1);
                        }
                        else {
                            newSubFormat = subFormat;
                        }
                    }
                    else {
                        // in this case we want to remove decimal information
                        if (zerosAfterDecimal > 0) {
                            // remove last zero
                            newSubFormat =
                                subFormat.slice(0, lastZeroPosition) + subFormat.slice(lastZeroPosition + 1);
                            // if a zero always exist after decimal point else remove decimal point
                            if (zerosAfterDecimal === 1) {
                                newSubFormat =
                                    newSubFormat.slice(0, decimalPointPosition) +
                                        newSubFormat.slice(decimalPointPosition + 1);
                            }
                        }
                        else {
                            // zero after decimal isn't present, we can't remove zero
                            newSubFormat = subFormat;
                        }
                    }
                }
                else {
                    // no zeros are present in this format, we do nothing
                    newSubFormat = subFormat;
                }
                newSubFormats.push(newSubFormat);
            }
            return newSubFormats.join(";");
        }
        /**
         * Clear the styles of zones
         */
        clearStyles(sheetId, zones) {
            for (let zone of zones) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        this.dispatch("UPDATE_CELL", {
                            sheetId,
                            col,
                            row,
                            style: undefined,
                        });
                    }
                }
            }
        }
        /**
         * Copy the style of the reference column to the new columns.
         */
        handleAddColumns(cmd) {
            // The new columns have already been inserted in the sheet at this point.
            const sheet = this.getters.getSheet(cmd.sheetId);
            let insertedColumns;
            let styleColumn;
            if (cmd.position === "before") {
                insertedColumns = range(cmd.column, cmd.column + cmd.quantity);
                styleColumn = cmd.column + cmd.quantity;
            }
            else {
                insertedColumns = range(cmd.column + 1, cmd.column + cmd.quantity + 1);
                styleColumn = cmd.column;
            }
            this.copyColumnStyle(sheet, styleColumn, insertedColumns);
        }
        /**
         * Copy the style of the reference row to the new rows.
         */
        handleAddRows(cmd) {
            const sheet = this.getters.getSheet(cmd.sheetId);
            let insertedRows;
            let styleRow;
            if (cmd.position === "before") {
                insertedRows = range(cmd.row, cmd.row + cmd.quantity);
                styleRow = cmd.row + cmd.quantity;
            }
            else {
                styleRow = cmd.row;
                insertedRows = range(cmd.row + 1, cmd.row + cmd.quantity + 1);
            }
            this.copyRowStyle(sheet, styleRow, insertedRows);
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            // Styles
            for (let sheet of data.sheets) {
                const imported_sheet = this.getters.getSheet(sheet.id);
                // cells
                for (let xc in sheet.cells) {
                    const cell = sheet.cells[xc];
                    const [col, row] = toCartesian(xc);
                    const style = (cell && cell.style && data.styles[cell.style]) || undefined;
                    this.updateCell(imported_sheet, col, row, {
                        content: cell === null || cell === void 0 ? void 0 : cell.content,
                        formula: cell === null || cell === void 0 ? void 0 : cell.formula,
                        format: cell === null || cell === void 0 ? void 0 : cell.format,
                        style,
                    });
                }
            }
        }
        export(data) {
            var _a;
            let styleId = 0;
            const styles = {};
            /**
             * Get the id of the given style. If the style does not exist, it creates
             * one.
             */
            function getStyleId(style) {
                for (let [key, value] of Object.entries(styles)) {
                    if (stringify(value) === stringify(style)) {
                        return parseInt(key, 10);
                    }
                }
                styles[++styleId] = style;
                return styleId;
            }
            for (let _sheet of data.sheets) {
                const cells = {};
                for (let [cellId, cell] of Object.entries(this.cells[_sheet.id] || {})) {
                    let position = this.getters.getCellPosition(cellId);
                    let xc = toXC(position.col, position.row);
                    cells[xc] = {
                        style: cell.style && getStyleId(cell.style),
                        format: cell.format,
                    };
                    switch (cell.type) {
                        case CellType.formula:
                            cells[xc].formula = {
                                text: cell.formula.text || "",
                                dependencies: ((_a = cell.dependencies) === null || _a === void 0 ? void 0 : _a.map((d) => this.getters.getRangeString(d, _sheet.id))) || [],
                            };
                            break;
                        case CellType.number:
                        case CellType.text:
                        case CellType.invalidFormula:
                            cells[xc].content = cell.content;
                            break;
                    }
                }
                _sheet.cells = cells;
            }
            data.styles = styles;
        }
        // ---------------------------------------------------------------------------
        // GETTERS
        // ---------------------------------------------------------------------------
        getCells(sheetId) {
            return this.cells[sheetId] || {};
        }
        getFormulaCellContent(sheetId, cell) {
            var _a, _b;
            let newDependencies = (_a = cell.dependencies) === null || _a === void 0 ? void 0 : _a.map((x, i) => {
                return {
                    stringDependency: this.getters.getRangeString(x, sheetId),
                    stringPosition: `${FORMULA_REF_IDENTIFIER}${i}${FORMULA_REF_IDENTIFIER}`,
                };
            });
            let newContent = ((_b = cell.formula) === null || _b === void 0 ? void 0 : _b.text) || "";
            if (newDependencies) {
                for (let d of newDependencies) {
                    newContent = newContent.replace(d.stringPosition, d.stringDependency);
                }
            }
            return newContent;
        }
        getCellValue(cell, sheetId, showFormula = false) {
            let value;
            if (showFormula) {
                if (cell.type === CellType.formula) {
                    value = this.getters.getFormulaCellContent(sheetId, cell);
                }
                else {
                    value = cell.type === CellType.invalidFormula ? cell.content : cell.value;
                }
            }
            else {
                value = cell.value;
            }
            switch (typeof value) {
                case "string":
                    return value;
                case "boolean":
                    return value ? "TRUE" : "FALSE";
                case "number":
                    return formatStandardNumber(value);
                case "object":
                    return "0";
            }
            return (value && value.toString()) || "";
        }
        getCellText(cell, sheetId, showFormula = false) {
            let value;
            if (showFormula) {
                if (cell.type === CellType.formula) {
                    value = this.getters.getFormulaCellContent(sheetId, cell);
                }
                else {
                    value = cell.type === CellType.invalidFormula ? cell.content : cell.value;
                }
            }
            else {
                value = cell.value;
            }
            switch (typeof value) {
                case "string":
                    return value;
                case "boolean":
                    return value ? "TRUE" : "FALSE";
                case "number":
                    const shouldFormat = (value || value === 0) && cell.format && !cell.error;
                    const dateTimeFormat = shouldFormat && cell.format.match(DATETIME_FORMAT);
                    if (dateTimeFormat) {
                        return formatDateTime({ value, format: cell.format });
                    }
                    const numberFormat = shouldFormat && !dateTimeFormat;
                    if (numberFormat) {
                        return formatNumber(value, cell.format);
                    }
                    return formatStandardNumber(value);
                case "object":
                    return "0";
            }
            return (value && value.toString()) || "";
        }
        getCellStyle(cell) {
            return cell.style || {};
        }
        /**
         * Converts a zone to a XC coordinate system
         *
         * The conversion also treats merges as one single cell
         *
         * Examples:
         * {top:0,left:0,right:0,bottom:0} ==> A1
         * {top:0,left:0,right:1,bottom:1} ==> A1:B2
         *
         * if A1:B2 is a merge:
         * {top:0,left:0,right:1,bottom:1} ==> A1
         * {top:1,left:0,right:1,bottom:2} ==> A1:B3
         *
         * if A1:B2 and A4:B5 are merges:
         * {top:1,left:0,right:1,bottom:3} ==> A1:A5
         */
        zoneToXC(sheetId, zone) {
            zone = this.getters.expandZone(sheetId, zone);
            const topLeft = toXC(zone.left, zone.top);
            const botRight = toXC(zone.right, zone.bottom);
            const cellTopLeft = this.getters.getMainCell(sheetId, zone.left, zone.top);
            const cellBotRight = this.getters.getMainCell(sheetId, zone.right, zone.bottom);
            const sameCell = cellTopLeft[0] == cellBotRight[0] && cellTopLeft[1] == cellBotRight[1];
            if (topLeft != botRight && !sameCell) {
                return topLeft + ":" + botRight;
            }
            return topLeft;
        }
        setStyle(sheetId, target, style) {
            for (let zone of target) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        const cell = this.getters.getCell(sheetId, col, row);
                        this.dispatch("UPDATE_CELL", {
                            sheetId,
                            col,
                            row,
                            style: style ? { ...cell === null || cell === void 0 ? void 0 : cell.style, ...style } : undefined,
                        });
                    }
                }
            }
        }
        /**
         * Copy the style of one column to other columns.
         */
        copyColumnStyle(sheet, refColumn, targetCols) {
            for (let row = 0; row < sheet.rows.length; row++) {
                const format = this.getFormat(sheet.id, refColumn, row);
                if (format.style || format.format) {
                    for (let col of targetCols) {
                        this.dispatch("UPDATE_CELL", { sheetId: sheet.id, col, row, ...format });
                    }
                }
            }
        }
        /**
         * Copy the style of one row to other rows.
         */
        copyRowStyle(sheet, refRow, targetRows) {
            for (let col = 0; col < sheet.cols.length; col++) {
                const format = this.getFormat(sheet.id, col, refRow);
                if (format.style || format.format) {
                    for (let row of targetRows) {
                        this.dispatch("UPDATE_CELL", { sheetId: sheet.id, col, row, ...format });
                    }
                }
            }
        }
        /**
         * gets the currently used style/border of a cell based on it's coordinates
         */
        getFormat(sheetId, col, row) {
            const format = {};
            const [mainCol, mainRow] = this.getters.getMainCell(sheetId, col, row);
            const cell = this.getters.getCell(sheetId, mainCol, mainRow);
            if (cell) {
                if (cell.style) {
                    format["style"] = cell.style;
                }
                if (cell.format) {
                    format["format"] = cell.format;
                }
            }
            return format;
        }
        updateCell(sheet, col, row, after) {
            const before = sheet.rows[row].cells[col];
            const hasContent = "content" in after || "formula" in after;
            // Compute the new cell properties
            const afterContent = after.content ? after.content.replace(nbspRegexp, "") : "";
            const style = "style" in after ? after.style : (before && before.style) || 0;
            let format = "format" in after ? after.format : (before && before.format) || "";
            /* Read the following IF as:
             * we need to remove the cell if it is completely empty, but we can know if it completely empty if:
             * - the command says the new content is empty and has no border/format/style
             * - the command has no content property, in this case
             *     - either there wasn't a cell at this place and the command says border/format/style is empty
             *     - or there was a cell at this place, but it's an empty cell and the command says border/format/style is empty
             *  */
            if (((hasContent && !afterContent && !after.formula) ||
                (!hasContent && ((before === null || before === void 0 ? void 0 : before.type) === CellType.empty || !before))) &&
                !style &&
                !format) {
                if (before) {
                    this.history.update("cells", sheet.id, before.id, undefined);
                    this.dispatch("UPDATE_CELL_POSITION", {
                        cellId: before.id,
                        col,
                        row,
                        sheetId: sheet.id,
                        cell: undefined,
                    });
                }
                return;
            }
            // compute the new cell value
            const didContentChange = hasContent;
            let cell;
            if (before && !didContentChange) {
                cell = Object.assign({}, before);
            }
            else {
                // the current content cannot be reused, so we need to recompute the
                // derived
                const cellId = (before === null || before === void 0 ? void 0 : before.id) || uuidv4();
                let formulaString = after.formula;
                if (!formulaString && afterContent[0] === "=") {
                    formulaString = normalize(afterContent || "");
                }
                if (formulaString) {
                    try {
                        const compiledFormula = compile(formulaString);
                        let ranges = [];
                        for (let xc of formulaString.dependencies) {
                            // todo: remove the actual range from the cell and only keep the range Id
                            ranges.push(this.getters.getRangeFromSheetXC(sheet.id, xc));
                        }
                        cell = {
                            id: cellId,
                            type: CellType.formula,
                            formula: {
                                compiledFormula: compiledFormula,
                                text: formulaString.text,
                            },
                            dependencies: ranges,
                        };
                        if (!after.formula) {
                            format = this.computeFormulaFormat(cell);
                        }
                    }
                    catch (_) {
                        cell = {
                            id: cellId,
                            type: CellType.invalidFormula,
                            content: afterContent,
                            value: "#BAD_EXPR",
                            error: _lt("Invalid Expression"),
                        };
                    }
                }
                else if (afterContent === "") {
                    cell = {
                        id: cellId,
                        type: CellType.empty,
                        value: "",
                    };
                }
                else if (isNumber(afterContent)) {
                    cell = {
                        id: cellId,
                        type: CellType.number,
                        content: afterContent,
                        value: parseNumber(afterContent),
                    };
                    if (afterContent.includes("%")) {
                        format = afterContent.includes(".") ? "0.00%" : "0%";
                    }
                }
                else {
                    const internaldate = parseDateTime(afterContent);
                    if (internaldate !== null) {
                        cell = {
                            id: cellId,
                            type: CellType.number,
                            content: internaldate.value.toString(),
                            value: internaldate.value,
                        };
                        if (!format) {
                            format = internaldate.format;
                        }
                    }
                    else {
                        const contentUpperCase = afterContent.toUpperCase();
                        cell = {
                            id: cellId,
                            type: CellType.text,
                            content: afterContent,
                            value: contentUpperCase === "TRUE"
                                ? true
                                : contentUpperCase === "FALSE"
                                    ? false
                                    : afterContent,
                        };
                    }
                }
            }
            if (style) {
                cell.style = style;
            }
            else {
                delete cell.style;
            }
            if (format) {
                cell.format = format;
            }
            else {
                delete cell.format;
            }
            this.history.update("cells", sheet.id, cell.id, cell);
            this.dispatch("UPDATE_CELL_POSITION", { cell, cellId: cell.id, col, row, sheetId: sheet.id });
        }
        computeFormulaFormat(cell) {
            var _a;
            const dependenciesFormat = cell.formula.compiledFormula.dependenciesFormat;
            const dependencies = cell.dependencies;
            for (let dependencyFormat of dependenciesFormat) {
                switch (typeof dependencyFormat) {
                    case "string":
                        // dependencyFormat corresponds to a literal format which can be applied
                        // directly.
                        return dependencyFormat;
                    case "number":
                        // dependencyFormat corresponds to a dependency cell from which we must
                        // find the cell and extract the associated format
                        const ref = dependencies[dependencyFormat];
                        const sheets = this.getters.getEvaluationSheets();
                        const s = sheets[ref.sheetId];
                        if (s) {
                            // if the reference is a range --> the first cell in the range
                            // determines the format
                            const cellRef = (_a = s.rows[ref.zone.top]) === null || _a === void 0 ? void 0 : _a.cells[ref.zone.left];
                            if (cellRef && cellRef.format) {
                                return cellRef.format;
                            }
                        }
                        break;
                }
            }
            return this.NULL_FORMAT;
        }
    }
    CellPlugin.getters = [
        "zoneToXC",
        "getCells",
        "getFormulaCellContent",
        "getCellText",
        "getCellValue",
        "getCellStyle",
    ];

    class ChartPlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.chartFigures = {};
        }
        allowDispatch(cmd) {
            const success = { status: "SUCCESS" };
            switch (cmd.type) {
                case "UPDATE_CHART":
                case "CREATE_CHART":
                    const error = this.checkChartDefinition(cmd.definition);
                    return error
                        ? { status: "CANCELLED", reason: error }
                        : {
                            status: "SUCCESS",
                        };
                default:
                    return success;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "CREATE_CHART":
                    const chartDefinition = this.createChartDefinition(cmd.definition, cmd.sheetId);
                    this.dispatch("CREATE_FIGURE", {
                        sheetId: cmd.sheetId,
                        figure: {
                            id: cmd.id,
                            x: 0,
                            y: 0,
                            height: 500,
                            width: 800,
                            tag: "chart",
                        },
                    });
                    this.history.update("chartFigures", cmd.id, chartDefinition);
                    break;
                case "UPDATE_CHART": {
                    const newChartDefinition = this.createChartDefinition(cmd.definition, cmd.sheetId);
                    this.history.update("chartFigures", cmd.id, newChartDefinition);
                    break;
                }
                case "DUPLICATE_SHEET": {
                    const sheetFiguresFrom = this.getters.getFigures(cmd.sheetIdFrom);
                    for (let fig of Object.values(sheetFiguresFrom)) {
                        if ((fig === null || fig === void 0 ? void 0 : fig.tag) === "chart") {
                            const id = uuidv4();
                            const chartDefinition = { ...this.chartFigures[fig.id], id };
                            this.dispatch("CREATE_FIGURE", {
                                sheetId: cmd.sheetIdTo,
                                figure: {
                                    id: id,
                                    x: fig.x,
                                    y: fig.y,
                                    height: fig.height,
                                    width: fig.width,
                                    tag: "chart",
                                },
                            });
                            this.history.update("chartFigures", id, chartDefinition);
                        }
                    }
                    break;
                }
                case "DELETE_FIGURE":
                    this.history.update("chartFigures", cmd.id, undefined);
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getChartDefinition(figureId) {
            return this.chartFigures[figureId];
        }
        getChartDefinitionUI(sheetId, figureId) {
            const data = this.chartFigures[figureId];
            const dataSets = data.dataSets
                .map((ds) => (ds ? this.getters.getRangeString(ds.dataRange, sheetId) : ""))
                .filter((ds) => {
                return ds !== ""; // && range !== INCORRECT_RANGE_STRING ? show incorrect #ref ?
            });
            return {
                title: data && data.title ? data.title : "",
                dataSets,
                labelRange: data.labelRange ? this.getters.getRangeString(data.labelRange, sheetId) : "",
                type: data ? data.type : "bar",
                dataSetsHaveTitle: data ? Boolean(data.dataSets[0].labelCell) : false,
            };
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            for (let sheet of data.sheets) {
                if (sheet.figures) {
                    for (let figure of sheet.figures) {
                        if (figure.tag === "chart") {
                            const figureData = {
                                ...figure.data,
                            };
                            this.chartFigures[figure.id] = this.createChartDefinition(figureData, sheet.id);
                            delete figure.data;
                        }
                    }
                }
            }
        }
        export(data) {
            if (data.sheets) {
                for (let sheet of data.sheets) {
                    const sheetFigures = this.getters.getFigures(sheet.id);
                    const figures = Object.values(sheetFigures);
                    for (let figure of figures) {
                        if (figure && figure.tag === "chart") {
                            figure.data = this.getChartDefinitionUI(sheet.id, figure.id);
                        }
                    }
                    sheet.figures = figures;
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        createChartDefinition(createCommand, sheetId) {
            let dataSets = [];
            for (let sheetXC of createCommand.dataSets) {
                const dataRange = this.getters.getRangeFromSheetXC(sheetId, sheetXC, undefined, true);
                const { zone, sheetId: dataSetSheetId, invalidSheetName } = dataRange;
                if (invalidSheetName) {
                    continue;
                }
                if (zone.left !== zone.right && zone.top !== zone.bottom) {
                    // It's a rectangle. We treat all columns (arbitrary) as different data series.
                    for (let column = zone.left; column <= zone.right; column++) {
                        const columnZone = {
                            left: column,
                            right: column,
                            top: zone.top,
                            bottom: zone.bottom,
                        };
                        dataSets.push(this.createDataSet(dataSetSheetId, columnZone, createCommand.dataSetsHaveTitle
                            ? {
                                top: columnZone.top,
                                bottom: columnZone.top,
                                left: columnZone.left,
                                right: columnZone.left,
                            }
                            : undefined));
                    }
                }
                else if (zone.left === zone.right && zone.top === zone.bottom) {
                    // A single cell. If it's only the title, the dataset is not added.
                    if (!createCommand.dataSetsHaveTitle) {
                        dataSets.push(this.createDataSet(dataSetSheetId, zone, undefined));
                    }
                }
                else {
                    /* 1 row or 1 column */
                    dataSets.push(this.createDataSet(dataSetSheetId, zone, createCommand.dataSetsHaveTitle
                        ? {
                            top: zone.top,
                            bottom: zone.top,
                            left: zone.left,
                            right: zone.left,
                        }
                        : undefined));
                }
            }
            const labelRange = this.getters.getRangeFromSheetXC(sheetId, createCommand.labelRange);
            return {
                title: createCommand.title,
                type: createCommand.type,
                dataSets: dataSets,
                labelRange,
                sheetId: sheetId,
            };
        }
        createDataSet(sheetId, fullZone, titleZone) {
            if (fullZone.left !== fullZone.right && fullZone.top !== fullZone.bottom) {
                throw new Error(`Zone should be a single column or row: ${zoneToXc(fullZone)}`);
            }
            if (titleZone) {
                const dataXC = zoneToXc(fullZone);
                const labelCellXC = zoneToXc(titleZone);
                return {
                    labelCell: this.getters.getRangeFromSheetXC(sheetId, labelCellXC),
                    dataRange: this.getters.getRangeFromSheetXC(sheetId, dataXC),
                };
            }
            else {
                return {
                    labelCell: undefined,
                    dataRange: this.getters.getRangeFromSheetXC(sheetId, zoneToXc(fullZone)),
                };
            }
        }
        checkChartDefinition(createCommand) {
            if (createCommand.dataSets.length) {
                const invalidRanges = createCommand.dataSets.find((range) => !rangeReference.test(range)) !== undefined;
                if (invalidRanges) {
                    return 21 /* InvalidDataSet */;
                }
            }
            else {
                return 19 /* EmptyDataSet */;
            }
            if (createCommand.labelRange) {
                const invalidLabels = !rangeReference.test(createCommand.labelRange);
                if (invalidLabels) {
                    return 22 /* InvalidLabelRange */;
                }
            }
            else {
                return 20 /* EmptyLabelRange */;
            }
            return null;
        }
    }
    ChartPlugin.getters = ["getChartDefinition", "getChartDefinitionUI"];

    class ConditionalFormatPlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.cfRules = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            if (cmd.type === "ADD_CONDITIONAL_FORMAT") {
                const error = this.checkCFRule(cmd.cf.rule);
                return error
                    ? { status: "CANCELLED", reason: error }
                    : {
                        status: "SUCCESS",
                    };
            }
            return {
                status: "SUCCESS",
            };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "CREATE_SHEET":
                    this.cfRules[cmd.sheetId] = [];
                    break;
                case "DUPLICATE_SHEET":
                    this.history.update("cfRules", cmd.sheetIdTo, this.cfRules[cmd.sheetIdFrom].slice());
                    break;
                case "DELETE_SHEET":
                    const cfRules = Object.assign({}, this.cfRules);
                    delete cfRules[cmd.sheetId];
                    this.history.update("cfRules", cfRules);
                    break;
                case "ADD_CONDITIONAL_FORMAT":
                    this.addConditionalFormatting(cmd.cf, cmd.sheetId);
                    break;
                case "REMOVE_CONDITIONAL_FORMAT":
                    this.removeConditionalFormatting(cmd.id, cmd.sheetId);
                    break;
                case "REMOVE_COLUMNS":
                    this.adaptcfRules(cmd.sheetId, (range) => updateRemoveColumns(range, cmd.columns));
                    break;
                case "REMOVE_ROWS":
                    this.adaptcfRules(cmd.sheetId, (range) => updateRemoveRows(range, cmd.rows));
                    break;
                case "ADD_COLUMNS":
                    const column = cmd.position === "before" ? cmd.column : cmd.column + 1;
                    this.adaptcfRules(cmd.sheetId, (range) => updateAddColumns(range, column, cmd.quantity));
                    break;
                case "ADD_ROWS":
                    const row = cmd.position === "before" ? cmd.row : cmd.row + 1;
                    this.adaptcfRules(cmd.sheetId, (range) => updateAddRows(range, row, cmd.quantity));
                    break;
            }
        }
        import(data) {
            for (let sheet of data.sheets) {
                this.cfRules[sheet.id] = sheet.conditionalFormats;
            }
        }
        export(data) {
            if (data.sheets) {
                for (let sheet of data.sheets) {
                    if (this.cfRules[sheet.id]) {
                        sheet.conditionalFormats = this.cfRules[sheet.id];
                    }
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Returns all the conditional format rules defined for the current sheet
         */
        getConditionalFormats(sheetId) {
            return this.cfRules[sheetId] || [];
        }
        getRulesSelection(sheetId, selection) {
            const ruleIds = new Set();
            selection.forEach((zone) => {
                const zoneRuleId = this.getRulesByZone(sheetId, zone);
                zoneRuleId.forEach((ruleId) => {
                    ruleIds.add(ruleId);
                });
            });
            return Array.from(ruleIds);
        }
        getRulesByZone(sheetId, zone) {
            const ruleIds = new Set();
            for (let row = zone.top; row <= zone.bottom; row++) {
                for (let col = zone.left; col <= zone.right; col++) {
                    const cellRules = this.getRulesByCell(sheetId, col, row);
                    cellRules.forEach((rule) => {
                        ruleIds.add(rule.id);
                    });
                }
            }
            return ruleIds;
        }
        getRulesByCell(sheetId, cellCol, cellRow) {
            const rulesId = new Set();
            for (let cf of this.cfRules[sheetId]) {
                for (let ref of cf.ranges) {
                    const zone = toZone(ref);
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        for (let col = zone.left; col <= zone.right; col++) {
                            if (cellCol === col && cellRow === row) {
                                rulesId.add(cf);
                            }
                        }
                    }
                }
            }
            return rulesId;
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        /**
         * Add or replace a conditional format rule
         */
        addConditionalFormatting(cf, sheet) {
            const currentCF = this.cfRules[sheet].slice();
            const replaceIndex = currentCF.findIndex((c) => c.id === cf.id);
            if (replaceIndex > -1) {
                currentCF.splice(replaceIndex, 1, cf);
            }
            else {
                currentCF.push(cf);
            }
            this.history.update("cfRules", sheet, currentCF);
        }
        checkCFRule(rule) {
            switch (rule.type) {
                case "CellIsRule":
                    if (rule.operator === "Between" || rule.operator === "NotBetween") {
                        if (rule.values.length !== 2 || rule.values.some((x) => x === "")) {
                            return 28 /* InvalidNumberOfArgs */;
                        }
                    }
                    else {
                        if ([
                            "BeginsWith",
                            "ContainsText",
                            "EndsWith",
                            "GreaterThan",
                            "GreaterThanOrEqual",
                            "LessThan",
                            "LessThanOrEqual",
                            "NotContains",
                        ].includes(rule.operator) &&
                            (rule.values[0] === "" || rule.values[0] === undefined)) {
                            return 28 /* InvalidNumberOfArgs */;
                        }
                    }
                    break;
                case "ColorScaleRule": {
                    return this.checkColorScaleRule(rule);
                }
            }
            return null;
        }
        checkPoint(threshold, thresholdName) {
            if (["number", "percentage", "percentile"].includes(threshold.type) &&
                (threshold.value === "" || isNaN(threshold.value))) {
                switch (thresholdName) {
                    case "min":
                        return 29 /* MinNaN */;
                    case "max":
                        return 31 /* MaxNaN */;
                    case "mid":
                        return 30 /* MidNaN */;
                }
            }
            try {
                if (threshold.type === "formula") {
                    const compiledFormula = compile(normalize(threshold.value || ""));
                    if (compiledFormula.async) {
                        switch (thresholdName) {
                            case "min":
                                return 32 /* MinAsyncFormulaNotSupported */;
                            case "max":
                                return 34 /* MaxAsyncFormulaNotSupported */;
                            case "mid":
                                return 33 /* MidAsyncFormulaNotSupported */;
                        }
                    }
                }
            }
            catch (error) {
                switch (thresholdName) {
                    case "min":
                        return 35 /* MinInvalidFormula */;
                    case "max":
                        return 37 /* MaxInvalidFormula */;
                    case "mid":
                        return 36 /* MidInvalidFormula */;
                }
            }
            return;
        }
        checkColorScaleRule(rule) {
            var _a;
            const error = this.checkPoint(rule.minimum, "min") ||
                this.checkPoint(rule.maximum, "max") ||
                (rule.midpoint && this.checkPoint(rule.midpoint, "mid"));
            if (error) {
                return error;
            }
            const minValue = rule.minimum.value;
            const midValue = (_a = rule.midpoint) === null || _a === void 0 ? void 0 : _a.value;
            const maxValue = rule.maximum.value;
            if (["number", "percentage", "percentile"].includes(rule.minimum.type) &&
                rule.minimum.type === rule.maximum.type &&
                Number(minValue) >= Number(maxValue)) {
                return 25 /* MinBiggerThanMax */;
            }
            if (rule.midpoint &&
                ["number", "percentage", "percentile"].includes(rule.midpoint.type) &&
                rule.minimum.type === rule.midpoint.type &&
                Number(minValue) >= Number(midValue)) {
                return 27 /* MinBiggerThanMid */;
            }
            if (rule.midpoint &&
                ["number", "percentage", "percentile"].includes(rule.midpoint.type) &&
                rule.midpoint.type === rule.maximum.type &&
                Number(midValue) >= Number(maxValue)) {
                return 26 /* MidBiggerThanMax */;
            }
            return null;
        }
        adaptcfRules(sheet, updateCb) {
            const currentCfs = this.cfRules[sheet];
            const newCfs = [];
            for (let cf of currentCfs) {
                const updatedRanges = [];
                for (let range of cf.ranges) {
                    const updatedRange = updateCb(range);
                    if (updatedRange) {
                        updatedRanges.push(updatedRange);
                    }
                }
                if (updatedRanges.length === 0) {
                    continue;
                }
                newCfs.push({ ...cf, ranges: updatedRanges });
            }
            this.history.update("cfRules", sheet, newCfs);
        }
        removeConditionalFormatting(id, sheet) {
            const cfIndex = this.cfRules[sheet].findIndex((s) => s.id === id);
            if (cfIndex !== -1) {
                const currentCF = this.cfRules[sheet].slice();
                currentCF.splice(cfIndex, 1);
                this.history.update("cfRules", sheet, currentCF);
            }
        }
    }
    ConditionalFormatPlugin.getters = ["getConditionalFormats", "getRulesSelection", "getRulesByCell"];

    class FigurePlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.selectedFigureId = null;
            this.figures = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "CREATE_SHEET":
                    this.figures[cmd.sheetId] = {};
                    break;
                case "DELETE_SHEET":
                    this.deleteSheet(cmd.sheetId);
                    break;
                case "CREATE_FIGURE":
                    this.addFigure(cmd.figure, cmd.sheetId);
                    break;
                case "UPDATE_FIGURE":
                    const { type, sheetId, ...update } = cmd;
                    const figure = update;
                    this.updateFigure(sheetId, figure);
                    break;
                case "SELECT_FIGURE":
                    this.selectedFigureId = cmd.id;
                    break;
                case "DELETE_FIGURE":
                    this.removeFigure(cmd.id, cmd.sheetId);
                    break;
                // some commands should not remove the current selection
                case "EVALUATE_CELLS":
                case "DISABLE_SELECTION_INPUT":
                case "HIGHLIGHT_SELECTION":
                case "RESET_PENDING_HIGHLIGHT":
                case "REMOVE_ALL_HIGHLIGHTS":
                case "ENABLE_NEW_SELECTION_INPUT":
                    break;
                default:
                    this.selectedFigureId = null;
            }
        }
        updateFigure(sheetId, figure) {
            if (!("id" in figure)) {
                return;
            }
            for (const [key, value] of Object.entries(figure)) {
                switch (key) {
                    case "x":
                    case "y":
                        if (value !== undefined) {
                            this.history.update("figures", sheetId, figure.id, key, Math.max(value, 0));
                        }
                        break;
                    case "width":
                    case "height":
                        if (value !== undefined) {
                            this.history.update("figures", sheetId, figure.id, key, value);
                        }
                        break;
                }
            }
        }
        addFigure(figure, sheetId) {
            this.history.update("figures", sheetId, figure.id, figure);
        }
        deleteSheet(sheetId) {
            this.history.update("figures", sheetId, undefined);
        }
        removeFigure(id, sheetId) {
            if (this.selectedFigureId === id) {
                this.selectedFigureId = null;
            }
            this.history.update("figures", sheetId, id, undefined);
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getVisibleFigures(sheetId, viewport) {
            const result = [];
            const figures = Object.values(this.figures[sheetId] || {});
            const { offsetX, offsetY, width, height } = viewport;
            for (let figure of figures) {
                if (!figure) {
                    continue;
                }
                if (figure.x >= offsetX + width || figure.x + figure.width <= offsetX) {
                    continue;
                }
                if (figure.y >= offsetY + height || figure.y + figure.height <= offsetY) {
                    continue;
                }
                result.push(figure);
            }
            return result;
        }
        getFigures(sheetId) {
            return this.figures[sheetId] || [];
        }
        getSelectedFigureId() {
            return this.selectedFigureId;
        }
        getFigure(sheetId, figureId) {
            const sheetFigures = this.figures[sheetId];
            return sheetFigures ? sheetFigures[figureId] : undefined;
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            for (let sheet of data.sheets) {
                var figures = {};
                sheet.figures.forEach((figure) => {
                    figures[figure.id] = figure;
                });
                this.figures[sheet.id] = figures;
            }
        }
        export(data) {
            if (data.sheets) {
                for (let sheet of data.sheets) {
                    if (this.figures[sheet.id]) {
                        const figures = this.figures[sheet.id];
                        if (figures) {
                            for (let figure of Object.values(figures).filter(isDefined$1)) {
                                const data = undefined;
                                sheet.figures.push({ ...figure, data });
                            }
                        }
                    }
                }
            }
        }
    }
    FigurePlugin.getters = ["getVisibleFigures", "getFigures", "getSelectedFigureId", "getFigure"];

    class MergePlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.nextId = 1;
            this.pending = null;
            this.merges = {};
            this.mergeCellMap = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            const force = "force" in cmd ? !!cmd.force : false;
            switch (cmd.type) {
                case "ADD_MERGE":
                    return this.isMergeAllowed(cmd.sheetId, cmd.zone, force);
                default:
                    return { status: "SUCCESS" };
            }
        }
        beforeHandle(cmd) {
            switch (cmd.type) {
                case "REMOVE_COLUMNS":
                    this.exportAndRemoveMerges(cmd.sheetId, (range) => updateRemoveColumns(range, cmd.columns), true);
                    break;
                case "REMOVE_ROWS":
                    this.exportAndRemoveMerges(cmd.sheetId, (range) => updateRemoveRows(range, cmd.rows), false);
                    break;
                case "ADD_COLUMNS":
                    const col = cmd.position === "before" ? cmd.column : cmd.column + 1;
                    this.exportAndRemoveMerges(cmd.sheetId, (range) => updateAddColumns(range, col, cmd.quantity), true);
                    break;
                case "ADD_ROWS":
                    const row = cmd.position === "before" ? cmd.row : cmd.row + 1;
                    this.exportAndRemoveMerges(cmd.sheetId, (range) => updateAddRows(range, row, cmd.quantity), false);
                    break;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "CREATE_SHEET":
                    this.history.update("merges", cmd.sheetId, {});
                    this.history.update("mergeCellMap", cmd.sheetId, {});
                    break;
                case "DELETE_SHEET":
                    this.history.update("merges", cmd.sheetId, {});
                    this.history.update("mergeCellMap", cmd.sheetId, {});
                    break;
                case "DUPLICATE_SHEET":
                    this.history.update("merges", cmd.sheetIdTo, Object.assign({}, this.merges[cmd.sheetIdFrom]));
                    this.history.update("mergeCellMap", cmd.sheetIdTo, Object.assign({}, this.mergeCellMap[cmd.sheetIdFrom]));
                    break;
                case "ADD_MERGE":
                    if (!cmd.interactive) {
                        this.addMerge(this.getters.getSheet(cmd.sheetId), cmd.zone);
                    }
                    break;
                case "REMOVE_MERGE":
                    this.removeMerge(cmd.sheetId, cmd.zone);
                    break;
                case "ADD_COLUMNS":
                case "ADD_ROWS":
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                    if (this.pending) {
                        this.importMerges(this.pending.sheet, this.pending.merges);
                        this.pending = null;
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getMerges(sheetId) {
            return Object.values(this.merges[sheetId] || {}).filter(isDefined$1);
        }
        getMerge(sheetId, col, row) {
            var _a;
            const sheetMap = this.mergeCellMap[sheetId];
            const mergeId = sheetMap ? col in sheetMap && ((_a = sheetMap[col]) === null || _a === void 0 ? void 0 : _a[row]) : undefined;
            return mergeId ? this.getMergeById(sheetId, mergeId) : undefined;
        }
        /**
         * Return true if the current selection requires losing state if it is merged.
         * This happens when there is some textual content in other cells than the
         * top left.
         */
        isMergeDestructive(sheet, zone) {
            let { left, right, top, bottom } = zone;
            right = clip(right, 0, sheet.cols.length - 1);
            bottom = clip(bottom, 0, sheet.rows.length - 1);
            for (let row = top; row <= bottom; row++) {
                const actualRow = this.getters.getRow(sheet.id, row);
                for (let col = left; col <= right; col++) {
                    if (col !== left || row !== top) {
                        const cell = actualRow.cells[col];
                        if (cell && cell.type !== CellType.empty) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        /**
         * Return true if the zone intersects an existing merge:
         * if they have at least a common cell
         */
        doesIntersectMerge(sheetId, zone) {
            const { left, right, top, bottom } = zone;
            for (let row = top; row <= bottom; row++) {
                for (let col = left; col <= right; col++) {
                    if (this.getMerge(sheetId, col, row)) {
                        return true;
                    }
                }
            }
            return false;
        }
        /**
         * Add all necessary merge to the current selection to make it valid
         */
        expandZone(sheetId, zone) {
            let { left, right, top, bottom } = zone;
            let result = { left, right, top, bottom };
            for (let id in this.merges[sheetId]) {
                const merge = this.getMergeById(sheetId, parseInt(id));
                if (merge && overlap(merge, result)) {
                    result = union(merge, result);
                }
            }
            return isEqual(result, zone) ? result : this.expandZone(sheetId, result);
        }
        isInSameMerge(sheetId, colA, rowA, colB, rowB) {
            if (!this.isInMerge(sheetId, colA, rowA) || !this.isInMerge(sheetId, colB, rowB)) {
                return false;
            }
            return this.getMerge(sheetId, colA, rowA) === this.getMerge(sheetId, colB, rowB);
        }
        isInMerge(sheetId, col, row) {
            var _a;
            const sheetMap = this.mergeCellMap[sheetId];
            return sheetMap ? col in sheetMap && Boolean((_a = sheetMap[col]) === null || _a === void 0 ? void 0 : _a[row]) : false;
        }
        isMainCell(sheetId, col, row) {
            for (let mergeId in this.merges[sheetId]) {
                const merge = this.getMergeById(sheetId, parseInt(mergeId));
                if (merge && merge.topLeft.col === col && merge.topLeft.row === row) {
                    return true;
                }
            }
            return false;
        }
        getMainCell(sheetId, col, row) {
            if (!this.isInMerge(sheetId, col, row)) {
                return [col, row];
            }
            const mergeTopLeftPos = this.getMerge(sheetId, col, row).topLeft;
            return [mergeTopLeftPos.col, mergeTopLeftPos.row];
        }
        // ---------------------------------------------------------------------------
        // Merges
        // ---------------------------------------------------------------------------
        getMergeById(sheetId, mergeId) {
            const merges = this.merges[sheetId];
            return merges !== undefined ? merges[mergeId] : undefined;
        }
        /**
         * Verify that we can merge without losing content of other cells or
         * because the user gave his permission
         */
        isMergeAllowed(sheetId, zone, force) {
            if (!force) {
                try {
                    const sheet = this.getters.getSheet(sheetId);
                    if (this.isMergeDestructive(sheet, zone)) {
                        return {
                            status: "CANCELLED",
                            reason: 2 /* MergeIsDestructive */,
                        };
                    }
                }
                catch (error) {
                    return { status: "CANCELLED", reason: 15 /* InvalidSheetId */ };
                }
            }
            return {
                status: "SUCCESS",
            };
        }
        /**
         * Merge the current selection. Note that:
         * - it assumes that we have a valid selection (no intersection with other
         *   merges)
         * - it does nothing if the merge is trivial: A1:A1
         */
        addMerge(sheet, zone) {
            let { left, right, top, bottom } = zone;
            right = clip(right, 0, sheet.cols.length - 1);
            bottom = clip(bottom, 0, sheet.rows.length - 1);
            const tl = toXC(left, top);
            const br = toXC(right, bottom);
            if (tl === br) {
                return;
            }
            const topLeft = this.getters.getCell(sheet.id, left, top);
            let id = this.nextId++;
            this.history.update("merges", sheet.id, id, {
                id,
                left,
                top,
                right,
                bottom,
                topLeft: { col: left, row: top },
            });
            let previousMerges = new Set();
            for (let row = top; row <= bottom; row++) {
                for (let col = left; col <= right; col++) {
                    if (col !== left || row !== top) {
                        this.dispatch("UPDATE_CELL", {
                            sheetId: sheet.id,
                            col,
                            row,
                            style: topLeft ? topLeft.style : undefined,
                            content: undefined,
                        });
                    }
                    const merge = this.getMerge(sheet.id, col, row);
                    if (merge) {
                        previousMerges.add(merge.id);
                    }
                    this.history.update("mergeCellMap", sheet.id, col, row, id);
                }
            }
            for (let mergeId of previousMerges) {
                const { top, bottom, left, right } = this.getMergeById(sheet.id, mergeId);
                for (let r = top; r <= bottom; r++) {
                    for (let c = left; c <= right; c++) {
                        const merge = this.getMerge(sheet.id, c, r);
                        if (!merge || merge.id !== id) {
                            this.history.update("mergeCellMap", sheet.id, c, r, undefined);
                            this.dispatch("CLEAR_CELL", {
                                sheetId: sheet.id,
                                col: c,
                                row: r,
                            });
                        }
                    }
                }
                this.history.update("merges", sheet.id, mergeId, undefined);
            }
        }
        removeMerge(sheetId, zone) {
            const { left, top, bottom, right } = zone;
            const merge = this.getMerge(sheetId, left, top);
            if (merge === undefined || !isEqual(zone, merge)) {
                throw new Error(_lt("Invalid merge zone"));
            }
            this.history.update("merges", sheetId, merge.id, undefined);
            for (let r = top; r <= bottom; r++) {
                for (let c = left; c <= right; c++) {
                    this.history.update("mergeCellMap", sheetId, c, r, undefined);
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Add/Remove columns
        // ---------------------------------------------------------------------------
        removeAllMerges(sheetId) {
            for (let id in this.merges[sheetId]) {
                this.history.update("merges", sheetId, parseInt(id), undefined);
            }
            for (let colNumber in this.mergeCellMap[sheetId]) {
                this.history.update("mergeCellMap", sheetId, parseInt(colNumber), undefined);
            }
        }
        exportAndRemoveMerges(sheetId, updater, isCol) {
            const merges = this.merges[sheetId];
            if (!merges)
                return;
            const mergeXcs = exportMerges(merges);
            const updatedMerges = [];
            for (let m of mergeXcs) {
                const update = updater(m);
                if (update) {
                    const [tl, br] = update.split(":");
                    if (tl !== br) {
                        updatedMerges.push(update);
                    }
                }
            }
            this.removeAllMerges(sheetId);
            this.pending = { sheet: sheetId, merges: updatedMerges };
        }
        // ---------------------------------------------------------------------------
        // Import/Export
        // ---------------------------------------------------------------------------
        import(data) {
            const sheets = data.sheets || [];
            for (let sheetData of sheets) {
                this.history.update("merges", sheetData.id, {});
                this.history.update("mergeCellMap", sheetData.id, {});
                if (sheetData.merges) {
                    this.importMerges(sheetData.id, sheetData.merges);
                }
            }
        }
        importMerges(sheetId, merges) {
            const sheet = this.getters.getSheet(sheetId);
            for (let merge of merges) {
                this.addMerge(sheet, toZone(merge));
            }
        }
        export(data) {
            for (let sheetData of data.sheets) {
                const merges = this.merges[sheetData.id];
                if (merges) {
                    sheetData.merges.push(...exportMerges(merges));
                }
            }
        }
    }
    MergePlugin.getters = [
        "isMergeDestructive",
        "isInMerge",
        "isInSameMerge",
        "getMainCell",
        "expandZone",
        "doesIntersectMerge",
        "getMerges",
        "getMerge",
    ];
    function exportMerges(merges) {
        return Object.values(merges)
            .filter(isDefined$1)
            .map((merge) => toXC(merge.left, merge.top) + ":" + toXC(merge.right, merge.bottom));
    }

    const INCORRECT_RANGE_STRING = "#REF";
    class RangePlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.ranges = {};
            this.notifyResize = new Set(); // temporary set filled with ranges resized, to notify in the finalize
            this.notifyMove = new Set(); // idem for moved ranges
            this.notifyRemove = new Set(); // idem for removed ranges (where the end is before the start)
            this.notifyChange = new Set(); // item, for change
            this.notifyChangeSheetId = "";
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                    let start = cmd.type === "REMOVE_COLUMNS" ? "left" : "top";
                    let end = cmd.type === "REMOVE_COLUMNS" ? "right" : "bottom";
                    let dimension = cmd.type === "REMOVE_COLUMNS" ? "columns" : "rows";
                    this.notifyChangeSheetId = cmd.sheetId;
                    cmd[dimension].sort((a, b) => b - a);
                    for (let group of groupConsecutive(cmd[dimension])) {
                        for (let range of Object.values(this.ranges)
                            .filter(isDefined$1)
                            .filter((r) => r.sheetId === cmd.sheetId)) {
                            const min = Math.min(...group);
                            const max = Math.max(...group);
                            if (range.zone[start] <= min && min <= range.zone[end]) {
                                const toRemove = Math.min(range.zone[end], max) - min + 1;
                                this.history.update("ranges", range.id, "zone", end, range.zone[end] - toRemove);
                                this.notifyResize.add(range.id);
                            }
                            else if (min < range.zone[start]) {
                                this.history.update("ranges", range.id, "zone", end, range.zone[end] - (max - min + 1));
                                this.history.update("ranges", range.id, "zone", start, range.zone[start] - (max - min + 1));
                                this.notifyMove.add(range.id);
                            }
                        }
                    }
                    break;
                case "ADD_COLUMNS":
                    this.notifyChangeSheetId = cmd.sheetId;
                    for (let range of Object.values(this.ranges)
                        .filter(isDefined$1)
                        .filter((r) => r.sheetId === cmd.sheetId)) {
                        if (cmd.position === "after") {
                            if (range.zone.left <= cmd.column && cmd.column < range.zone.right) {
                                this.history.update("ranges", range.id, "zone", "right", range.zone.right + 1);
                                this.notifyResize.add(range.id);
                            }
                            else if (cmd.column < range.zone.left) {
                                this.history.update("ranges", range.id, "zone", "right", range.zone.right + 1);
                                this.history.update("ranges", range.id, "zone", "left", range.zone.left + 1);
                                this.notifyMove.add(range.id);
                            }
                        }
                        else {
                            if (range.zone.left < cmd.column && cmd.column <= range.zone.right) {
                                this.history.update("ranges", range.id, "zone", "right", range.zone.right + 1);
                                this.notifyResize.add(range.id);
                            }
                            else if (cmd.column <= range.zone.left) {
                                this.history.update("ranges", range.id, "zone", "right", range.zone.right + 1);
                                this.history.update("ranges", range.id, "zone", "left", range.zone.left + 1);
                                this.notifyMove.add(range.id);
                            }
                        }
                    }
                    break;
                case "ADD_ROWS":
                    this.notifyChangeSheetId = cmd.sheetId;
                    for (let range of Object.values(this.ranges)
                        .filter(isDefined$1)
                        .filter((r) => r.sheetId === cmd.sheetId)) {
                        if (cmd.position === "after") {
                            if (range.zone.top <= cmd.row && cmd.row < range.zone.bottom) {
                                this.history.update("ranges", range.id, "zone", "bottom", range.zone.bottom + 1);
                                this.notifyResize.add(range.id);
                            }
                            else if (cmd.row < range.zone.top) {
                                this.history.update("ranges", range.id, "zone", "top", range.zone.top + 1);
                                this.history.update("ranges", range.id, "zone", "bottom", range.zone.bottom + 1);
                                this.notifyMove.add(range.id);
                            }
                        }
                        else {
                            if (range.zone.top < cmd.row && cmd.row <= range.zone.bottom) {
                                this.history.update("ranges", range.id, "zone", "bottom", range.zone.bottom + 1);
                                this.notifyResize.add(range.id);
                            }
                            else if (cmd.row <= range.zone.top) {
                                this.history.update("ranges", range.id, "zone", "top", range.zone.top + 1);
                                this.history.update("ranges", range.id, "zone", "bottom", range.zone.bottom + 1);
                                this.notifyMove.add(range.id);
                            }
                        }
                    }
                    break;
                case "DELETE_SHEET":
                    for (let range of Object.values(this.ranges)
                        .filter(isDefined$1)
                        .filter((r) => r.sheetId === cmd.sheetId)) {
                        this.notifyRemove.add(range.id);
                    }
                    break;
                case "CREATE_SHEET":
                case "RENAME_SHEET":
                    for (let range of Object.values(this.ranges).filter(isDefined$1)) {
                        if (range.sheetId === cmd.sheetId) {
                            this.notifyChange.add(range.id);
                        }
                        if (cmd.name && range.invalidSheetName === cmd.name) {
                            let newSheetId = this.getters.getSheetIdByName(cmd.name);
                            if (newSheetId) {
                                this.history.update("ranges", range.id, "invalidSheetName", undefined);
                                this.history.update("ranges", range.id, "sheetId", newSheetId);
                                this.notifyChange.add(range.id);
                            }
                        }
                    }
                    break;
            }
            // ensure that even if a range has been updated after being removed, the last thing to happen to a removed range is being removed
            for (let rangeId of this.notifyRemove) {
                this.history.update("ranges", rangeId, undefined);
            }
        }
        finalize() {
            for (const rangeId of this.notifyResize) {
                const r = this.ranges[rangeId];
                if (!r || r.zone.right - r.zone.left < 0 || r.zone.bottom - r.zone.top < 0) {
                    this.notifyRemove.add(rangeId);
                    this.notifyResize.delete(rangeId);
                    this.notifyMove.delete(rangeId);
                    this.notifyChange.delete(rangeId);
                }
            }
            this.notify(this.notifyRemove, "REMOVE");
            this.notify(this.notifyResize, "RESIZE");
            this.notify(this.notifyMove, "MOVE");
            this.notify(this.notifyChange, "CHANGE");
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getRangeById(rangeId) {
            return this.ranges[rangeId];
        }
        /**
         * Creates a range from a XC reference that can contain a sheet reference
         * @param defaultSheetId the sheet to default to if the sheetXC parameter does not contain a sheet reference (usually the active sheet Id)
         * @param sheetXC the string description of a range, in the form SheetName!XC:XC
         * @param onChange a function that will be called if this range is modified. Note that this function will be called
         *                 in the finalize of the command, so it cannot use `dispatch` or `this.history`
         */
        getRangeFromSheetXC(defaultSheetId, sheetXC, onChange, transient = false) {
            let xc = sheetXC;
            let sheetName = "";
            let sheetId;
            let invalidSheetName;
            let prefixSheet = false;
            if (sheetXC.includes("!")) {
                [xc, sheetName] = sheetXC.split("!").reverse();
                if (sheetName) {
                    sheetId = this.getters.getSheetIdByName(getUnquotedSheetName(sheetName));
                    prefixSheet = true;
                    if (!sheetId) {
                        invalidSheetName = sheetName;
                    }
                }
                else {
                    invalidSheetName = sheetName;
                }
            }
            let zone = toZone(xc, true);
            let rangeParts = xc.split(":").map((p) => {
                return {
                    colFixed: p.startsWith("$"),
                    rowFixed: p.includes("$", 1),
                };
            });
            if (zone.right < zone.left) {
                let right = zone.right;
                zone.right = zone.left;
                zone.left = right;
                let rightFixed = rangeParts[1].colFixed;
                rangeParts[1].colFixed = rangeParts[0].colFixed;
                rangeParts[0].colFixed = rightFixed;
            }
            if (zone.bottom < zone.top) {
                let bottom = zone.bottom;
                zone.bottom = zone.top;
                zone.top = bottom;
                let bottomFixed = rangeParts[1].rowFixed;
                rangeParts[1].rowFixed = rangeParts[0].rowFixed;
                rangeParts[0].rowFixed = bottomFixed;
            }
            const r = {
                id: uuidv4(),
                sheetId: sheetId || defaultSheetId,
                zone: zone,
                onChange: onChange,
                parts: rangeParts,
                invalidSheetName,
                prefixSheet,
            };
            if (!transient) {
                this.ranges[r.id] = r;
            }
            return r;
        }
        /**
         * Gets the string that represents the range as it is at the moment of the call.
         * The string will be prefixed with the sheet name if the call specified a sheet id in `forSheetId`
         * different than the sheet on which the range has been created.
         *
         * @param range the range (received from getRangeFromXC or getRangeFromZone)
         * @param forSheetId the id of the sheet where the range string is supposed to be used.
         */
        getRangeString(range, forSheetId) {
            if (!range) {
                return INCORRECT_RANGE_STRING;
            }
            if (range.zone.bottom - range.zone.top < 0 || range.zone.right - range.zone.left < 0) {
                return INCORRECT_RANGE_STRING;
            }
            let prefixSheet = range.sheetId !== forSheetId || range.invalidSheetName || range.prefixSheet;
            let sheetName = "";
            if (prefixSheet) {
                if (range.invalidSheetName) {
                    sheetName = range.invalidSheetName;
                }
                else {
                    const s = this.getters.getSheetName(range.sheetId);
                    if (s) {
                        sheetName = getComposerSheetName(s);
                    }
                }
            }
            if (prefixSheet && !sheetName) {
                return INCORRECT_RANGE_STRING;
            }
            let ref = Array(9);
            ref[0] = range.parts && range.parts[0].colFixed ? "$" : "";
            ref[1] = numberToLetters(range.zone.left);
            ref[2] = range.parts && range.parts[0].rowFixed ? "$" : "";
            ref[3] = String(range.zone.top + 1);
            if (range.parts && range.parts.length === 2) {
                // this if converts A2:A2 into A2 except if any part of the original range had fixed row or column (with $)
                if (range.zone.top !== range.zone.bottom ||
                    range.zone.left !== range.zone.right ||
                    range.parts[0].rowFixed ||
                    range.parts[0].colFixed ||
                    range.parts[1].rowFixed ||
                    range.parts[1].colFixed) {
                    ref[4] = ":";
                    ref[5] = range.parts[1].colFixed ? "$" : "";
                    ref[6] = numberToLetters(range.zone.right);
                    ref[7] = range.parts[1].rowFixed ? "$" : "";
                    ref[8] = String(range.zone.bottom + 1);
                }
            }
            return `${prefixSheet ? sheetName + "!" : ""}${ref.join("")}`;
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        notify(set, type) {
            for (const rangeId of set) {
                const range = this.ranges[rangeId];
                if (range && range.onChange) {
                    range.onChange(type, this.notifyChangeSheetId);
                }
            }
            set.clear();
        }
    }
    RangePlugin.getters = ["getRangeString", "getRangeFromSheetXC", "getRangeById"];

    class SheetPlugin extends CorePlugin {
        constructor() {
            super(...arguments);
            this.sheetIds = {};
            this.visibleSheets = []; // ids of visible sheets
            this.sheets = {};
            this.cellPosition = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                case "ADD_ROWS":
                case "ADD_COLUMNS":
                case "RESIZE_COLUMNS":
                case "RESIZE_ROWS":
                case "AUTORESIZE_COLUMNS":
                case "AUTORESIZE_ROWS":
                case "UPDATE_CELL":
                case "CLEAR_CELL":
                case "RENAME_SHEET":
                case "DELETE_SHEET":
                case "DELETE_CONTENT":
                case "DELETE_SHEET_CONFIRMATION":
                    if (this.sheets[cmd.sheetId] === undefined) {
                        return {
                            status: "CANCELLED",
                            reason: 15 /* InvalidSheetId */,
                        };
                    }
            }
            switch (cmd.type) {
                case "CREATE_SHEET": {
                    const { visibleSheets, sheets } = this;
                    if (cmd.position > visibleSheets.length || cmd.position < 0) {
                        return { status: "CANCELLED", reason: 10 /* WrongSheetPosition */ };
                    }
                    return !cmd.name || !visibleSheets.find((id) => sheets[id].name === cmd.name)
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
                }
                case "DUPLICATE_SHEET": {
                    const { visibleSheets, sheets } = this;
                    return !cmd.name || !visibleSheets.find((id) => sheets[id].name === cmd.name)
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
                }
                case "MOVE_SHEET":
                    const currentIndex = this.visibleSheets.findIndex((id) => id === cmd.sheetId);
                    if (currentIndex === -1) {
                        return { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
                    }
                    return (cmd.direction === "left" && currentIndex === 0) ||
                        (cmd.direction === "right" && currentIndex === this.visibleSheets.length - 1)
                        ? { status: "CANCELLED", reason: 9 /* WrongSheetMove */ }
                        : { status: "SUCCESS" };
                case "RENAME_SHEET":
                    return this.isRenameAllowed(cmd);
                case "DELETE_SHEET_CONFIRMATION":
                case "DELETE_SHEET":
                    return this.visibleSheets.length > 1
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 7 /* NotEnoughSheets */ };
                case "REMOVE_COLUMNS":
                    return this.sheets[cmd.sheetId].cols.length > cmd.columns.length
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 5 /* NotEnoughColumns */ };
                case "REMOVE_ROWS":
                    return this.sheets[cmd.sheetId].rows.length > cmd.rows.length
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 6 /* NotEnoughRows */ };
                default:
                    return { status: "SUCCESS" };
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "DELETE_CONTENT":
                    this.clearZones(cmd.sheetId, cmd.target);
                    break;
                case "CREATE_SHEET":
                    const sheet = this.createSheet(cmd.sheetId, cmd.name || this.generateSheetName(), cmd.cols || 26, cmd.rows || 100, cmd.position);
                    this.sheetIds[sheet.name] = sheet.id;
                    break;
                case "RESIZE_COLUMNS":
                    for (let col of cmd.columns) {
                        this.setColSize(this.sheets[cmd.sheetId], col, cmd.size);
                    }
                    break;
                case "RESIZE_ROWS":
                    for (let row of cmd.rows) {
                        this.setRowSize(this.sheets[cmd.sheetId], row, cmd.size);
                    }
                    break;
                case "MOVE_SHEET":
                    this.moveSheet(cmd.sheetId, cmd.direction);
                    break;
                case "RENAME_SHEET":
                    if (!cmd.interactive) {
                        this.renameSheet(this.sheets[cmd.sheetId], cmd.name);
                    }
                    break;
                case "DUPLICATE_SHEET":
                    this.duplicateSheet(cmd.sheetIdFrom, cmd.sheetIdTo, cmd.name);
                    break;
                case "DELETE_SHEET":
                    this.deleteSheet(this.sheets[cmd.sheetId]);
                    break;
                case "REMOVE_COLUMNS":
                    this.removeColumns(this.sheets[cmd.sheetId], cmd.columns);
                    break;
                case "REMOVE_ROWS":
                    this.removeRows(this.sheets[cmd.sheetId], cmd.rows);
                    break;
                case "ADD_COLUMNS": {
                    this.addColumns(this.sheets[cmd.sheetId], cmd.column, cmd.position, cmd.quantity);
                    break;
                }
                case "ADD_ROWS": {
                    this.addRows(this.sheets[cmd.sheetId], cmd.row, cmd.position, cmd.quantity);
                    break;
                }
                case "UPDATE_CELL_POSITION":
                    if (cmd.cell) {
                        const position = this.cellPosition[cmd.cellId];
                        if (position) {
                            this.history.update("sheets", cmd.sheetId, "rows", position.row, "cells", position.col, undefined);
                        }
                        this.history.update("cellPosition", cmd.cell.id, {
                            row: cmd.row,
                            col: cmd.col,
                            sheetId: cmd.sheetId,
                        });
                        //TODO : remove cell from the command, only store the cellId in sheets[sheet].row[rowIndex].cells[colIndex]
                        this.history.update("sheets", cmd.sheetId, "rows", cmd.row, "cells", cmd.col, cmd.cell);
                    }
                    else {
                        this.history.update("cellPosition", cmd.cellId, undefined);
                        this.history.update("sheets", cmd.sheetId, "rows", cmd.row, "cells", cmd.col, undefined);
                    }
                    break;
            }
        }
        import(data) {
            // we need to fill the sheetIds mapping first, because otherwise formulas
            // that depends on a sheet not already imported will not be able to be
            // compiled
            for (let sheet of data.sheets) {
                this.sheetIds[sheet.name] = sheet.id;
            }
            for (let sheet of data.sheets) {
                this.importSheet(sheet);
            }
        }
        importSheet(data) {
            let { sheets, visibleSheets } = this;
            const name = data.name || `Sheet${Object.keys(sheets).length + 1}`;
            const sheet = {
                id: data.id,
                name: name,
                cols: createCols(data.cols || {}, data.colNumber),
                rows: createRows(data.rows || {}, data.rowNumber),
            };
            visibleSheets = visibleSheets.slice();
            visibleSheets.push(sheet.id);
            this.history.update("visibleSheets", visibleSheets);
            this.history.update("sheets", Object.assign({}, sheets, { [sheet.id]: sheet }));
        }
        export(data) {
            data.sheets = this.visibleSheets.filter(isDefined$1).map((id) => {
                const sheet = this.sheets[id];
                return {
                    id: sheet.id,
                    name: sheet.name,
                    colNumber: sheet.cols.length,
                    rowNumber: sheet.rows.length,
                    rows: exportRows(sheet.rows),
                    cols: exportCols(sheet.cols),
                    merges: [],
                    cells: {},
                    conditionalFormats: [],
                    figures: [],
                };
            });
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        tryGetSheet(sheetId) {
            return this.sheets[sheetId];
        }
        getSheet(sheetId) {
            const sheet = this.sheets[sheetId];
            if (!sheet) {
                throw new Error(`Sheet ${sheetId} not found.`);
            }
            return sheet;
        }
        getSheetName(sheetId) {
            var _a;
            return (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.name;
        }
        getSheetIdByName(name) {
            return name && this.sheetIds[name];
        }
        getSheets() {
            const { visibleSheets, sheets } = this;
            return visibleSheets.map((id) => sheets[id]).filter(isDefined$1);
        }
        getVisibleSheets() {
            return this.visibleSheets;
        }
        getEvaluationSheets() {
            return this.sheets;
        }
        getCol(sheetId, index) {
            var _a;
            return (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.cols[index];
        }
        getRow(sheetId, index) {
            var _a;
            return (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.rows[index];
        }
        applyOffset(sheetId, formula, offsetX, offsetY) {
            return rangeTokenize(formula)
                .map((t) => {
                if (t.type === "SYMBOL" && cellReference.test(t.value)) {
                    const [xcs, sheetName] = t.value.split("!").reverse();
                    const refSheetId = this.getSheetIdByName(sheetName);
                    if (xcs.includes(":")) {
                        return this.updateRange(sheetId, xcs, offsetX, offsetY, refSheetId);
                    }
                    return this.updateReference(sheetId, xcs, offsetX, offsetY, refSheetId);
                }
                return t.value;
            })
                .join("");
        }
        getCell(sheetId, col, row) {
            const sheet = this.tryGetSheet(sheetId);
            return (sheet && sheet.rows[row] && sheet.rows[row].cells[col]) || undefined;
        }
        getCellByXc(sheetId, xc) {
            var _a, _b;
            let [col, row] = toCartesian(xc);
            return (_b = (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.rows[row]) === null || _b === void 0 ? void 0 : _b.cells[col];
        }
        /**
         * Returns all the cells of a col
         */
        getColCells(sheetId, col) {
            return this.getSheet(sheetId).rows.reduce((acc, cur) => {
                const cell = cur.cells[col];
                return cell !== undefined ? acc.concat(cell) : acc;
            }, []);
        }
        getColsZone(sheetId, start, end) {
            return {
                top: 0,
                bottom: this.getSheet(sheetId).rows.length - 1,
                left: start,
                right: end,
            };
        }
        getRowsZone(sheetId, start, end) {
            return {
                top: start,
                bottom: end,
                left: 0,
                right: this.getSheet(sheetId).cols.length - 1,
            };
        }
        getGridSize(sheet) {
            const height = sheet.rows[sheet.rows.length - 1].end + DEFAULT_CELL_HEIGHT + 5;
            const width = sheet.cols[sheet.cols.length - 1].end + DEFAULT_CELL_WIDTH;
            return [width, height];
        }
        getCellPosition(cellId) {
            const cell = this.cellPosition[cellId];
            if (!cell) {
                throw new Error(`asking for a cell position that doesn't exist, cell id: ${cellId}`);
            }
            return cell;
        }
        // ---------------------------------------------------------------------------
        // Row/Col manipulation
        // ---------------------------------------------------------------------------
        setColSize(sheet, index, size) {
            const cols = sheet.cols;
            const col = cols[index];
            const delta = size - col.size;
            this.history.update("sheets", sheet.id, "cols", index, "size", size);
            this.history.update("sheets", sheet.id, "cols", index, "end", col.end + delta);
            for (let i = index + 1; i < cols.length; i++) {
                const col = cols[i];
                this.history.update("sheets", sheet.id, "cols", i, "start", col.start + delta);
                this.history.update("sheets", sheet.id, "cols", i, "end", col.end + delta);
            }
        }
        setRowSize(sheet, index, size) {
            const rows = sheet.rows;
            const row = rows[index];
            const delta = size - row.size;
            this.history.update("sheets", sheet.id, "rows", index, "size", size);
            this.history.update("sheets", sheet.id, "rows", index, "end", row.end + delta);
            for (let i = index + 1; i < rows.length; i++) {
                const row = rows[i];
                this.history.update("sheets", sheet.id, "rows", i, "start", row.start + delta);
                this.history.update("sheets", sheet.id, "rows", i, "end", row.end + delta);
            }
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        clearZones(sheetId, zones) {
            for (let zone of zones) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        const cell = this.sheets[sheetId].rows[row].cells[col];
                        if (cell) {
                            this.dispatch("UPDATE_CELL", {
                                sheetId: sheetId,
                                content: "",
                                col,
                                row,
                            });
                        }
                    }
                }
            }
        }
        generateSheetName() {
            let i = 1;
            const names = this.getSheets().map((s) => s.name);
            const baseName = _lt("Sheet");
            let name = `${baseName}${i}`;
            while (names.includes(name)) {
                name = `${baseName}${i}`;
                i++;
            }
            return name;
        }
        createSheet(id, name, colNumber, rowNumber, position) {
            const sheet = {
                id,
                name,
                cols: createDefaultCols(colNumber),
                rows: createDefaultRows(rowNumber),
            };
            const visibleSheets = this.visibleSheets.slice();
            visibleSheets.splice(position, 0, sheet.id);
            const sheets = this.sheets;
            this.history.update("visibleSheets", visibleSheets);
            this.history.update("sheets", Object.assign({}, sheets, { [sheet.id]: sheet }));
            return sheet;
        }
        moveSheet(sheetId, direction) {
            const visibleSheets = this.visibleSheets.slice();
            const currentIndex = visibleSheets.findIndex((id) => id === sheetId);
            const sheet = visibleSheets.splice(currentIndex, 1);
            visibleSheets.splice(currentIndex + (direction === "left" ? -1 : 1), 0, sheet[0]);
            this.history.update("visibleSheets", visibleSheets);
        }
        isRenameAllowed(cmd) {
            if (cmd.interactive) {
                return { status: "SUCCESS" };
            }
            const name = cmd.name && cmd.name.trim().toLowerCase();
            if (!name) {
                return { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
            }
            return this.visibleSheets.findIndex((id) => { var _a; return ((_a = this.sheets[id]) === null || _a === void 0 ? void 0 : _a.name.toLowerCase()) === name; }) === -1
                ? { status: "SUCCESS" }
                : { status: "CANCELLED", reason: 8 /* WrongSheetName */ };
        }
        renameSheet(sheet, name) {
            const oldName = sheet.name;
            this.history.update("sheets", sheet.id, "name", name.trim());
            const sheetIds = Object.assign({}, this.sheetIds);
            sheetIds[name] = sheet.id;
            delete sheetIds[oldName];
            this.history.update("sheetIds", sheetIds);
        }
        duplicateSheet(fromId, toId, toName) {
            const sheet = this.sheets[fromId];
            const newSheet = JSON.parse(JSON.stringify(sheet));
            newSheet.id = toId;
            newSheet.name = toName;
            const visibleSheets = this.visibleSheets.slice();
            const currentIndex = visibleSheets.findIndex((id) => id === fromId);
            visibleSheets.splice(currentIndex + 1, 0, newSheet.id);
            this.history.update("visibleSheets", visibleSheets);
            this.history.update("sheets", Object.assign({}, this.sheets, { [newSheet.id]: newSheet }));
            const sheetIds = Object.assign({}, this.sheetIds);
            sheetIds[newSheet.name] = newSheet.id;
            this.history.update("sheetIds", sheetIds);
        }
        deleteSheet(sheet) {
            const name = sheet.name;
            const sheets = Object.assign({}, this.sheets);
            delete sheets[sheet.id];
            this.history.update("sheets", sheets);
            const visibleSheets = this.visibleSheets.slice();
            const currentIndex = visibleSheets.findIndex((id) => id === sheet.id);
            visibleSheets.splice(currentIndex, 1);
            this.history.update("visibleSheets", visibleSheets);
            const sheetIds = Object.assign({}, this.sheetIds);
            delete sheetIds[name];
            this.history.update("sheetIds", sheetIds);
        }
        /**
         * Delete column. This requires a lot of handling:
         * - Update all the formulas in all sheets
         * - Move the cells
         * - Update the cols/rows (size, number, (cells), ...)
         * - Reevaluate the cells
         *
         * @param sheet ID of the sheet on which deletion should be applied
         * @param columns Columns to delete
         */
        removeColumns(sheet, columns) {
            // This is necessary because we have to delete elements in correct order:
            // begin with the end.
            columns.sort((a, b) => b - a);
            for (let column of columns) {
                // Move the cells.
                this.moveCellOnColumnsDeletion(sheet, column);
            }
            // Effectively delete the element and recompute the left-right.
            this.updateColumnsStructureOnDeletion(sheet, columns);
        }
        /**
         * Delete row. This requires a lot of handling:
         * - Update the merges
         * - Update all the formulas in all sheets
         * - Move the cells
         * - Update the cols/rows (size, number, (cells), ...)
         * - Reevaluate the cells
         *
         * @param sheet ID of the sheet on which deletion should be applied
         * @param rows Rows to delete
         */
        removeRows(sheet, rows) {
            // This is necessary because we have to delete elements in correct order:
            // begin with the end.
            rows.sort((a, b) => b - a);
            for (let group of groupConsecutive(rows)) {
                // Move the cells.
                this.moveCellOnRowsDeletion(sheet, group[group.length - 1], group[0]);
                // Effectively delete the element and recompute the left-right/top-bottom.
                group.map((row) => this.processRowsHeaderDelete(row, sheet));
            }
        }
        addColumns(sheet, column, position, quantity) {
            // Move the cells.
            this.moveCellOnColumnsAddition(sheet, position === "before" ? column : column + 1, quantity);
            // Recompute the left-right/top-bottom.
            this.updateColumnsStructureOnAddition(sheet, column, quantity);
        }
        addRows(sheet, row, position, quantity) {
            this.addEmptyRows(sheet, quantity);
            // Move the cells.
            this.moveCellOnRowsAddition(sheet, position === "before" ? row : row + 1, quantity);
            // Recompute the left-right/top-bottom.
            this.updateRowsStructureOnAddition(sheet, row, quantity);
        }
        moveCellOnColumnsDeletion(sheet, deletedColumn) {
            for (let [index, row] of Object.entries(sheet.rows)) {
                const rowIndex = parseInt(index, 10);
                for (let i in row.cells) {
                    const colIndex = parseInt(i, 10);
                    const cell = row.cells[i];
                    if (cell) {
                        if (colIndex === deletedColumn) {
                            this.dispatch("CLEAR_CELL", {
                                sheetId: sheet.id,
                                col: colIndex,
                                row: rowIndex,
                            });
                        }
                        if (colIndex > deletedColumn) {
                            this.dispatch("UPDATE_CELL_POSITION", {
                                sheetId: sheet.id,
                                cellId: cell.id,
                                cell: cell,
                                col: colIndex - 1,
                                row: rowIndex,
                            });
                        }
                    }
                }
            }
        }
        /**
         * Move the cells after column addition
         *
         * @param sheet Sheet
         * @param addedColumn Column currently being added
         * @param quantity Number of columns to add
         */
        moveCellOnColumnsAddition(sheet, addedColumn, quantity) {
            const commands = [];
            for (let [index, row] of Object.entries(sheet.rows)) {
                const rowIndex = parseInt(index, 10);
                for (let i in row.cells) {
                    const colIndex = parseInt(i, 10);
                    const cell = row.cells[i];
                    if (cell) {
                        if (colIndex >= addedColumn) {
                            commands.unshift({
                                type: "UPDATE_CELL_POSITION",
                                sheetId: sheet.id,
                                cellId: cell.id,
                                cell: cell,
                                col: colIndex + quantity,
                                row: rowIndex,
                            });
                        }
                    }
                }
            }
            for (let cmd of commands) {
                this.dispatch(cmd.type, cmd);
            }
        }
        /**
         * Move all the cells that are from the row under `deleteToRow` up to `deleteFromRow`
         *
         * b.e.
         * move vertically with delete from 3 and delete to 5 will first clear all the cells from lines 3 to 5,
         * then take all the row starting at index 6 and add them back at index 3
         *
         */
        moveCellOnRowsDeletion(sheet, deleteFromRow, deleteToRow) {
            const numberRows = deleteToRow - deleteFromRow + 1;
            for (let [index, row] of Object.entries(sheet.rows)) {
                const rowIndex = parseInt(index, 10);
                if (rowIndex >= deleteFromRow && rowIndex <= deleteToRow) {
                    for (let i in row.cells) {
                        const colIndex = parseInt(i, 10);
                        const cell = row.cells[i];
                        if (cell) {
                            this.dispatch("CLEAR_CELL", {
                                sheetId: sheet.id,
                                col: colIndex,
                                row: rowIndex,
                            });
                        }
                    }
                }
                if (rowIndex > deleteToRow) {
                    for (let i in row.cells) {
                        const colIndex = parseInt(i, 10);
                        const cell = row.cells[i];
                        if (cell) {
                            this.dispatch("UPDATE_CELL_POSITION", {
                                sheetId: sheet.id,
                                cellId: cell.id,
                                cell: cell,
                                col: colIndex,
                                row: rowIndex - numberRows,
                            });
                        }
                    }
                }
            }
        }
        /**
         * Move the cells after rows addition
         *
         * @param sheet Sheet
         * @param addedRow Row currently being added
         * @param quantity Number of rows to add
         */
        moveCellOnRowsAddition(sheet, addedRow, quantity) {
            const commands = [];
            for (let [index, row] of Object.entries(sheet.rows)) {
                const rowIndex = parseInt(index, 10);
                if (rowIndex >= addedRow) {
                    for (let i in row.cells) {
                        const colIndex = parseInt(i, 10);
                        const cell = row.cells[i];
                        if (cell) {
                            commands.unshift({
                                type: "UPDATE_CELL_POSITION",
                                sheetId: sheet.id,
                                cellId: cell.id,
                                cell: cell,
                                col: colIndex,
                                row: rowIndex + quantity,
                            });
                        }
                    }
                }
            }
            for (let cmd of commands) {
                this.dispatch(cmd.type, cmd);
            }
        }
        /**
         * Update the cols of the sheet after a deletion:
         * - Rename the cols
         * - Update start-end
         *
         * @param sheet Sheet on which the deletion occurs
         * @param deletedColumns Indexes of the deleted columns
         */
        updateColumnsStructureOnDeletion(sheet, deletedColumns) {
            const cols = [];
            let start = 0;
            let colSizeIndex = 0;
            for (let index in sheet.cols) {
                if (deletedColumns.includes(parseInt(index, 10))) {
                    continue;
                }
                const { size } = sheet.cols[index];
                cols.push({
                    name: numberToLetters(colSizeIndex),
                    size,
                    start,
                    end: start + size,
                });
                start += size;
                colSizeIndex++;
            }
            this.history.update("sheets", sheet.id, "cols", cols);
        }
        /**
         * Update the cols of the sheet after an addition:
         * - Rename the cols
         * - Update start-end
         *
         * @param sheet Sheet on which the deletion occurs
         * @param addedColumn Index of the added columns
         * @param columnsToAdd Number of the columns to add
         */
        updateColumnsStructureOnAddition(sheet, addedColumn, columnsToAdd) {
            const cols = [];
            let start = 0;
            let colIndex = 0;
            for (let i in sheet.cols) {
                if (parseInt(i, 10) === addedColumn) {
                    const { size } = sheet.cols[colIndex];
                    for (let a = 0; a < columnsToAdd; a++) {
                        cols.push({
                            name: numberToLetters(colIndex),
                            size,
                            start,
                            end: start + size,
                        });
                        start += size;
                        colIndex++;
                    }
                }
                const { size } = sheet.cols[i];
                cols.push({
                    name: numberToLetters(colIndex),
                    size,
                    start,
                    end: start + size,
                });
                start += size;
                colIndex++;
            }
            this.history.update("sheets", sheet.id, "cols", cols);
        }
        processRowsHeaderDelete(index, sheet) {
            const rows = [];
            let start = 0;
            let rowIndex = 0;
            const cellsQueue = sheet.rows.map((row) => row.cells);
            for (let i in sheet.rows) {
                const row = sheet.rows[i];
                const { size } = row;
                if (parseInt(i, 10) === index) {
                    continue;
                }
                rowIndex++;
                rows.push({
                    start,
                    end: start + size,
                    size,
                    cells: cellsQueue.shift(),
                    name: String(rowIndex),
                });
                start += size;
            }
            this.history.update("sheets", sheet.id, "rows", rows);
        }
        /**
         * Update the rows of the sheet after an addition:
         * - Rename the rows
         * - Update start-end
         *
         * @param sheet Sheet on which the deletion occurs
         * @param addedRow Index of the added row
         * @param rowsToAdd Number of the rows to add
         */
        updateRowsStructureOnAddition(sheet, addedRow, rowsToAdd) {
            const rows = [];
            let start = 0;
            let rowIndex = 0;
            let sizeIndex = 0;
            const cellsQueue = sheet.rows.map((row) => row.cells);
            for (let i in sheet.rows) {
                const { size } = sheet.rows[sizeIndex];
                if (parseInt(i, 10) < addedRow || parseInt(i, 10) >= addedRow + rowsToAdd) {
                    sizeIndex++;
                }
                rowIndex++;
                rows.push({
                    start,
                    end: start + size,
                    size,
                    cells: cellsQueue.shift(),
                    name: String(rowIndex),
                });
                start += size;
            }
            this.history.update("sheets", sheet.id, "rows", rows);
        }
        /**
         * Add empty rows at the end of the rows
         *
         * @param sheet Sheet
         * @param quantity Number of rows to add
         */
        addEmptyRows(sheet, quantity) {
            const lastEnd = sheet.rows[sheet.rows.length - 1].end;
            const rows = sheet.rows.slice();
            for (let i = 0; i < quantity; i++) {
                rows.push({
                    start: lastEnd,
                    end: lastEnd,
                    size: 0,
                    name: (rows.length + 1).toString(),
                    cells: {},
                });
            }
            this.history.update("sheets", sheet.id, "rows", rows);
        }
        // ---------------------------------------------------------------------------
        // Helpers
        // ---------------------------------------------------------------------------
        /**
         * Update a range with some offsets
         */
        updateRange(sheetId, symbol, offsetX, offsetY, refSheetId) {
            let [left, right] = symbol.split(":");
            left = this.updateReference(sheetId, left, offsetX, offsetY, refSheetId);
            right = this.updateReference(sheetId, right, offsetX, offsetY, refSheetId);
            if (left === INCORRECT_RANGE_STRING || right === INCORRECT_RANGE_STRING) {
                return INCORRECT_RANGE_STRING;
            }
            //As updateReference put the sheet in the ref, we need to remove it from the right part
            right = right.split("!").pop();
            return `${left}:${right}`;
        }
        /**
         * Update a reference with some offsets.
         */
        updateReference(sheetId, symbol, offsetX, offsetY, referenceSheetId, updateFreeze = true) {
            const xc = symbol.replace(/\$/g, "");
            let [x, y] = toCartesian(xc);
            const freezeCol = symbol.startsWith("$");
            const freezeRow = symbol.includes("$", 1);
            x += freezeCol && updateFreeze ? 0 : offsetX;
            y += freezeRow && updateFreeze ? 0 : offsetY;
            const sheet = this.getSheet(referenceSheetId || sheetId);
            if (!sheet || x < 0 || x >= sheet.cols.length || y < 0 || y >= sheet.rows.length) {
                return INCORRECT_RANGE_STRING;
            }
            const sheetName = referenceSheetId && getComposerSheetName(this.getters.getSheetName(referenceSheetId));
            return ((sheetName ? `${sheetName}!` : "") +
                (freezeCol ? "$" : "") +
                numberToLetters(x) +
                (freezeRow ? "$" : "") +
                String(y + 1));
        }
    }
    SheetPlugin.getters = [
        "applyOffset",
        "getSheetName",
        "getSheet",
        "tryGetSheet",
        "getSheetIdByName",
        "getSheets",
        "getVisibleSheets",
        "getEvaluationSheets",
        "getCol",
        "getRow",
        "getCell",
        "getCellPosition",
        "getColCells",
        "getGridSize",
        "getColsZone",
        "getRowsZone",
        "getCellByXc",
    ];
    function createDefaultCols(colNumber) {
        const cols = [];
        let current = 0;
        for (let i = 0; i < colNumber; i++) {
            const size = DEFAULT_CELL_WIDTH;
            const col = {
                start: current,
                end: current + size,
                size: size,
                name: numberToLetters(i),
            };
            cols.push(col);
            current = col.end;
        }
        return cols;
    }
    function createDefaultRows(rowNumber) {
        const rows = [];
        let current = 0;
        for (let i = 0; i < rowNumber; i++) {
            const size = DEFAULT_CELL_HEIGHT;
            const row = {
                start: current,
                end: current + size,
                size: size,
                name: String(i + 1),
                cells: {},
            };
            rows.push(row);
            current = row.end;
        }
        return rows;
    }
    function createCols(savedCols, colNumber) {
        const cols = [];
        let current = 0;
        for (let i = 0; i < colNumber; i++) {
            const size = savedCols[i] ? savedCols[i].size || DEFAULT_CELL_WIDTH : DEFAULT_CELL_WIDTH;
            const col = {
                start: current,
                end: current + size,
                size: size,
                name: numberToLetters(i),
            };
            cols.push(col);
            current = col.end;
        }
        return cols;
    }
    function createRows(savedRows, rowNumber) {
        const rows = [];
        let current = 0;
        for (let i = 0; i < rowNumber; i++) {
            const size = savedRows[i] ? savedRows[i].size || DEFAULT_CELL_HEIGHT : DEFAULT_CELL_HEIGHT;
            const row = {
                start: current,
                end: current + size,
                size: size,
                name: String(i + 1),
                cells: {},
            };
            rows.push(row);
            current = row.end;
        }
        return rows;
    }
    function exportCols(cols) {
        const exportedCols = {};
        for (let i in cols) {
            const col = cols[i];
            if (col.size !== DEFAULT_CELL_WIDTH) {
                exportedCols[i] = { size: col.size };
            }
        }
        return exportedCols;
    }
    function exportRows(rows) {
        const exportedRows = {};
        for (let i in rows) {
            const row = rows[i];
            if (row.size !== DEFAULT_CELL_HEIGHT) {
                exportedRows[i] = { size: row.size };
            }
        }
        return exportedRows;
    }

    const autofillModifiersRegistry = new Registry();
    autofillModifiersRegistry
        .add("INCREMENT_MODIFIER", {
        apply: (rule, data) => {
            rule.current += rule.increment;
            const content = rule.current.toString();
            return {
                cellData: Object.assign({}, data, { content }),
                tooltip: content ? { props: { content } } : undefined,
            };
        },
    })
        .add("COPY_MODIFIER", {
        apply: (rule, data) => {
            return {
                cellData: data,
                tooltip: data.content ? { props: { content: data.content } } : undefined,
            };
        },
    })
        .add("FORMULA_MODIFIER", {
        apply: (rule, data, getters, direction) => {
            rule.current += rule.increment;
            let x = 0;
            let y = 0;
            switch (direction) {
                case 0 /* UP */:
                    x = 0;
                    y = -rule.current;
                    break;
                case 1 /* DOWN */:
                    x = 0;
                    y = rule.current;
                    break;
                case 2 /* LEFT */:
                    x = -rule.current;
                    y = 0;
                    break;
                case 3 /* RIGHT */:
                    x = rule.current;
                    y = 0;
                    break;
            }
            const sheetId = getters.getActiveSheetId();
            const content = getters.applyOffset(sheetId, data.content, x, y);
            return {
                cellData: Object.assign({}, data, { content }),
                tooltip: content ? { props: { content } } : undefined,
            };
        },
    });

    const autofillRulesRegistry = new Registry();
    /**
     * Get the consecutive xc that are of type "number" or "date".
     * Return the one which contains the given cell
     */
    function getGroup(cell, cells) {
        let group = [];
        let found = false;
        for (let x of cells) {
            if (x === cell) {
                found = true;
            }
            if (x && x.type === CellType.number) {
                if (typeof x.value === "number") {
                    group.push(x.value);
                }
            }
            else {
                if (found) {
                    return group;
                }
                group = [];
            }
        }
        return group;
    }
    /**
     * Get the average steps between numbers
     */
    function getAverageIncrement(group) {
        const averages = [];
        let last = group[0];
        for (let i = 1; i < group.length; i++) {
            const current = group[i];
            averages.push(current - last);
            last = current;
        }
        return averages.reduce((a, b) => a + b, 0) / averages.length;
    }
    autofillRulesRegistry
        .add("simple_value_copy", {
        condition: (cell, cells) => {
            var _a;
            return (cells.length === 1 &&
                [CellType.text, CellType.number].includes(cell.type) &&
                !((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT)));
        },
        generateRule: () => {
            return { type: "COPY_MODIFIER" };
        },
        sequence: 10,
    })
        .add("copy_text", {
        condition: (cell) => cell.type === CellType.text,
        generateRule: () => {
            return { type: "COPY_MODIFIER" };
        },
        sequence: 20,
    })
        .add("update_formula", {
        condition: (cell) => cell.type === CellType.formula,
        generateRule: (_, cells) => {
            return { type: "FORMULA_MODIFIER", increment: cells.length, current: 0 };
        },
        sequence: 30,
    })
        .add("increment_number", {
        condition: (cell) => cell.type === CellType.number,
        generateRule: (cell, cells) => {
            const group = getGroup(cell, cells);
            let increment = 1;
            if (group.length == 2) {
                increment = (group[1] - group[0]) * 2;
            }
            else if (group.length > 2) {
                increment = getAverageIncrement(group) * group.length;
            }
            return {
                type: "INCREMENT_MODIFIER",
                increment,
                current: typeof cell.value === "number" ? cell.value : 0,
            };
        },
        sequence: 40,
    });

    const figureRegistry = new Registry();

    const DEFAULT_MENU_ITEM = (key) => ({
        isVisible: () => true,
        isEnabled: () => true,
        shortCut: "",
        action: false,
        children: [],
        separator: false,
        id: key,
    });
    function createFullMenuItem(key, value) {
        return Object.assign({}, DEFAULT_MENU_ITEM(key), value);
    }
    /**
     * The class Registry is extended in order to add the function addChild
     *
     */
    class MenuItemRegistry extends Registry {
        /**
         * @override
         */
        add(key, value) {
            this.content[key] = createFullMenuItem(key, value);
            return this;
        }
        /**
         * Add a subitem to an existing item
         * @param path Path of items to add this subitem
         * @param value Subitem to add
         */
        addChild(key, path, value) {
            const root = path.splice(0, 1)[0];
            let node = this.content[root];
            if (!node) {
                throw new Error(`Path ${root + ":" + path.join(":")} not found`);
            }
            for (let p of path) {
                if (typeof node.children === "function") {
                    node = undefined;
                }
                else {
                    node = node.children.find((elt) => elt.id === p);
                }
                if (!node) {
                    throw new Error(`Path ${root + ":" + path.join(":")} not found`);
                }
            }
            node.children.push(createFullMenuItem(key, value));
            return this;
        }
        getChildren(node, env) {
            if (typeof node.children === "function") {
                return node.children(env).sort((a, b) => a.sequence - b.sequence);
            }
            return node.children.sort((a, b) => a.sequence - b.sequence);
        }
        getName(node, env) {
            if (typeof node.name === "function") {
                return node.name(env);
            }
            return node.name;
        }
        getShortCut(node) {
            return node.shortCut ? node.shortCut : "";
        }
        /**
         * Get a list of all elements in the registry, ordered by sequence
         * @override
         */
        getAll() {
            return super.getAll().sort((a, b) => a.sequence - b.sequence);
        }
    }

    //------------------------------------------------------------------------------
    // Helpers
    //------------------------------------------------------------------------------
    function getColumnsNumber(env) {
        const activeCols = env.getters.getActiveCols();
        if (activeCols.size) {
            return activeCols.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            return zone.right - zone.left + 1;
        }
    }
    function getRowsNumber(env) {
        const activeRows = env.getters.getActiveRows();
        if (activeRows.size) {
            return activeRows.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            return zone.bottom - zone.top + 1;
        }
    }
    function setFormatter(env, formatter) {
        env.dispatch("SET_FORMATTER", {
            sheetId: env.getters.getActiveSheetId(),
            target: env.getters.getSelectedZones(),
            formatter,
        });
    }
    function setStyle(env, style) {
        env.dispatch("SET_FORMATTING", {
            sheetId: env.getters.getActiveSheetId(),
            target: env.getters.getSelectedZones(),
            style,
        });
    }
    //------------------------------------------------------------------------------
    // Simple actions
    //------------------------------------------------------------------------------
    const UNDO_ACTION = (env) => env.dispatch("UNDO");
    const REDO_ACTION = (env) => env.dispatch("REDO");
    const COPY_ACTION = async (env) => {
        env.dispatch("COPY", { target: env.getters.getSelectedZones() });
        await env.clipboard.writeText(env.getters.getClipboardContent());
    };
    const CUT_ACTION = async (env) => {
        env.dispatch("CUT", { target: env.getters.getSelectedZones() });
        await env.clipboard.writeText(env.getters.getClipboardContent());
    };
    const PASTE_ACTION = async (env) => {
        const spreadsheetClipboard = env.getters.getClipboardContent();
        let osClipboard;
        try {
            osClipboard = await env.clipboard.readText();
        }
        catch (e) {
            // Permission is required to read the clipboard.
            console.warn("The OS clipboard could not be read.");
            console.error(e);
        }
        const target = env.getters.getSelectedZones();
        if (osClipboard && osClipboard !== spreadsheetClipboard) {
            env.dispatch("PASTE_FROM_OS_CLIPBOARD", {
                target,
                text: osClipboard,
            });
        }
        else {
            env.dispatch("PASTE", { target, interactive: true });
        }
    };
    const PASTE_VALUE_ACTION = (env) => env.dispatch("PASTE", { target: env.getters.getSelectedZones(), onlyValue: true });
    const PASTE_FORMAT_ACTION = (env) => env.dispatch("PASTE", { target: env.getters.getSelectedZones(), onlyFormat: true });
    const DELETE_CONTENT_ACTION = (env) => env.dispatch("DELETE_CONTENT", {
        sheetId: env.getters.getActiveSheetId(),
        target: env.getters.getSelectedZones(),
    });
    const SET_FORMULA_VISIBILITY_ACTION = (env) => env.dispatch("SET_FORMULA_VISIBILITY", { show: !env.getters.shouldShowFormulas() });
    //------------------------------------------------------------------------------
    // Grid manipulations
    //------------------------------------------------------------------------------
    const DELETE_CONTENT_ROWS_NAME = (env) => {
        let first;
        let last;
        const activesRows = env.getters.getActiveRows();
        if (activesRows.size !== 0) {
            first = Math.min(...activesRows);
            last = Math.max(...activesRows);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.top;
            last = zone.bottom;
        }
        if (first === last) {
            return _lt("Clear row %s", (first + 1).toString());
        }
        return _lt("Clear rows %s - %s", (first + 1).toString(), (last + 1).toString());
    };
    const DELETE_CONTENT_ROWS_ACTION = (env) => {
        const sheetId = env.getters.getActiveSheetId();
        const target = [...env.getters.getActiveRows()].map((index) => env.getters.getRowsZone(sheetId, index, index));
        env.dispatch("DELETE_CONTENT", {
            target,
            sheetId: env.getters.getActiveSheetId(),
        });
    };
    const DELETE_CONTENT_COLUMNS_NAME = (env) => {
        let first;
        let last;
        const activeCols = env.getters.getActiveCols();
        if (activeCols.size !== 0) {
            first = Math.min(...activeCols);
            last = Math.max(...activeCols);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.left;
            last = zone.right;
        }
        if (first === last) {
            return _lt("Clear column %s", numberToLetters(first));
        }
        return _lt("Clear columns %s - %s", numberToLetters(first), numberToLetters(last));
    };
    const DELETE_CONTENT_COLUMNS_ACTION = (env) => {
        const sheetId = env.getters.getActiveSheetId();
        const target = [...env.getters.getActiveCols()].map((index) => env.getters.getColsZone(sheetId, index, index));
        env.dispatch("DELETE_CONTENT", {
            target,
            sheetId: env.getters.getActiveSheetId(),
        });
    };
    const REMOVE_ROWS_NAME = (env) => {
        let first;
        let last;
        const activesRows = env.getters.getActiveRows();
        if (activesRows.size !== 0) {
            first = Math.min(...activesRows);
            last = Math.max(...activesRows);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.top;
            last = zone.bottom;
        }
        if (first === last) {
            return _lt("Delete row %s", (first + 1).toString());
        }
        return _lt("Delete rows %s - %s", (first + 1).toString(), (last + 1).toString());
    };
    const REMOVE_ROWS_ACTION = (env) => {
        let rows = [...env.getters.getActiveRows()];
        if (!rows.length) {
            const zone = env.getters.getSelectedZones()[0];
            for (let i = zone.top; i <= zone.bottom; i++) {
                rows.push(i);
            }
        }
        env.dispatch("REMOVE_ROWS", {
            sheetId: env.getters.getActiveSheetId(),
            rows,
        });
    };
    const REMOVE_COLUMNS_NAME = (env) => {
        let first;
        let last;
        const activeCols = env.getters.getActiveCols();
        if (activeCols.size !== 0) {
            first = Math.min(...activeCols);
            last = Math.max(...activeCols);
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            first = zone.left;
            last = zone.right;
        }
        if (first === last) {
            return _lt("Delete column %s", numberToLetters(first));
        }
        return _lt("Delete columns %s - %s", numberToLetters(first), numberToLetters(last));
    };
    const REMOVE_COLUMNS_ACTION = (env) => {
        let columns = [...env.getters.getActiveCols()];
        if (!columns.length) {
            const zone = env.getters.getSelectedZones()[0];
            for (let i = zone.left; i <= zone.right; i++) {
                columns.push(i);
            }
        }
        env.dispatch("REMOVE_COLUMNS", {
            sheetId: env.getters.getActiveSheetId(),
            columns,
        });
    };
    const MENU_INSERT_ROWS_BEFORE_NAME = (env) => {
        const number = getRowsNumber(env);
        if (number === 1) {
            return _lt("Row above");
        }
        return _lt("%s Rows above", number.toString());
    };
    const ROW_INSERT_ROWS_BEFORE_NAME = (env) => {
        const number = getRowsNumber(env);
        return number === 1 ? _lt("Insert row above") : _lt("Insert %s rows above", number.toString());
    };
    const CELL_INSERT_ROWS_BEFORE_NAME = (env) => {
        const number = getRowsNumber(env);
        if (number === 1) {
            return _lt("Insert row");
        }
        return _lt("Insert %s rows", number.toString());
    };
    const INSERT_ROWS_BEFORE_ACTION = (env) => {
        const activeRows = env.getters.getActiveRows();
        let row;
        let quantity;
        if (activeRows.size) {
            row = Math.min(...activeRows);
            quantity = activeRows.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            row = zone.top;
            quantity = zone.bottom - zone.top + 1;
        }
        env.dispatch("ADD_ROWS", {
            sheetId: env.getters.getActiveSheetId(),
            position: "before",
            row,
            quantity,
        });
    };
    const MENU_INSERT_ROWS_AFTER_NAME = (env) => {
        const number = getRowsNumber(env);
        if (number === 1) {
            return _lt("Row below");
        }
        return _lt("%s Rows below", number.toString());
    };
    const ROW_INSERT_ROWS_AFTER_NAME = (env) => {
        const number = getRowsNumber(env);
        return number === 1 ? _lt("Insert row below") : _lt("Insert %s rows below", number.toString());
    };
    const INSERT_ROWS_AFTER_ACTION = (env) => {
        const activeRows = env.getters.getActiveRows();
        let row;
        let quantity;
        if (activeRows.size) {
            row = Math.max(...activeRows);
            quantity = activeRows.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            row = zone.bottom;
            quantity = zone.bottom - zone.top + 1;
        }
        env.dispatch("ADD_ROWS", {
            sheetId: env.getters.getActiveSheetId(),
            position: "after",
            row,
            quantity,
        });
    };
    const MENU_INSERT_COLUMNS_BEFORE_NAME = (env) => {
        const number = getColumnsNumber(env);
        if (number === 1) {
            return _lt("Column left");
        }
        return _lt("%s Columns left", number.toString());
    };
    const COLUMN_INSERT_COLUMNS_BEFORE_NAME = (env) => {
        const number = getColumnsNumber(env);
        return number === 1
            ? _lt("Insert column left")
            : _lt("Insert %s columns left", number.toString());
    };
    const CELL_INSERT_COLUMNS_BEFORE_NAME = (env) => {
        const number = getColumnsNumber(env);
        if (number === 1) {
            return _lt("Insert column");
        }
        return _lt("Insert %s columns", number.toString());
    };
    const INSERT_COLUMNS_BEFORE_ACTION = (env) => {
        const activeCols = env.getters.getActiveCols();
        let column;
        let quantity;
        if (activeCols.size) {
            column = Math.min(...activeCols);
            quantity = activeCols.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            column = zone.left;
            quantity = zone.right - zone.left + 1;
        }
        env.dispatch("ADD_COLUMNS", {
            sheetId: env.getters.getActiveSheetId(),
            position: "before",
            column,
            quantity,
        });
    };
    const MENU_INSERT_COLUMNS_AFTER_NAME = (env) => {
        const number = getColumnsNumber(env);
        if (number === 1) {
            return _lt("Column right");
        }
        return _lt("%s Columns right", number.toString());
    };
    const COLUMN_INSERT_COLUMNS_AFTER_NAME = (env) => {
        const number = getColumnsNumber(env);
        return number === 1
            ? _lt("Insert column right")
            : _lt("Insert %s columns right", number.toString());
    };
    const INSERT_COLUMNS_AFTER_ACTION = (env) => {
        const activeCols = env.getters.getActiveCols();
        let column;
        let quantity;
        if (activeCols.size) {
            column = Math.max(...activeCols);
            quantity = activeCols.size;
        }
        else {
            const zone = env.getters.getSelectedZones()[0];
            column = zone.right;
            quantity = zone.right - zone.left + 1;
        }
        env.dispatch("ADD_COLUMNS", {
            sheetId: env.getters.getActiveSheetId(),
            position: "after",
            column,
            quantity,
        });
    };
    //------------------------------------------------------------------------------
    // Sheets
    //------------------------------------------------------------------------------
    const CREATE_SHEET_ACTION = (env) => {
        const position = env.getters
            .getVisibleSheets()
            .findIndex((sheetId) => sheetId === env.getters.getActiveSheetId()) + 1;
        env.dispatch("CREATE_SHEET", { activate: true, sheetId: uuidv4(), position });
    };
    //------------------------------------------------------------------------------
    // Charts
    //------------------------------------------------------------------------------
    const CREATE_CHART = (env) => {
        env.openSidePanel("ChartPanel");
    };
    //------------------------------------------------------------------------------
    // Style/Format
    //------------------------------------------------------------------------------
    const FORMAT_GENERAL_ACTION = (env) => setFormatter(env, "");
    const FORMAT_NUMBER_ACTION = (env) => setFormatter(env, "#,##0.00");
    const FORMAT_PERCENT_ACTION = (env) => setFormatter(env, "0.00%");
    const FORMAT_DATE_ACTION = (env) => setFormatter(env, "m/d/yyyy");
    const FORMAT_TIME_ACTION = (env) => setFormatter(env, "hh:mm:ss a");
    const FORMAT_DATE_TIME_ACTION = (env) => setFormatter(env, "m/d/yyyy hh:mm:ss");
    const FORMAT_DURATION_ACTION = (env) => setFormatter(env, "hhhh:mm:ss");
    const FORMAT_BOLD_ACTION = (env) => setStyle(env, { bold: !env.getters.getCurrentStyle().bold });
    const FORMAT_ITALIC_ACTION = (env) => setStyle(env, { italic: !env.getters.getCurrentStyle().italic });
    const FORMAT_STRIKETHROUGH_ACTION = (env) => setStyle(env, { strikethrough: !env.getters.getCurrentStyle().strikethrough });
    //------------------------------------------------------------------------------
    // Side panel
    //------------------------------------------------------------------------------
    const OPEN_CF_SIDEPANEL_ACTION = (env) => {
        env.openSidePanel("ConditionalFormatting", { selection: env.getters.getSelectedZones() });
    };
    const OPEN_FAR_SIDEPANEL_ACTION = (env) => {
        env.openSidePanel("FindAndReplace", {});
    };
    //------------------------------------------------------------------------------
    // Sorting action
    //------------------------------------------------------------------------------
    const SORT_CELLS_ASCENDING = (env) => {
        const { anchor, zones } = env.getters.getSelection();
        env.dispatch("SORT_CELLS", {
            interactive: true,
            sheetId: env.getters.getActiveSheetId(),
            anchor: anchor,
            zone: zones[0],
            sortDirection: "ascending",
        });
    };
    const SORT_CELLS_DESCENDING = (env) => {
        const { anchor, zones } = env.getters.getSelection();
        env.dispatch("SORT_CELLS", {
            interactive: true,
            sheetId: env.getters.getActiveSheetId(),
            anchor: anchor,
            zone: zones[0],
            sortDirection: "descending",
        });
    };
    const SORT_CELLS_VISIBILITY = (env) => {
        return env.getters.getSelectedZones().length === 1;
    };

    //------------------------------------------------------------------------------
    // Context Menu Registry
    //------------------------------------------------------------------------------
    const cellMenuRegistry = new MenuItemRegistry();
    cellMenuRegistry
        .add("cut", {
        name: _lt("Cut"),
        shortCut: "Ctrl+X",
        sequence: 10,
        action: CUT_ACTION,
    })
        .add("copy", {
        name: _lt("Copy"),
        shortCut: "Ctrl+C",
        sequence: 20,
        action: COPY_ACTION,
    })
        .add("paste", {
        name: _lt("Paste"),
        shortCut: "Ctrl+V",
        sequence: 30,
        action: PASTE_ACTION,
    })
        .add("paste_special", {
        name: _lt("Paste special"),
        sequence: 40,
        separator: true,
    })
        .addChild("paste_value_only", ["paste_special"], {
        name: _lt("Paste values only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_format_only", ["paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .add("sort_ascending", {
        name: _lt("Ascending Sort"),
        sequence: 50,
        action: SORT_CELLS_ASCENDING,
        isVisible: SORT_CELLS_VISIBILITY,
    })
        .add("sort_descending", {
        name: _lt("Descending Sort"),
        sequence: 60,
        action: SORT_CELLS_DESCENDING,
        separator: true,
        isVisible: SORT_CELLS_VISIBILITY,
    })
        .add("add_row_before", {
        name: CELL_INSERT_ROWS_BEFORE_NAME,
        sequence: 70,
        action: INSERT_ROWS_BEFORE_ACTION,
    })
        .add("add_column_before", {
        name: CELL_INSERT_COLUMNS_BEFORE_NAME,
        sequence: 90,
        action: INSERT_COLUMNS_BEFORE_ACTION,
        separator: true,
    })
        .add("delete_row", {
        name: REMOVE_ROWS_NAME,
        sequence: 110,
        action: REMOVE_ROWS_ACTION,
    })
        .add("delete_column", {
        name: REMOVE_COLUMNS_NAME,
        sequence: 120,
        action: REMOVE_COLUMNS_ACTION,
        separator: true,
    })
        .add("clear_cell", {
        name: _lt("Clear cell"),
        sequence: 130,
        action: DELETE_CONTENT_ACTION,
        isEnabled: (env) => {
            const cell = env.getters.getActiveCell();
            return Boolean(cell);
        },
    })
        .add("conditional_formatting", {
        name: _lt("Conditional formatting"),
        sequence: 140,
        action: OPEN_CF_SIDEPANEL_ACTION,
        separator: true,
    });

    const colMenuRegistry = new MenuItemRegistry();
    colMenuRegistry
        .add("cut", {
        name: _lt("Cut"),
        shortCut: "Ctrl+X",
        sequence: 10,
        action: CUT_ACTION,
    })
        .add("copy", {
        name: _lt("Copy"),
        shortCut: "Ctrl+C",
        sequence: 20,
        action: COPY_ACTION,
    })
        .add("paste", {
        name: _lt("Paste"),
        shortCut: "Ctrl+V",
        sequence: 30,
        action: PASTE_ACTION,
    })
        .add("paste_special", {
        name: _lt("Paste special"),
        sequence: 40,
        separator: true,
    })
        .addChild("paste_value_only", ["paste_special"], {
        name: _lt("Paste value only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_format_only", ["paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .add("sort_ascending", {
        name: _lt("Ascending Sort"),
        sequence: 50,
        action: SORT_CELLS_ASCENDING,
        isVisible: SORT_CELLS_VISIBILITY,
    })
        .add("sort_descending", {
        name: _lt("Descending Sort"),
        sequence: 60,
        action: SORT_CELLS_DESCENDING,
        isVisible: SORT_CELLS_VISIBILITY,
        separator: true,
    })
        .add("add_column_before", {
        name: COLUMN_INSERT_COLUMNS_BEFORE_NAME,
        sequence: 70,
        action: INSERT_COLUMNS_BEFORE_ACTION,
    })
        .add("add_column_after", {
        name: COLUMN_INSERT_COLUMNS_AFTER_NAME,
        sequence: 80,
        action: INSERT_COLUMNS_AFTER_ACTION,
    })
        .add("delete_column", {
        name: REMOVE_COLUMNS_NAME,
        sequence: 90,
        action: REMOVE_COLUMNS_ACTION,
    })
        .add("clear_column", {
        name: DELETE_CONTENT_COLUMNS_NAME,
        sequence: 100,
        action: DELETE_CONTENT_COLUMNS_ACTION,
        separator: true,
    })
        .add("conditional_formatting", {
        name: _lt("Conditional formatting"),
        sequence: 110,
        action: OPEN_CF_SIDEPANEL_ACTION,
    });

    const rowMenuRegistry = new MenuItemRegistry();
    rowMenuRegistry
        .add("cut", {
        name: _lt("Cut"),
        sequence: 10,
        shortCut: "Ctrl+X",
        action: CUT_ACTION,
    })
        .add("copy", {
        name: _lt("Copy"),
        shortCut: "Ctrl+C",
        sequence: 20,
        action: COPY_ACTION,
    })
        .add("paste", {
        name: _lt("Paste"),
        shortCut: "Ctrl+V",
        sequence: 30,
        action: PASTE_ACTION,
    })
        .add("paste_special", {
        name: _lt("Paste special"),
        sequence: 40,
        separator: true,
    })
        .addChild("paste_value_only", ["paste_special"], {
        name: _lt("Paste value only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_format_only", ["paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .add("add_row_before", {
        name: ROW_INSERT_ROWS_BEFORE_NAME,
        sequence: 50,
        action: INSERT_ROWS_BEFORE_ACTION,
    })
        .add("add_row_after", {
        name: ROW_INSERT_ROWS_AFTER_NAME,
        sequence: 60,
        action: INSERT_ROWS_AFTER_ACTION,
    })
        .add("delete_row", {
        name: REMOVE_ROWS_NAME,
        sequence: 70,
        action: REMOVE_ROWS_ACTION,
    })
        .add("clear_row", {
        name: DELETE_CONTENT_ROWS_NAME,
        sequence: 80,
        action: DELETE_CONTENT_ROWS_ACTION,
        separator: true,
    })
        .add("conditional_formatting", {
        name: _lt("Conditional formatting"),
        sequence: 90,
        action: OPEN_CF_SIDEPANEL_ACTION,
    });

    const sheetMenuRegistry = new MenuItemRegistry();
    function getDuplicateSheetName(env, sheet) {
        let i = 1;
        const names = env.getters.getSheets().map((s) => s.name);
        const baseName = env._t(`Copy of ${sheet}`);
        let name = baseName;
        while (names.includes(name)) {
            name = `${baseName} (${i})`;
            i++;
        }
        return name;
    }
    sheetMenuRegistry
        .add("delete", {
        name: _lt("Delete"),
        sequence: 10,
        isVisible: (env) => {
            return env.getters.getSheets().length > 1;
        },
        action: (env) => env.dispatch("DELETE_SHEET_CONFIRMATION", { sheetId: env.getters.getActiveSheetId() }),
    })
        .add("duplicate", {
        name: _lt("Duplicate"),
        sequence: 20,
        action: (env) => {
            const sheet = env.getters.getActiveSheetId();
            const name = getDuplicateSheetName(env, env.getters.getSheets().find((s) => s.id === sheet).name);
            env.dispatch("DUPLICATE_SHEET", {
                sheetIdFrom: sheet,
                sheetIdTo: uuidv4(),
                name,
            });
        },
    })
        .add("rename", {
        name: _lt("Rename"),
        sequence: 30,
        action: (env) => env.dispatch("RENAME_SHEET", {
            interactive: true,
            sheetId: env.getters.getActiveSheetId(),
        }),
    })
        .add("move_right", {
        name: _lt("Move right"),
        sequence: 40,
        isVisible: (env) => {
            const sheet = env.getters.getActiveSheetId();
            const sheets = env.getters.getSheets();
            return sheets.findIndex((s) => s.id === sheet) !== sheets.length - 1;
        },
        action: (env) => env.dispatch("MOVE_SHEET", { sheetId: env.getters.getActiveSheetId(), direction: "right" }),
    })
        .add("move_left", {
        name: _lt("Move left"),
        sequence: 50,
        isVisible: (env) => {
            const sheet = env.getters.getActiveSheetId();
            return env.getters.getSheets().findIndex((s) => s.id === sheet) !== 0;
        },
        action: (env) => env.dispatch("MOVE_SHEET", { sheetId: env.getters.getActiveSheetId(), direction: "left" }),
    });

    const topbarMenuRegistry = new MenuItemRegistry();
    topbarMenuRegistry
        .add("file", { name: _lt("File"), sequence: 10 })
        .add("edit", { name: _lt("Edit"), sequence: 20 })
        .add("view", { name: _lt("View"), sequence: 30 })
        .add("insert", { name: _lt("Insert"), sequence: 40 })
        .add("format", { name: _lt("Format"), sequence: 50 })
        .add("data", { name: _lt("Data"), sequence: 60 })
        .addChild("save", ["file"], {
        name: _lt("Save"),
        shortCut: "Ctrl+S",
        sequence: 10,
        action: () => console.log("Not implemented"),
    })
        .addChild("undo", ["edit"], {
        name: _lt("Undo"),
        shortCut: "Ctrl+Z",
        sequence: 10,
        action: UNDO_ACTION,
    })
        .addChild("redo", ["edit"], {
        name: _lt("Redo"),
        shortCut: "Ctrl+Y",
        sequence: 20,
        action: REDO_ACTION,
        separator: true,
    })
        .addChild("copy", ["edit"], {
        name: _lt("Copy"),
        shortCut: "Ctrl+C",
        sequence: 30,
        action: COPY_ACTION,
    })
        .addChild("cut", ["edit"], {
        name: _lt("Cut"),
        shortCut: "Ctrl+X",
        sequence: 40,
        action: CUT_ACTION,
    })
        .addChild("paste", ["edit"], {
        name: _lt("Paste"),
        shortCut: "Ctrl+V",
        sequence: 50,
        action: PASTE_ACTION,
    })
        .addChild("paste_special", ["edit"], {
        name: _lt("Paste special"),
        sequence: 60,
        separator: true,
    })
        .addChild("paste_special_value", ["edit", "paste_special"], {
        name: _lt("Paste value only"),
        sequence: 10,
        action: PASTE_VALUE_ACTION,
    })
        .addChild("paste_special_format", ["edit", "paste_special"], {
        name: _lt("Paste format only"),
        sequence: 20,
        action: PASTE_FORMAT_ACTION,
    })
        .addChild("sort_ascending", ["edit"], {
        name: _lt("Ascending Sort"),
        sequence: 62,
        action: SORT_CELLS_ASCENDING,
        isVisible: SORT_CELLS_VISIBILITY,
    })
        .addChild("sort_descending", ["edit"], {
        name: _lt("Descending Sort"),
        sequence: 63,
        action: SORT_CELLS_DESCENDING,
        isVisible: SORT_CELLS_VISIBILITY,
        separator: true,
    })
        .addChild("find_and_replace", ["edit"], {
        name: _lt("Find and replace"),
        shortCut: "Ctrl+H",
        sequence: 65,
        action: OPEN_FAR_SIDEPANEL_ACTION,
        separator: true,
    })
        .addChild("edit_delete_cell_values", ["edit"], {
        name: _lt("Delete values"),
        sequence: 70,
        action: DELETE_CONTENT_ACTION,
    })
        .addChild("edit_delete_row", ["edit"], {
        name: REMOVE_ROWS_NAME,
        sequence: 80,
        action: REMOVE_ROWS_ACTION,
    })
        .addChild("edit_delete_column", ["edit"], {
        name: REMOVE_COLUMNS_NAME,
        sequence: 90,
        action: REMOVE_COLUMNS_ACTION,
    })
        .addChild("insert_row_before", ["insert"], {
        name: MENU_INSERT_ROWS_BEFORE_NAME,
        sequence: 10,
        action: INSERT_ROWS_BEFORE_ACTION,
        isVisible: (env) => env.getters.getActiveCols().size === 0,
    })
        .addChild("insert_row_after", ["insert"], {
        name: MENU_INSERT_ROWS_AFTER_NAME,
        sequence: 20,
        action: INSERT_ROWS_AFTER_ACTION,
        isVisible: (env) => env.getters.getActiveCols().size === 0,
        separator: true,
    })
        .addChild("insert_column_before", ["insert"], {
        name: MENU_INSERT_COLUMNS_BEFORE_NAME,
        sequence: 30,
        action: INSERT_COLUMNS_BEFORE_ACTION,
        isVisible: (env) => env.getters.getActiveRows().size === 0,
    })
        .addChild("insert_column_after", ["insert"], {
        name: MENU_INSERT_COLUMNS_AFTER_NAME,
        sequence: 40,
        action: INSERT_COLUMNS_AFTER_ACTION,
        isVisible: (env) => env.getters.getActiveRows().size === 0,
        separator: true,
    })
        .addChild("insert_chart", ["insert"], {
        name: _lt("Chart"),
        sequence: 50,
        action: CREATE_CHART,
        separator: true,
    })
        .addChild("insert_sheet", ["insert"], {
        name: _lt("New sheet"),
        sequence: 60,
        action: CREATE_SHEET_ACTION,
        separator: true,
    })
        .addChild("view_formulas", ["view"], {
        name: (env) => env.getters.shouldShowFormulas() ? _lt("Hide formulas") : _lt("Show formulas"),
        action: SET_FORMULA_VISIBILITY_ACTION,
        sequence: 10,
    })
        .addChild("format_number", ["format"], {
        name: _lt("Numbers"),
        sequence: 10,
        separator: true,
    })
        .addChild("format_number_general", ["format", "format_number"], {
        name: _lt("General"),
        sequence: 10,
        separator: true,
        action: FORMAT_GENERAL_ACTION,
    })
        .addChild("format_number_number", ["format", "format_number"], {
        name: _lt("Number (1,000.12)"),
        sequence: 20,
        action: FORMAT_NUMBER_ACTION,
    })
        .addChild("format_number_percent", ["format", "format_number"], {
        name: _lt("Percent (10.12%)"),
        sequence: 30,
        separator: true,
        action: FORMAT_PERCENT_ACTION,
    })
        .addChild("format_number_date", ["format", "format_number"], {
        name: _lt("Date (9/26/2008)"),
        sequence: 40,
        action: FORMAT_DATE_ACTION,
    })
        .addChild("format_number_time", ["format", "format_number"], {
        name: _lt("Time (10:43:00 PM)"),
        sequence: 50,
        action: FORMAT_TIME_ACTION,
    })
        .addChild("format_number_date_time", ["format", "format_number"], {
        name: _lt("Date time (9/26/2008 22:43:00)"),
        sequence: 60,
        action: FORMAT_DATE_TIME_ACTION,
    })
        .addChild("format_number_duration", ["format", "format_number"], {
        name: _lt("Duration (27:51:38)"),
        sequence: 70,
        separator: true,
        action: FORMAT_DURATION_ACTION,
    })
        .addChild("format_bold", ["format"], {
        name: _lt("Bold"),
        sequence: 20,
        shortCut: "Ctrl+B",
        action: FORMAT_BOLD_ACTION,
    })
        .addChild("format_italic", ["format"], {
        name: _lt("Italic"),
        sequence: 30,
        shortCut: "Ctrl+I",
        action: FORMAT_ITALIC_ACTION,
    })
        // .addChild("format_underline", ["format"], {
        //   Underline is not yet implemented
        //   name: _lt("Underline"),
        //   sequence: 40,
        // })
        .addChild("format_strikethrough", ["format"], {
        name: _lt("Strikethrough"),
        sequence: 50,
        action: FORMAT_STRIKETHROUGH_ACTION,
        separator: true,
    })
        .addChild("format_font_size", ["format"], {
        name: _lt("Font size"),
        sequence: 60,
        separator: true,
    })
        .addChild("format_cf", ["format"], {
        name: _lt("Conditional formatting"),
        sequence: 70,
        action: OPEN_CF_SIDEPANEL_ACTION,
        separator: true,
    });
    // Font-sizes
    for (let fs of fontSizes) {
        topbarMenuRegistry.addChild(`format_font_size_${fs.pt}`, ["format", "format_font_size"], {
            name: fs.pt.toString(),
            sequence: fs.pt,
            action: (env) => setStyle(env, { fontSize: fs.pt }),
        });
    }

    const { Component } = owl__namespace;
    const { xml, css } = owl.tags;
    const TEMPLATE = xml /* xml */ `
  <div class="o-selection">
    <t t-foreach="ranges" t-as="range" t-key="range.id">
      <input
        type="text"
        spellcheck="false"
        t-on-change="onInputChanged(range.id)"
        t-on-focus="focus(range.id)"
        t-att-value="range.xc"
        t-attf-style="color: {{range.color || '#000'}}"
        t-att-class="range.isFocused ? 'o-focused' : ''"
      />
      <button
        class="o-remove-selection"
        t-if="ranges.length > 1"
        t-on-click="removeInput(range.id)">✖</button>
    </t>

    <div class="o-selection-controls">
      <button
        t-if="canAddRange"
        t-on-click="addEmptyInput"
        class="o-btn o-add-selection">Add another range</button>
      <button
        class="o-btn o-selection-ok"
        t-if="hasFocus"
        t-on-click="disable">OK</button>
    </div>
  </div>`;
    const CSS = css /* scss */ `
  .o-selection {
    input {
      padding: 4px 6px;
      border-radius: 4px;
      box-sizing: border-box;
      border: 1px solid #dadce0;
      width: 100%;
    }
    input:focus {
      outline: none;
    }
    input.o-focused {
      border-color: #3266ca;
      border-width: 2px;
      padding: 3px 5px;
    }
    button.o-remove-selection {
      margin-left: -30px;
      background: transparent;
      border: none;
      color: #333;
      cursor: pointer;
    }
    button.o-btn {
      margin: 8px 1px;
      border-radius: 4px;
      background: transparent;
      border: 1px solid #dadce0;
      color: #188038;
      font-weight: bold;
      font-size: 14px;
      height: 25px;
    }
  }
`;
    /**
     * This component can be used when the user needs to input some
     * ranges. He can either input the ranges with the regular DOM `<input/>`
     * displayed or by selecting zones on the grid.
     *
     * A `selection-changed` event is triggered every time the input value
     * changes.
     */
    class SelectionInput extends Component {
        constructor() {
            super(...arguments);
            this.id = uuidv4();
            this.previousRanges = this.props.ranges || [];
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.originSheet = this.env.getters.getActiveSheetId();
        }
        get ranges() {
            const ranges = this.getters.getSelectionInput(this.id);
            return ranges.length
                ? ranges
                : this.props.ranges
                    ? this.props.ranges.map((xc) => ({
                        xc,
                        id: uuidv4(),
                        isFocused: false,
                    }))
                    : [];
        }
        get hasFocus() {
            return this.ranges.filter((i) => i.isFocused).length > 0;
        }
        get canAddRange() {
            return !this.props.maximumRanges || this.ranges.length < this.props.maximumRanges;
        }
        mounted() {
            this.dispatch("ENABLE_NEW_SELECTION_INPUT", {
                id: this.id,
                initialRanges: this.props.ranges,
                maximumRanges: this.props.maximumRanges,
            });
        }
        async willUnmount() {
            this.dispatch("DISABLE_SELECTION_INPUT", { id: this.id });
        }
        async patched() {
            const value = this.getters.getSelectionInputValue(this.id);
            if (this.previousRanges.join() !== value.join()) {
                this.triggerChange();
            }
        }
        triggerChange() {
            const ranges = this.getters.getSelectionInputValue(this.id);
            this.trigger("selection-changed", { ranges });
            this.previousRanges = ranges;
        }
        focus(rangeId) {
            this.dispatch("FOCUS_RANGE", {
                id: this.id,
                rangeId,
            });
        }
        addEmptyInput() {
            this.dispatch("ADD_EMPTY_RANGE", { id: this.id });
        }
        removeInput(rangeId) {
            this.dispatch("REMOVE_RANGE", { id: this.id, rangeId });
            this.triggerChange();
        }
        onInputChanged(rangeId, ev) {
            const target = ev.target;
            this.dispatch("CHANGE_RANGE", {
                id: this.id,
                rangeId,
                value: target.value,
            });
            target.blur();
            this.triggerChange();
        }
        disable() {
            this.dispatch("FOCUS_RANGE", {
                id: this.id,
                rangeId: null,
            });
            const activeSheetId = this.getters.getActiveSheetId();
            if (this.originSheet !== activeSheetId) {
                this.dispatch("ACTIVATE_SHEET", {
                    sheetIdFrom: activeSheetId,
                    sheetIdTo: this.originSheet,
                });
            }
        }
    }
    SelectionInput.template = TEMPLATE;
    SelectionInput.style = CSS;

    const conditionalFormatingTerms = {
        CF_TITLE: _lt("Format rules"),
        IS_RULE: _lt("Format cells if..."),
        FORMATTING_STYLE: _lt("Formatting style"),
        BOLD: _lt("Bold"),
        ITALIC: _lt("Italic"),
        STRIKETHROUGH: _lt("Strikethrough"),
        TEXTCOLOR: _lt("Text Color"),
        FILLCOLOR: _lt("Fill Color"),
        CANCEL: _lt("Cancel"),
        SAVE: _lt("Save"),
        PREVIEWTEXT: _lt("Preview text"),
        Errors: {
            [28 /* InvalidNumberOfArgs */]: _lt("Invalid number of arguments"),
            [29 /* MinNaN */]: _lt("The minpoint must be a number"),
            [30 /* MidNaN */]: _lt("The midpoint must be a number"),
            [31 /* MaxNaN */]: _lt("The maxpoint must be a number"),
            [25 /* MinBiggerThanMax */]: _lt("Minimum must be smaller then Maximum"),
            [27 /* MinBiggerThanMid */]: _lt("Minimum must be smaller then Midpoint"),
            [26 /* MidBiggerThanMax */]: _lt("Midpoint must be smaller then Maximum"),
            [35 /* MinInvalidFormula */]: _lt("Invalid Minpoint formula"),
            [37 /* MaxInvalidFormula */]: _lt("Invalid Maxpoint formula"),
            [36 /* MidInvalidFormula */]: _lt("Invalid Midpoint formula"),
            [32 /* MinAsyncFormulaNotSupported */]: _lt("Some formulas are not supported for the Minpoint"),
            [34 /* MaxAsyncFormulaNotSupported */]: _lt("Some formulas are not supported for the Maxpoint"),
            [33 /* MidAsyncFormulaNotSupported */]: _lt("Some formulas are not supported for the Midpoint"),
            unexpected: _lt("The rule is invalid for an unknown reason"),
        },
    };
    const colorScale = {
        CellValues: _lt("Cell values"),
        FixedNumber: _lt("Fixed number"),
        Percentage: _lt("Percentage"),
        Percentile: _lt("Percentile"),
        Formula: _lt("Formula"),
        FormatRules: _lt("Format rules"),
        None: _lt("None"),
        Preview: _lt("Preview"),
        Minpoint: _lt("Minpoint"),
        MaxPoint: _lt("MaxPoint"),
        MidPoint: _lt("MidPoint"),
    };
    const cellIsOperators = {
        BeginsWith: _lt("Begins with"),
        Between: _lt("Between"),
        ContainsText: _lt("Contains text"),
        EndsWith: _lt("Ends with"),
        Equal: _lt("Is equal to"),
        GreaterThan: _lt("Greater than"),
        GreaterThanOrEqual: _lt("Greater than or equal"),
        LessThan: _lt("Less than"),
        LessThanOrEqual: _lt("Less than or equal"),
        NotBetween: _lt("Not between"),
        NotContains: _lt("Not contains"),
        NotEqual: _lt("Not equal"),
    };
    const chartTerms = {
        ChartType: _lt("Chart type"),
        Line: _lt("Line"),
        Bar: _lt("Bar"),
        Pie: _lt("Pie"),
        Title: _lt("Title"),
        Series: _lt("Series"),
        DataSeries: _lt("Data Series"),
        MyDataHasTitle: _lt("My data has title"),
        DataCategories: _lt("Data categories (labels)"),
        UpdateChart: _lt("Update chart"),
        CreateChart: _lt("Create chart"),
        TitlePlaceholder: _lt("New Chart"),
        Errors: {
            [19 /* EmptyDataSet */]: _lt("Invalid or no Dataset given"),
            [20 /* EmptyLabelRange */]: _lt("No Labels given"),
            [21 /* InvalidDataSet */]: _lt("Invalid dataSet"),
            [22 /* InvalidLabelRange */]: _lt("Invalid Labels"),
            unexpected: _lt("The chartdefinition is invalid for an unknown reason"),
        },
    };
    const FindAndReplaceTerms = {
        Search: _lt("Search"),
        Replace: _lt("Replace"),
        Next: _lt("Next"),
        Previous: _lt("Previous"),
        MatchCase: _lt("Match case"),
        ExactMatch: _lt("Match entire cell content"),
        SearchFormulas: _lt("Search in formulas"),
        ReplaceAll: _lt("Replace all"),
        ReplaceFormulas: _lt("Also modify formulas"),
    };

    const { Component: Component$1, useState } = owl__namespace;
    const { xml: xml$1 } = owl.tags;
    const TEMPLATE$1 = xml$1 /* xml */ `
  <div class="o-chart">
    <div class="o-section">
      <div class="o-section-title"><t t-esc="env._t('${chartTerms.ChartType}')"/></div>
      <select t-model="state.type" class="o-input o-type-selector">
        <option value="bar" t-esc="env._t('${chartTerms.Bar}')"/>
        <option value="line" t-esc="env._t('${chartTerms.Line}')"/>
        <option value="pie" t-esc="env._t('${chartTerms.Pie}')"/>
      </select>
    </div>
    <div class="o-section o-chart-title">
      <div class="o-section-title" t-esc="env._t('${chartTerms.Title}')"/>
      <input type="text" t-model="state.title" class="o-input" t-att-placeholder="env._t('${chartTerms.TitlePlaceholder}')"/>
    </div>
    <div class="o-section o-data-series">
      <div class="o-section-title" t-esc="env._t('${chartTerms.DataSeries}')"/>
      <SelectionInput
        t-key="getKey('dataSets')"
        ranges="state.dataSets"
        t-on-selection-changed="onSeriesChanged"
      />
      <input type="checkbox" t-model="state.dataSetsHaveTitle"/><t t-esc="env._t('${chartTerms.MyDataHasTitle}')"/>
    </div>
    <div class="o-section o-data-labels">
        <div class="o-section-title" t-esc="env._t('${chartTerms.DataCategories}')"/>
        <SelectionInput
          t-key="getKey('label')"
          ranges="[state.labelRange]"
          t-on-selection-changed="onLabelRangeChanged"
          maximumRanges="1"
        />
    </div>
    <div class="o-sidePanelButtons">
      <button t-if="props.figure" t-on-click="updateChart(props.figure)" class="o-sidePanelButton" t-esc="env._t('${chartTerms.UpdateChart}')"/>
      <button t-else="" t-on-click="createChart" class="o-sidePanelButton" t-esc="env._t('${chartTerms.CreateChart}')"/>
    </div>
    <div class="o-section o-sidepanel-error" t-if="state.error">
        <t t-esc="state.error"/>
    </div>
  </div>
`;
    class ChartPanel extends Component$1 {
        constructor() {
            super(...arguments);
            this.getters = this.env.getters;
            this.state = useState(this.initialState(this.props.figure));
        }
        async willUpdateProps(nextProps) {
            var _a, _b;
            if (((_a = nextProps.figure) === null || _a === void 0 ? void 0 : _a.id) !== ((_b = this.props.figure) === null || _b === void 0 ? void 0 : _b.id)) {
                this.state = this.initialState(nextProps.figure);
            }
        }
        onSeriesChanged(ev) {
            this.state.dataSets = ev.detail.ranges;
        }
        onLabelRangeChanged(ev) {
            this.state.labelRange = ev.detail.ranges[0];
        }
        getKey(label) {
            return this.props.figure ? label + this.props.figure.id : label;
        }
        createChart() {
            const result = this.env.dispatch("CREATE_CHART", {
                sheetId: this.getters.getActiveSheetId(),
                id: uuidv4(),
                definition: this.getChartDefinition(),
            });
            if (result.status === "CANCELLED") {
                this.state.error = this.env._t(chartTerms.Errors[result.reason] || chartTerms.Errors.unexpected);
            }
            else {
                this.trigger("close-side-panel");
            }
        }
        updateChart(chart) {
            const result = this.env.dispatch("UPDATE_CHART", {
                sheetId: this.getters.getActiveSheetId(),
                id: chart.id,
                definition: this.getChartDefinition(),
            });
            if (result.status === "CANCELLED") {
                this.state.error = this.env._t(chartTerms.Errors[result.reason] || chartTerms.Errors.unexpected);
            }
            else {
                this.trigger("close-side-panel");
            }
        }
        getChartDefinition() {
            return {
                type: this.state.type,
                title: this.state.title,
                labelRange: this.state.labelRange ? this.state.labelRange.trim() : "",
                dataSets: this.state.dataSets.slice(),
                dataSetsHaveTitle: this.state.dataSetsHaveTitle,
            };
        }
        initialState(figure) {
            if (figure) {
                return this.env.getters.getChartDefinitionUI(this.env.getters.getActiveSheetId(), figure.id);
            }
            else {
                return {
                    title: "",
                    dataSets: [],
                    labelRange: "",
                    type: "bar",
                    dataSetsHaveTitle: false,
                };
            }
        }
    }
    ChartPanel.template = TEMPLATE$1;
    ChartPanel.components = { SelectionInput };

    const { Component: Component$2 } = owl__namespace;
    const { css: css$1, xml: xml$2 } = owl.tags;
    const COLORS = [
        [
            "#000000",
            "#434343",
            "#666666",
            "#999999",
            "#b7b7b7",
            "#cccccc",
            "#d9d9d9",
            "#efefef",
            "#f3f3f3",
            "#ffffff",
        ],
        [
            "#980000",
            "#ff0000",
            "#ff9900",
            "#ffff00",
            "#00ff00",
            "#00ffff",
            "#4a86e8",
            "#0000ff",
            "#9900ff",
            "#ff00ff",
        ],
        [
            "#e6b8af",
            "#f4cccc",
            "#fce5cd",
            "#fff2cc",
            "#d9ead3",
            "#d0e0e3",
            "#c9daf8",
            "#cfe2f3",
            "#d9d2e9",
            "#ead1dc",
        ],
        [
            "#dd7e6b",
            "#ea9999",
            "#f9cb9c",
            "#ffe599",
            "#b6d7a8",
            "#a2c4c9",
            "#a4c2f4",
            "#9fc5e8",
            "#b4a7d6",
            "#d5a6bd",
        ],
        [
            "#cc4125",
            "#e06666",
            "#f6b26b",
            "#ffd966",
            "#93c47d",
            "#76a5af",
            "#6d9eeb",
            "#6fa8dc",
            "#8e7cc3",
            "#c27ba0",
        ],
        [
            "#a61c00",
            "#cc0000",
            "#e69138",
            "#f1c232",
            "#6aa84f",
            "#45818e",
            "#3c78d8",
            "#3d85c6",
            "#674ea7",
            "#a64d79",
        ],
        [
            "#85200c",
            "#990000",
            "#b45f06",
            "#bf9000",
            "#38761d",
            "#134f5c",
            "#1155cc",
            "#0b5394",
            "#351c75",
            "#741b47",
        ],
        [
            "#5b0f00",
            "#660000",
            "#783f04",
            "#7f6000",
            "#274e13",
            "#0c343d",
            "#1c4587",
            "#073763",
            "#20124d",
            "#4c1130",
        ],
    ];
    class ColorPicker extends Component$2 {
        constructor() {
            super(...arguments);
            this.COLORS = COLORS;
        }
        onColorClick(ev) {
            const color = ev.target.dataset.color;
            if (color) {
                this.trigger("color-picked", { color });
            }
        }
    }
    ColorPicker.template = xml$2 /* xml */ `
  <div class="o-color-picker" t-on-click="onColorClick">
    <div class="o-color-picker-line" t-foreach="COLORS" t-as="colors" t-key="colors">
      <t t-foreach="colors" t-as="color" t-key="color">
        <div class="o-color-picker-line-item" t-att-data-color="color" t-attf-style="background-color:{{color}};"></div>
      </t>
    </div>
  </div>`;
    ColorPicker.style = css$1 /* scss */ `
    .o-color-picker {
      position: absolute;
      top: calc(100% + 5px);
      left: 0;
      z-index: 10;
      box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
      background-color: white;
      padding: 6px 0px;

      .o-color-picker-line {
        display: flex;
        padding: 3px 6px;
        .o-color-picker-line-item {
          width: 18px;
          height: 18px;
          margin: 0px 2px;
          border-radius: 50px;
          border: 1px solid #c0c0c0;
          &:hover {
            background-color: rgba(0, 0, 0, 0.08);
            outline: 1px solid gray;
          }
        }
      }
    }
  `;

    // -----------------------------------------------------------------------------
    // Icons
    // -----------------------------------------------------------------------------
    const UNDO_ICON = `<svg class="o-icon"><path fill="#000000" d="M11.5656391,4.43436088 L9,7 L16,7 L16,0 L13.0418424,2.95815758 C11.5936787,1.73635959 9.72260775,1 7.67955083,1 C4.22126258,1 1.25575599,3.10984908 0,6 L2,7 C2.93658775,4.60974406 5.12943697,3.08011229 7.67955083,3 C9.14881247,3.0528747 10.4994783,3.57862053 11.5656391,4.43436088 Z" transform="matrix(-1 0 0 1 17 5)"/></svg>`;
    const REDO_ICON = `<svg class="o-icon"><path fill="#000000" d="M11.5656391,4.43436088 L9,7 L16,7 L16,0 L13.0418424,2.95815758 C11.5936787,1.73635959 9.72260775,1 7.67955083,1 C4.22126258,1 1.25575599,3.10984908 0,6 L2,7 C2.93658775,4.60974406 5.12943697,3.08011229 7.67955083,3 C9.14881247,3.0528747 10.4994783,3.57862053 11.5656391,4.43436088 Z" transform="translate(1 5)"/></svg>`;
    const PAINT_FORMAT_ICON = `<svg class="o-icon"><path fill="#000000" d="M9,0 L1,0 C0.45,0 0,0.45 0,1 L0,4 C0,4.55 0.45,5 1,5 L9,5 C9.55,5 10,4.55 10,4 L10,3 L11,3 L11,6 L4,6 L4,14 L6,14 L6,8 L13,8 L13,2 L10,2 L10,1 C10,0.45 9.55,0 9,0 Z" transform="translate(3 2)"/></svg>`;
    const CLEAR_FORMAT_ICON = `<svg class="o-icon"><path fill="#000000" d="M0.27,1.55 L5.43,6.7 L3,12 L5.5,12 L7.14,8.42 L11.73,13 L13,11.73 L1.55,0.27 L0.27,1.55 L0.27,1.55 Z M3.82,0 L5.82,2 L7.58,2 L7.03,3.21 L8.74,4.92 L10.08,2 L14,2 L14,0 L3.82,0 L3.82,0 Z" transform="translate(2 3)"/></svg>`;
    const TRIANGLE_DOWN_ICON = `<svg class="o-icon"><polygon fill="#000000" points="0 0 4 4 8 0" transform="translate(5 7)"/></svg>`;
    const TRIANGLE_RIGHT_ICON = `<svg class="o-icon"><polygon fill="#000000" points="0 0 4 4 0 8" transform="translate(5 3)"/></svg>`;
    const BOLD_ICON = `<svg class="o-icon"><path fill="#000000" fill-rule="evenodd" d="M9,3.5 C9,1.57 7.43,0 5.5,0 L1.77635684e-15,0 L1.77635684e-15,12 L6.25,12 C8.04,12 9.5,10.54 9.5,8.75 C9.5,7.45 8.73,6.34 7.63,5.82 C8.46,5.24 9,4.38 9,3.5 Z M5,2 C5.82999992,2 6.5,2.67 6.5,3.5 C6.5,4.33 5.82999992,5 5,5 L3,5 L3,2 L5,2 Z M3,10 L3,7 L5.5,7 C6.32999992,7 7,7.67 7,8.5 C7,9.33 6.32999992,10 5.5,10 L3,10 Z" transform="translate(4 3)"/></svg>`;
    const ITALIC_ICON = `<svg class="o-icon"><polygon fill="#000000" fill-rule="evenodd" points="4 0 4 2 6.58 2 2.92 10 0 10 0 12 8 12 8 10 5.42 10 9.08 2 12 2 12 0" transform="translate(3 3)"/></svg>`;
    const STRIKE_ICON = `<svg class="o-icon"><path fill="#010101" fill-rule="evenodd" d="M2.8875,3.06 C2.8875,2.6025 2.985,2.18625 3.18375,1.8075 C3.3825,1.42875 3.66,1.10625 4.02,0.84 C4.38,0.57375 4.80375,0.3675 5.29875,0.22125 C5.79375,0.075 6.33375,0 6.92625,0 C7.53375,0 8.085,0.0825 8.58,0.25125 C9.075,0.42 9.49875,0.6525 9.85125,0.95625 C10.20375,1.25625 10.47375,1.6125 10.665,2.02875 C10.85625,2.44125 10.95,2.895 10.95,3.38625 L8.6925,3.38625 C8.6925,3.1575 8.655,2.94375 8.58375,2.74875 C8.5125,2.55 8.4,2.38125 8.25,2.2425 C8.1,2.10375 7.9125,1.99125 7.6875,1.91625 C7.4625,1.8375 7.19625,1.8 6.88875,1.8 C6.5925,1.8 6.3375,1.83375 6.11625,1.8975 C5.89875,1.96125 5.71875,2.05125 5.57625,2.1675 C5.43375,2.28375 5.325,2.41875 5.25375,2.5725 C5.1825,2.72625 5.145,2.895 5.145,3.0675 C5.145,3.4275 5.32875,3.73125 5.69625,3.975 C5.71780203,3.98908066 5.73942012,4.00311728 5.76118357,4.01733315 C6.02342923,4.18863185 6.5,4.5 7,5 L4,5 C4,5 3.21375,4.37625 3.17625,4.30875 C2.985,3.9525 2.8875,3.53625 2.8875,3.06 Z M14,6 L0,6 L0,8 L7.21875,8 C7.35375,8.0525 7.51875,8.105 7.63125,8.15375 C7.90875,8.2775 8.12625,8.40875 8.28375,8.53625 C8.44125,8.6675 8.54625,8.81 8.6025,8.96 C8.65875,9.11375 8.685,9.28625 8.685,9.47375 C8.685,9.65 8.65125,9.815 8.58375,9.965 C8.51625,10.11875 8.41125,10.25 8.2725,10.35875 C8.13375,10.4675 7.95375,10.55375 7.74,10.6175 C7.5225,10.68125 7.27125,10.71125 6.97875,10.71125 C6.6525,10.71125 6.35625,10.6775 6.09,10.61375 C5.82375,10.55 5.59875,10.445 5.41125,10.3025 C5.22375,10.16 5.0775,9.9725 4.9725,9.74375 C4.8675,9.515 4.78125,9.17 4.78125,9 L2.55,9 C2.55,9.2525 2.61,9.6875 2.72625,10.025 C2.8425,10.3625 3.0075,10.66625 3.21375,10.9325 C3.42,11.19875 3.6675,11.4275 3.94875,11.6225 C4.23,11.8175 4.53375,11.9825 4.86375,12.11 C5.19375,12.24125 5.535,12.33875 5.89875,12.39875 C6.25875,12.4625 6.6225,12.4925 6.9825,12.4925 C7.5825,12.4925 8.13,12.425 8.6175,12.28625 C9.105,12.1475 9.525,11.94875 9.87,11.69375 C10.215,11.435 10.48125,11.12 10.6725,10.74125 C10.86375,10.3625 10.95375,9.935 10.95375,9.455 C10.95375,9.005 10.875,8.6 10.72125,8.24375 C10.68375,8.1575 10.6425,8.075 10.59375,7.9925 L14,8 L14,6 Z" transform="translate(2 3)"/></svg>`;
    const TEXT_COLOR_ICON = `<svg class="o-icon"><path fill="#000000" d="M7,0 L5,0 L0.5,12 L2.5,12 L3.62,9 L8.37,9 L9.49,12 L11.49,12 L7,0 L7,0 Z M4.38,7 L6,2.67 L7.62,7 L4.38,7 L4.38,7 Z" transform="translate(3 1)"/></svg>`;
    const FILL_COLOR_ICON = `<svg class="o-icon"><path fill="#000000" d="M14.5,8.87 C14.5,8.87 13,10.49 13,11.49 C13,12.32 13.67,12.99 14.5,12.99 C15.33,12.99 16,12.32 16,11.49 C16,10.5 14.5,8.87 14.5,8.87 L14.5,8.87 Z M12.71,6.79 L5.91,0 L4.85,1.06 L6.44,2.65 L2.29,6.79 C1.9,7.18 1.9,7.81 2.29,8.2 L6.79,12.7 C6.99,12.9 7.24,13 7.5,13 C7.76,13 8.01,12.9 8.21,12.71 L12.71,8.21 C13.1,7.82 13.1,7.18 12.71,6.79 L12.71,6.79 Z M4.21,7 L7.5,3.71 L10.79,7 L4.21,7 L4.21,7 Z"/></svg>`;
    const MERGE_CELL_ICON = `<svg class="o-icon"><path fill="#000000" d="M3,6 L1,6 L1,2 L8,2 L8,4 L3,4 L3,6 Z M10,4 L10,2 L17,2 L17,6 L15,6 L15,4 L10,4 Z M10,14 L15,14 L15,12 L17,12 L17,16 L10,16 L10,14 Z M1,12 L3,12 L3,14 L8,14 L8,16 L1,16 L1,12 Z M1,8 L5,8 L5,6 L8,9 L5,12 L5,10 L1,10 L1,8 Z M10,9 L13,6 L13,8 L17,8 L17,10 L13,10 L13,12 L10,9 Z"/></svg>`;
    const ALIGN_LEFT_ICON = `<svg class="o-icon"><path fill="#000000" d="M0,14 L10,14 L10,12 L0,12 L0,14 Z M10,4 L0,4 L0,6 L10,6 L10,4 Z M0,0 L0,2 L14,2 L14,0 L0,0 Z M0,10 L14,10 L14,8 L0,8 L0,10 Z" transform="translate(2 2)"/></svg>`;
    const ALIGN_CENTER_ICON = `<svg class="o-icon"><path fill="#000000" d="M2,12 L2,14 L12,14 L12,12 L2,12 Z M2,4 L2,6 L12,6 L12,4 L2,4 Z M0,10 L14,10 L14,8 L0,8 L0,10 Z M0,0 L0,2 L14,2 L14,0 L0,0 Z" transform="translate(2 2)"/></svg>`;
    const ALIGN_RIGHT_ICON = `<svg class="o-icon"><path fill="#000000" d="M4,14 L14,14 L14,12 L4,12 L4,14 Z M0,10 L14,10 L14,8 L0,8 L0,10 Z M0,0 L0,2 L14,2 L14,0 L0,0 Z M4,6 L14,6 L14,4 L4,4 L4,6 Z" transform="translate(2 2)"/></svg>`;
    // export const ALIGN_TOP_ICON = `<svg class="o-icon"><path fill="#000000" d="M0,0 L0,2 L12,2 L12,0 L0,0 L0,0 Z M2.5,7 L5,7 L5,14 L7,14 L7,7 L9.5,7 L6,3.5 L2.5,7 L2.5,7 Z" transform="translate(3 2)"/></svg>`;
    const ALIGN_MIDDLE_ICON = `<svg class="o-icon"><path fill="#000000" d="M9.5,3 L7,3 L7,0 L5,0 L5,3 L2.5,3 L6,6.5 L9.5,3 L9.5,3 Z M0,8 L0,10 L12,10 L12,8 L0,8 L0,8 Z M2.5,15 L5,15 L5,18 L7,18 L7,15 L9.5,15 L6,11.5 L2.5,15 L2.5,15 Z" transform="translate(3)"/></svg>`;
    // export const ALIGN_BOTTOM_ICON = `<svg class="o-icon"><path fill="#000000" d="M9.5,7 L7,7 L7,0 L5,0 L5,7 L2.5,7 L6,10.5 L9.5,7 L9.5,7 Z M0,12 L0,14 L12,14 L12,12 L0,12 L0,12 Z" transform="translate(3 2)"/></svg>`;
    const TEXT_WRAPPING_ICON = `<svg class="o-icon"><path fill="#000000" d="M14,0 L0,0 L0,2 L14,2 L14,0 Z M0,12 L4,12 L4,10 L0,10 L0,12 Z M11.5,5 L0,5 L0,7 L11.75,7 C12.58,7 13.25,7.67 13.25,8.5 C13.25,9.33 12.58,10 11.75,10 L9,10 L9,8 L6,11 L9,14 L9,12 L11.5,12 C13.43,12 15,10.43 15,8.5 C15,6.57 13.43,5 11.5,5 Z" transform="translate(2 3)"/></svg>`;
    const BORDERS_ICON = `<svg class="o-icon"><path fill="#000000" d="M0,0 L0,14 L14,14 L14,0 L0,0 L0,0 Z M6,12 L2,12 L2,8 L6,8 L6,12 L6,12 Z M6,6 L2,6 L2,2 L6,2 L6,6 L6,6 Z M12,12 L8,12 L8,8 L12,8 L12,12 L12,12 Z M12,6 L8,6 L8,2 L12,2 L12,6 L12,6 Z" transform="translate(2 2)"/></svg>`;
    const BORDER_HV = `<svg class="o-icon"><g fill="#000000"><path d="M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M2,3 L0,3 L0,5 L2,5 L2,3 L2,3 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M11,0 L9,0 L9,2 L11,2 L11,0 L11,0 Z M2,0 L0,0 L0,2 L2,2 L2,0 L2,0 Z M5,0 L3,0 L3,2 L5,2 L5,0 L5,0 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z" opacity=".54"/><polygon points="8 0 6 0 6 6 0 6 0 8 6 8 6 14 8 14 8 8 14 8 14 6 8 6"/></g></svg>`;
    const BORDER_H = `<svg class="o-icon"><g fill="#000000"><path d="M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z" opacity=".54"/><polygon points="0 8 14 8 14 6 0 6"/></g></svg>`;
    const BORDER_V = `<svg class="o-icon"><g fill="#000000"><path d="M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z" opacity=".54"/><polygon points="6 14 8 14 8 0 6 0"/></g></svg>`;
    const BORDER_EXTERNAL = `<svg class="o-icon"><g fill="#000000"><path d="M8,3 L6,3 L6,5 L8,5 L8,3 L8,3 Z M11,6 L9,6 L9,8 L11,8 L11,6 L11,6 Z M8,6 L6,6 L6,8 L8,8 L8,6 L8,6 Z M8,9 L6,9 L6,11 L8,11 L8,9 L8,9 Z M5,6 L3,6 L3,8 L5,8 L5,6 L5,6 Z" opacity=".54"/><path d="M0,0 L14,0 L14,14 L0,14 L0,0 Z M12,12 L12,2 L2,2 L2,12 L12,12 Z"/></g></svg>`;
    const BORDER_LEFT = `<svg class="o-icon"><g fill="#000000"><path d="M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z" opacity=".54"/><polygon points="0 14 2 14 2 0 0 0"/></g></svg>`;
    const BORDER_TOP = `<svg class="o-icon"><g fill="#000000"><path d="M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z" opacity=".54"/><polygon points="0 0 0 2 14 2 14 0"/></g></svg>`;
    const BORDER_RIGHT = `<svg class="o-icon"><g fill="#000000"><path d="M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z" opacity=".54"/><polygon points="12 0 12 14 14 14 14 0"/></g></svg>`;
    const BORDER_BOTTOM = `<svg class="o-icon"><g fill="#000000"><path d="M5,0 L3,0 L3,2 L5,2 L5,0 L5,0 Z M8,6 L6,6 L6,8 L8,8 L8,6 L8,6 Z M8,9 L6,9 L6,11 L8,11 L8,9 L8,9 Z M11,6 L9,6 L9,8 L11,8 L11,6 L11,6 Z M5,6 L3,6 L3,8 L5,8 L5,6 L5,6 Z M11,0 L9,0 L9,2 L11,2 L11,0 L11,0 Z M8,3 L6,3 L6,5 L8,5 L8,3 L8,3 Z M8,0 L6,0 L6,2 L8,2 L8,0 L8,0 Z M2,9 L0,9 L0,11 L2,11 L2,9 L2,9 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M2,0 L0,0 L0,2 L2,2 L2,0 L2,0 Z M2,3 L0,3 L0,5 L2,5 L2,3 L2,3 Z M2,6 L0,6 L0,8 L2,8 L2,6 L2,6 Z" opacity=".54"/><polygon points="0 14 14 14 14 12 0 12"/></g></svg>`;
    const BORDER_CLEAR = `<svg class="o-icon"><path fill="#000000" fill-rule="evenodd" d="M6,14 L8,14 L8,12 L6,12 L6,14 L6,14 Z M3,8 L5,8 L5,6 L3,6 L3,8 L3,8 Z M3,2 L5,2 L5,0 L3,0 L3,2 L3,2 Z M6,11 L8,11 L8,9 L6,9 L6,11 L6,11 Z M3,14 L5,14 L5,12 L3,12 L3,14 L3,14 Z M0,5 L2,5 L2,3 L0,3 L0,5 L0,5 Z M0,14 L2,14 L2,12 L0,12 L0,14 L0,14 Z M0,2 L2,2 L2,0 L0,0 L0,2 L0,2 Z M0,8 L2,8 L2,6 L0,6 L0,8 L0,8 Z M6,8 L8,8 L8,6 L6,6 L6,8 L6,8 Z M0,11 L2,11 L2,9 L0,9 L0,11 L0,11 Z M12,11 L14,11 L14,9 L12,9 L12,11 L12,11 Z M12,14 L14,14 L14,12 L12,12 L12,14 L12,14 Z M12,8 L14,8 L14,6 L12,6 L12,8 L12,8 Z M12,5 L14,5 L14,3 L12,3 L12,5 L12,5 Z M12,0 L12,2 L14,2 L14,0 L12,0 L12,0 Z M6,2 L8,2 L8,0 L6,0 L6,2 L6,2 Z M9,2 L11,2 L11,0 L9,0 L9,2 L9,2 Z M6,5 L8,5 L8,3 L6,3 L6,5 L6,5 Z M9,14 L11,14 L11,12 L9,12 L9,14 L9,14 Z M9,8 L11,8 L11,6 L9,6 L9,8 L9,8 Z" transform="translate(2 2)" opacity=".54"/></svg>`;
    const PLUS = `<svg class="o-icon"><path fill="#000000" d="M8,0 L10,0 L10,8 L18,8 L18,10 L10,10 L10,18 L8,18 L8,10 L0,10 L0,8 L8,8"/></svg>`;
    const LIST = `<svg class="o-icon" viewBox="0 0 384 384"><rect x="0" y="277.333" width="384" height="42.667"/><rect x="0" y="170.667" width="384" height="42.667"/><rect x="0" y="64" width="384" height="42.667"/></svg>`;

    const { Component: Component$3, useState: useState$1, hooks } = owl__namespace;
    const { useExternalListener } = hooks;
    const { xml: xml$3, css: css$2 } = owl.tags;
    const PREVIEW_TEMPLATE = xml$3 /* xml */ `
    <div class="o-cf-preview-line"
         t-attf-style="font-weight:{{currentStyle.bold ?'bold':'normal'}};
                       text-decoration:{{currentStyle.strikethrough ? 'line-through':'none'}};
                       font-style:{{currentStyle.italic?'italic':'normal'}};
                       color:{{currentStyle.textColor}};
                       background-color:{{currentStyle.fillColor}};"
         t-esc="previewText || env._t('${conditionalFormatingTerms.PREVIEWTEXT}')" />
`;
    const TEMPLATE$2 = xml$3 /* xml */ `
<div>
    <div class="o-section-title" t-esc="env._t('${conditionalFormatingTerms.CF_TITLE}')"></div>
    <div class="o-cf-title-text" t-esc="env._t('${conditionalFormatingTerms.IS_RULE}')"></div>
    <select t-model="state.condition.operator" class="o-input o-cell-is-operator">
        <t t-foreach="Object.keys(cellIsOperators)" t-as="op" t-key="op_index">
            <option t-att-value="op" t-esc="cellIsOperators[op]"/>
        </t>
    </select>
    <input type="text" placeholder="Value" t-model="state.condition.value1" class="o-input o-cell-is-value"/>
    <t t-if="state.condition.operator === 'Between' || state.condition.operator === 'NotBetween'">
        <input type="text" placeholder="and value" t-model="state.condition.value2" class="o-input"/>
    </t>
    <div class="o-cf-title-text" t-esc="env._t('${conditionalFormatingTerms.FORMATTING_STYLE}')"></div>

    <t t-call="${PREVIEW_TEMPLATE}">
        <t t-set="currentStyle" t-value="state.style"/>
    </t>
    <div class="o-tools">
        <div class="o-tool" t-att-title="env._t('${conditionalFormatingTerms.BOLD}')" t-att-class="{active:state.style.bold}" t-on-click="toggleTool('bold')">
            ${BOLD_ICON}
        </div>
        <div class="o-tool" t-att-title="env._t('${conditionalFormatingTerms.ITALIC}')" t-att-class="{active:state.style.italic}" t-on-click="toggleTool('italic')">
            ${ITALIC_ICON}
        </div>
        <div class="o-tool" t-att-title="env._t('${conditionalFormatingTerms.STRIKETHROUGH}')" t-att-class="{active:state.style.strikethrough}"
             t-on-click="toggleTool('strikethrough')">${STRIKE_ICON}
        </div>
        <div class="o-tool o-dropdown o-with-color">
              <span t-att-title="env._t('${conditionalFormatingTerms.TEXTCOLOR}')" t-attf-style="border-color:{{state.style.textColor}}"
                    t-on-click.stop="toggleMenu('textColorTool')">${TEXT_COLOR_ICON}</span>
                    <ColorPicker t-if="state.textColorTool" t-on-color-picked="setColor('textColor')" t-key="textColor"/>
        </div>
        <div class="o-divider"/>
        <div class="o-tool  o-dropdown o-with-color">
              <span t-att-title="env._t('${conditionalFormatingTerms.FILLCOLOR}')" t-attf-style="border-color:{{state.style.fillColor}}"
                    t-on-click.stop="toggleMenu('fillColorTool')">${FILL_COLOR_ICON}</span>
                    <ColorPicker t-if="state.fillColorTool" t-on-color-picked="setColor('fillColor')" t-key="fillColor"/>
        </div>
    </div>
    <div class="o-sidePanelButtons">
      <button t-on-click="onCancel" class="o-sidePanelButton o-cf-cancel" t-esc="env._t('${conditionalFormatingTerms.CANCEL}')"></button>
      <button t-on-click="onSave" class="o-sidePanelButton o-cf-save" t-esc="env._t('${conditionalFormatingTerms.SAVE}')"></button>
    </div>
</div>
`;
    const CSS$1 = css$2 /* scss */ `
  .o-cf-title-text {
    font-size: 12px;
    line-height: 14px;
    margin-bottom: 6px;
    margin-top: 18px;
  }
  .o-cf-preview-line {
    border: 1px solid darkgrey;
    padding: 10px;
  }
`;
    class CellIsRuleEditor extends Component$3 {
        constructor() {
            super(...arguments);
            // @ts-ignore   used in XML template
            this.cellIsOperators = cellIsOperators;
            this.cf = this.props.conditionalFormat;
            this.rule = this.cf.rule;
            this.state = useState$1({
                condition: {
                    operator: this.rule && this.rule.operator ? this.rule.operator : "Equal",
                    value1: this.rule && this.rule.values.length > 0 ? this.rule.values[0] : "",
                    value2: this.cf && this.rule.values.length > 1 ? this.rule.values[1] : "",
                },
                textColorTool: false,
                fillColorTool: false,
                style: {
                    fillColor: this.cf && this.rule.style.fillColor,
                    textColor: this.cf && this.rule.style.textColor,
                    bold: this.cf && this.rule.style.bold,
                    italic: this.cf && this.rule.style.italic,
                    strikethrough: this.cf && this.rule.style.strikethrough,
                },
            });
            useExternalListener(window, "click", this.closeMenus);
        }
        toggleMenu(tool) {
            const current = this.state[tool];
            this.closeMenus();
            this.state[tool] = !current;
        }
        toggleTool(tool) {
            this.state.style[tool] = !this.state.style[tool];
            this.closeMenus();
        }
        setColor(target, ev) {
            const color = ev.detail.color;
            this.state.style[target] = color;
            this.closeMenus();
        }
        closeMenus() {
            this.state.textColorTool = false;
            this.state.fillColorTool = false;
        }
        onSave() {
            const newStyle = {};
            const style = this.state.style;
            if (style.bold !== undefined) {
                newStyle.bold = style.bold;
            }
            if (style.italic !== undefined) {
                newStyle.italic = style.italic;
            }
            if (style.strikethrough !== undefined) {
                newStyle.strikethrough = style.strikethrough;
            }
            if (style.fillColor) {
                newStyle.fillColor = style.fillColor;
            }
            if (style.textColor) {
                newStyle.textColor = style.textColor;
            }
            this.trigger("modify-rule", {
                rule: {
                    type: "CellIsRule",
                    operator: this.state.condition.operator,
                    values: [this.state.condition.value1, this.state.condition.value2],
                    stopIfTrue: false,
                    style: newStyle,
                },
            });
        }
        onCancel() {
            this.trigger("cancel-edit");
        }
    }
    CellIsRuleEditor.template = TEMPLATE$2;
    CellIsRuleEditor.style = CSS$1;
    CellIsRuleEditor.components = { ColorPicker };

    const { Component: Component$4, useState: useState$2, hooks: hooks$1 } = owl__namespace;
    const { useExternalListener: useExternalListener$1 } = hooks$1;
    const { xml: xml$4, css: css$3 } = owl.tags;
    const PREVIEW_TEMPLATE$1 = xml$4 /* xml */ `
  <div class="o-cf-preview-gradient" t-attf-style="{{getPreviewGradient()}}">
    <t t-esc="env._t('${conditionalFormatingTerms.PREVIEWTEXT}')"/>
  </div>
`;
    const THRESHOLD_TEMPLATE = xml$4 /* xml */ `
  <div t-attf-class="o-threshold o-threshold-{{thresholdType}}">
      <div class="o-tools">
        <div class="o-tool  o-dropdown o-with-color">
          <span title="Fill Color"  t-attf-style="border-color:#{{colorNumberString(threshold.color)}}"
                t-on-click.stop="toggleMenu(thresholdType+'ColorTool')">${FILL_COLOR_ICON}</span>
          <ColorPicker t-if="stateColorScale[thresholdType+'ColorTool']" t-on-color-picked="setColor(thresholdType)"/>
        </div>
      </div>
      <select name="valueType" t-model="threshold.type" t-on-click="closeMenus">
        <option value="value" t-if="thresholdType!=='midpoint'">
          <t t-esc="env._t('${colorScale.CellValues}')"/>
        </option>
        <option value="none" t-if="thresholdType==='midpoint'">
          <t t-esc="env._t('${colorScale.None}')"/>
        </option>
        <option value="number">
          <t t-esc="env._t('${colorScale.FixedNumber}')"/>
        </option>
        <option value="percentage">
          <t t-esc="env._t('${colorScale.Percentage}')"/>
        </option>
        <option value="percentile">
          <t t-esc="env._t('${colorScale.Percentile}')"/>
        </option>
        <option value="formula">
          <t t-esc="env._t('${colorScale.Formula}')"/>
        </option>
      </select>
      <input type="text" class="o-threshold-value"
        t-model="stateColorScale[thresholdType].value"
        t-if="['number', 'percentage', 'percentile', 'formula'].includes(threshold.type)"
      />
      <input type="text" class="o-threshold-value"
        t-else="" disabled="1"
      />
  </div>`;
    const TEMPLATE$3 = xml$4 /* xml */ `
  <div>
      <div class="o-section-title">
        <t t-esc="env._t('${colorScale.FormatRules}')"/>
      </div>
      <div class="o-cf-title-text">
        <t t-esc="env._t('${colorScale.Preview}')"/>
      </div>
      <t t-call="${PREVIEW_TEMPLATE$1}"/>
      <div class="o-cf-title-text">
        <t t-esc="env._t('${colorScale.Minpoint}')"/>
      </div>
      <t t-call="${THRESHOLD_TEMPLATE}">
          <t t-set="threshold" t-value="stateColorScale.minimum" ></t>
          <t t-set="thresholdType" t-value="'minimum'" ></t>
      </t>
      <div class="o-cf-title-text">
        <t t-esc="env._t('${colorScale.MidPoint}')"/>
      </div>
      <t t-call="${THRESHOLD_TEMPLATE}">
          <t t-set="threshold" t-value="stateColorScale.midpoint" ></t>
          <t t-set="thresholdType" t-value="'midpoint'" ></t>
      </t>
      <div class="o-cf-title-text">
        <t t-esc="env._t('${colorScale.MaxPoint}')"/>
      </div>
      <t t-call="${THRESHOLD_TEMPLATE}">
          <t t-set="threshold" t-value="stateColorScale.maximum" ></t>
          <t t-set="thresholdType" t-value="'maximum'" ></t>
      </t>
      <div class="o-cf-error" t-if="props.error">
        <t t-esc="props.error"/>
      </div>
      <div class="o-sidePanelButtons">
        <button t-on-click="onCancel" class="o-sidePanelButton o-cf-cancel">
          <t t-esc="env._t('${conditionalFormatingTerms.CANCEL}')"/>
        </button>
        <button class="o-sidePanelButton o-cf-save"
          t-on-click="onSave"
        >
          <t t-esc="env._t('${conditionalFormatingTerms.SAVE}')"/>
        </button>
      </div>
  </div>`;
    const CSS$2 = css$3 /* scss */ `
  .o-cf-title-text {
    font-size: 12px;
    line-height: 14px;
    margin-bottom: 6px;
    margin-top: 18px;
  }
  .o-threshold {
    display: flex;
    flex-direction: horizontal;

    .o-threshold-value {
      margin-left: 15px;
      width: 100%;
      min-width: 0px; // input overflows in Firefox otherwise
    }
  }
  .o-cf-preview-gradient {
    border: 1px solid darkgrey;
    padding: 10px;
  }
  .o-cf-error {
    color: red;
    margin-top: 10px;
  }
`;
    class ColorScaleRuleEditor extends Component$4 {
        constructor() {
            super(...arguments);
            this.cf = this.props.conditionalFormat;
            this.colorNumberString = colorNumberString;
            this.rule = this.cf.rule;
            this.stateColorScale = useState$2({
                minimum: this.rule.minimum,
                maximum: this.rule.maximum,
                midpoint: this.rule.midpoint ? this.rule.midpoint : { color: 0x444, type: "none" },
                maximumColorTool: false,
                minimumColorTool: false,
                midpointColorTool: false,
            });
            useExternalListener$1(window, "click", this.closeMenus);
        }
        toggleMenu(tool) {
            const current = this.stateColorScale[tool];
            this.closeMenus();
            this.stateColorScale[tool] = !current;
        }
        toggleTool(tool) {
            this.closeMenus();
        }
        setColor(target, ev) {
            const color = ev.detail.color;
            this.stateColorScale[target].color = Number.parseInt(color.substr(1), 16);
            this.closeMenus();
        }
        getPreviewGradient() {
            const minColor = colorNumberString(this.stateColorScale.minimum.color);
            const midColor = colorNumberString(this.stateColorScale.midpoint.color);
            const maxColor = colorNumberString(this.stateColorScale.maximum.color);
            const baseString = "background-image: linear-gradient(to right, #";
            return this.stateColorScale.midpoint.type === "none"
                ? baseString + minColor + ", #" + maxColor + ")"
                : baseString + minColor + ", #" + midColor + ", #" + maxColor + ")";
        }
        closeMenus() {
            this.stateColorScale.minimumColorTool = false;
            this.stateColorScale.midpointColorTool = false;
            this.stateColorScale.maximumColorTool = false;
        }
        cleanRule(rule) {
            if (rule.midpoint.type === "none") {
                return {
                    ...rule,
                    midpoint: undefined,
                };
            }
            return rule;
        }
        onSave() {
            const minimum = { ...this.stateColorScale.minimum };
            const midpoint = { ...this.stateColorScale.midpoint };
            const maximum = { ...this.stateColorScale.maximum };
            const rule = {
                type: "ColorScaleRule",
                minimum,
                maximum,
                midpoint,
            };
            this.trigger("modify-rule", { rule: this.cleanRule(rule) });
        }
        onCancel() {
            this.trigger("cancel-edit");
        }
    }
    ColorScaleRuleEditor.template = TEMPLATE$3;
    ColorScaleRuleEditor.style = CSS$2;
    ColorScaleRuleEditor.components = { ColorPicker };

    const { Component: Component$5, useState: useState$3 } = owl__namespace;
    const { xml: xml$5, css: css$4 } = owl.tags;
    // TODO vsc: add ordering of rules
    const PREVIEW_TEMPLATE$2 = xml$5 /* xml */ `
<div class="o-cf-preview">
  <div t-att-style="getStyle(cf.rule)" class="o-cf-preview-image">
    123
  </div>
  <div class="o-cf-preview-description">
    <div class="o-cf-preview-ruletype">
      <div class="o-cf-preview-description-rule">
        <t t-esc="getDescription(cf)" />
      </div>
      <div class="o-cf-preview-description-values">
      <t t-if="cf.rule.values">
        <t t-esc="cf.rule.values[0]" />
        <t t-if="cf.rule.values[1]">
          and <t t-esc="cf.rule.values[1]"/>
        </t>
      </t>
      </div>
    </div>
    <div class="o-cf-preview-range" t-esc="cf.ranges"/>
  </div>
  <div class="o-cf-delete">
    <div class="o-cf-delete-button" t-on-click.stop="onDeleteClick(cf)" aria-label="Remove rule">
      x
    </div>
  </div>
</div>`;
    const TEMPLATE$4 = xml$5 /* xml */ `
  <div class="o-cf">
    <t t-if="state.mode === 'list'">
      <div class="o-cf-preview-list" >
          <div t-on-click="onRuleClick(cf)" t-foreach="conditionalFormats" t-as="cf" t-key="cf.id">
              <t t-call="${PREVIEW_TEMPLATE$2}"/>
          </div>
      </div>
    </t>
    <t t-if="state.mode === 'edit' || state.mode === 'add'" t-key="state.currentCF.id">
        <div class="o-cf-type-selector">
          <div class="o-cf-type-tab" t-att-class="{'o-cf-tab-selected': state.toRuleType === 'CellIsRule'}" t-on-click="setRuleType('CellIsRule')">Single Color</div>
          <div class="o-cf-type-tab" t-att-class="{'o-cf-tab-selected': state.toRuleType === 'ColorScaleRule'}" t-on-click="setRuleType('ColorScaleRule')">Color Scale</div>
        </div>
        <div class="o-cf-ruleEditor">
            <div class="o-section o-cf-range">
              <div class="o-section-title">Apply to range</div>
              <SelectionInput ranges="state.currentRanges" class="o-range" t-on-selection-changed="onRangesChanged"/>
            </div>
            <div class="o-cf-editor o-section">
              <t t-component="editors[state.currentCF.rule.type]"
                  t-key="state.currentCF.id"
                  conditionalFormat="state.currentCF"
                  error="state.error"
                  t-on-cancel-edit="onCancel"
                  t-on-modify-rule="onSave" />
            </div>
        </div>
    </t>
    <div class="o-cf-add" t-if="state.mode === 'list'" t-on-click.prevent.stop="onAdd">
    + Add another rule
    </div>
  </div>`;
    const CSS$3 = css$4 /* scss */ `
  .o-cf {
    min-width: 350px;
    .o-cf-type-selector{
      margin-top: 20px;
      display: flex;
      .o-cf-type-tab{
        cursor:pointer;
        flex-grow: 1;
        text-align: center;
      }
      .o-cf-tab-selected{
        text-decoration: underline;
      }
    }
    .o-cf-preview {
      background-color: #fff;
      border-bottom: 1px solid #ccc;
      cursor: pointer;
      display: flex;
      height: 60px;
      padding: 10px;
      position: relative;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
      &:not(:hover) .o-cf-delete-button {
        display: none;
      }
      .o-cf-preview-image {
        border: 1px solid lightgrey;
        height: 50px;
        line-height: 50px;
        margin-right: 15px;
        position: absolute;
        text-align: center;
        width: 50px;
      }
      .o-cf-preview-description {
        left: 65px;
        margin-bottom: auto;
        margin-right: 8px;
        margin-top: auto;
        position: relative;
        width: 142px;
        .o-cf-preview-description-rule {
          margin-bottom: 4px;
          overflow: hidden;
        }
        .o-cf-preview-description-values{
          overflow: hidden;
        }
        .o-cf-preview-range{
          text-overflow: ellipsis;
          font-size: 12px;
          overflow: hidden;
        }
      }
      .o-cf-delete{
        height: 56px;
        left: 90%;
        line-height: 56px;
        position: absolute;
      }
    }
    .o-cf-ruleEditor {
      .o-dropdown {
        position: relative;
        .o-dropdown-content {
          position: absolute;
          top: calc(100% + 5px);
          left: 0;
          z-index: 10;
          box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
          background-color: #f6f6f6;

          .o-dropdown-item {
            padding: 7px 10px;
          }
          .o-dropdown-item:hover {
            background-color: rgba(0, 0, 0, 0.08);
          }
          .o-dropdown-line {
            display: flex;
            padding: 3px 6px;
            .o-line-item {
              width: 16px;
              height: 16px;
              margin: 1px 3px;
              &:hover {
                background-color: rgba(0, 0, 0, 0.08);
              }
            }
          }
        }
      }

      .o-tools {
        color: #333;
        font-size: 13px;
        cursor: default;
        display: flex;

        .o-tool {
          display: flex;
          align-items: center;
          margin: 2px;
          padding: 0 3px;
          border-radius: 2px;
        }

        .o-tool.active,
        .o-tool:not(.o-disabled):hover {
          background-color: rgba(0, 0, 0, 0.08);
        }

        .o-with-color > span {
          border-bottom: 4px solid;
          height: 16px;
          margin-top: 2px;
        }
        .o-with-color {
          .o-line-item:hover {
            outline: 1px solid gray;
          }
        }
        .o-border {
          .o-line-item {
            padding: 4px;
            margin: 1px;
          }
        }
      }
      .o-cell-content {
        font-size: 12px;
        font-weight: 500;
        padding: 0 12px;
        margin: 0;
        line-height: 35px;
      }
    }
    .o-cf-add {
      font-size: 14px;
      height: 36px;
      padding: 20px 24px 11px 24px;
      height: 44px;
      cursor: pointer;
    }
  }
  }`;
    class ConditionalFormattingPanel extends Component$5 {
        constructor(parent, props) {
            super(parent, props);
            this.colorNumberString = colorNumberString;
            this.getters = this.env.getters;
            //@ts-ignore --> used in XML template
            this.cellIsOperators = cellIsOperators;
            this.state = useState$3({
                currentCF: undefined,
                currentRanges: [],
                mode: "list",
                toRuleType: "CellIsRule",
                error: undefined,
            });
            this.editors = {
                CellIsRule: CellIsRuleEditor,
                ColorScaleRule: ColorScaleRuleEditor,
            };
            const sheetId = this.getters.getActiveSheetId();
            if (props.selection && this.getters.getRulesSelection(sheetId, props.selection).length === 1) {
                this.openCf(this.getters.getRulesSelection(sheetId, props.selection)[0]);
            }
        }
        get conditionalFormats() {
            return this.getters.getConditionalFormats(this.getters.getActiveSheetId());
        }
        async willUpdateProps(nextProps) {
            if (nextProps.selection && nextProps.selection !== this.props.selection) {
                const sheetId = this.getters.getActiveSheetId();
                if (nextProps.selection &&
                    this.getters.getRulesSelection(sheetId, nextProps.selection).length === 1) {
                    this.openCf(this.getters.getRulesSelection(sheetId, nextProps.selection)[0]);
                }
                else {
                    this.resetState();
                }
            }
        }
        resetState() {
            this.state.currentCF = undefined;
            this.state.currentRanges = [];
            this.state.mode = "list";
            this.state.toRuleType = "CellIsRule";
        }
        getStyle(rule) {
            if (rule.type === "CellIsRule") {
                const cellRule = rule;
                const fontWeight = cellRule.style.bold ? "bold" : "normal";
                const fontDecoration = cellRule.style.strikethrough ? "line-through" : "none";
                const fontStyle = cellRule.style.italic ? "italic" : "normal";
                const color = cellRule.style.textColor || "none";
                const backgroundColor = cellRule.style.fillColor || "none";
                return `font-weight:${fontWeight};
               text-decoration:${fontDecoration};
               font-style:${fontStyle};
               color:${color};
               background-color:${backgroundColor};`;
            }
            else {
                const colorScale = rule;
                const minColor = colorNumberString(colorScale.minimum.color);
                const midColor = colorScale.midpoint ? colorNumberString(colorScale.midpoint.color) : null;
                const maxColor = colorNumberString(colorScale.maximum.color);
                const baseString = "background-image: linear-gradient(to right, #";
                return midColor
                    ? baseString + minColor + ", #" + midColor + ", #" + maxColor + ")"
                    : baseString + minColor + ", #" + maxColor + ")";
            }
        }
        getDescription(cf) {
            return cf.rule.type === "CellIsRule" ? cellIsOperators[cf.rule.operator] : "Color scale";
        }
        onSave(ev) {
            if (this.state.currentCF) {
                const result = this.env.dispatch("ADD_CONDITIONAL_FORMAT", {
                    cf: {
                        rule: ev.detail.rule,
                        ranges: this.state.currentRanges,
                        id: this.state.mode === "edit" ? this.state.currentCF.id : uuidv4(),
                    },
                    sheetId: this.getters.getActiveSheetId(),
                });
                if (result.status === "CANCELLED") {
                    this.state.error = this.env._t(conditionalFormatingTerms.Errors[result.reason] ||
                        conditionalFormatingTerms.Errors.unexpected);
                }
                else {
                    this.state.error = undefined;
                    this.state.mode = "list";
                }
            }
        }
        onCancel() {
            this.state.mode = "list";
            this.state.currentCF = undefined;
        }
        onDeleteClick(cf) {
            this.env.dispatch("REMOVE_CONDITIONAL_FORMAT", {
                id: cf.id,
                sheetId: this.getters.getActiveSheetId(),
            });
        }
        onRuleClick(cf) {
            this.state.mode = "edit";
            this.state.currentCF = cf;
            this.state.toRuleType = cf.rule.type === "CellIsRule" ? "CellIsRule" : "ColorScaleRule";
            this.state.currentRanges = this.state.currentCF.ranges;
        }
        openCf(cfId) {
            const cfIndex = this.conditionalFormats.findIndex((c) => c.id === cfId);
            const cf = this.conditionalFormats[cfIndex];
            if (cf) {
                this.state.mode = "edit";
                this.state.currentCF = cf;
                this.state.toRuleType = cf.rule.type === "CellIsRule" ? "CellIsRule" : "ColorScaleRule";
                this.state.currentRanges = this.state.currentCF.ranges;
            }
        }
        defaultCellIsRule() {
            return {
                rule: {
                    type: "CellIsRule",
                    operator: "Equal",
                    values: [],
                    style: { fillColor: "#FF0000" },
                },
                ranges: this.getters
                    .getSelectedZones()
                    .map((zone) => this.getters.zoneToXC(this.getters.getActiveSheetId(), zone)),
                id: uuidv4(),
            };
        }
        defaultColorScaleRule() {
            return {
                rule: {
                    minimum: { type: "value", color: 0 },
                    midpoint: undefined,
                    maximum: { type: "value", color: 0xeeffee },
                    type: "ColorScaleRule",
                },
                ranges: this.getters
                    .getSelectedZones()
                    .map((zone) => this.getters.zoneToXC(this.getters.getActiveSheetId(), zone)),
                id: uuidv4(),
            };
        }
        onAdd() {
            this.state.mode = "add";
            this.state.currentCF = this.defaultCellIsRule();
            this.state.currentRanges = this.state.currentCF.ranges;
        }
        setRuleType(ruleType) {
            if (ruleType === "ColorScaleRule") {
                this.state.currentCF = this.defaultColorScaleRule();
            }
            if (ruleType === "CellIsRule") {
                this.state.currentCF = this.defaultCellIsRule();
            }
            this.state.toRuleType = ruleType;
        }
        onRangesChanged({ detail }) {
            this.state.currentRanges = detail.ranges;
        }
    }
    ConditionalFormattingPanel.template = TEMPLATE$4;
    ConditionalFormattingPanel.style = CSS$3;
    ConditionalFormattingPanel.components = { CellIsRuleEditor, ColorScaleRuleEditor, SelectionInput };

    const { Component: Component$6, useState: useState$4 } = owl__namespace;
    const { xml: xml$6, css: css$5 } = owl.tags;
    const TEMPLATE$5 = xml$6 /* xml */ `
<div class="o-find-and-replace" tabindex="0" t-on-focusin="onFocusSidePanel">
  <div class="o-section">
    <div t-esc="env._t('${FindAndReplaceTerms.Search}')" class="o-section-title"/>
    <div class="o-input-search-container">
      <input type="text" class="o-input o-input-with-count" t-on-input="onInput" t-on-keydown="onKeydownSearch">
      </input>
      <div class="o-input-count" t-if="hasSearchResult">
        <t t-esc="env.getters.getCurrentSelectedMatchIndex()+1"/>
        /
        <t t-esc="env.getters.getSearchMatches().length"/>
      </div>
    </div>
    <label class="o-far-checkbox">
      <input type="checkbox" t-model="state.searchOptions.matchCase" t-on-change="updateSearch()"/>
      <t t-esc="env._t('${FindAndReplaceTerms.MatchCase}')"/>
    </label>

    <label class="o-far-checkbox">
      <input type="checkbox" t-model="state.searchOptions.exactMatch" t-on-change="updateSearch()"/>
      <t t-esc="env._t('${FindAndReplaceTerms.ExactMatch}')"/>
    </label>inputSearch

    <label class="o-far-checkbox">
      <input type="checkbox" t-model="state.searchOptions.searchFormulas" t-on-change="searchFormulas"/>
      <t t-esc="env._t('${FindAndReplaceTerms.SearchFormulas}')"/>
    </label>
  </div>
  <div class="o-sidePanelButtons">
    <button t-att-disabled="!hasSearchResult" t-on-click="onSelectPreviousCell" class="o-sidePanelButton"
            t-esc="env._t('${FindAndReplaceTerms.Previous}')"/>
    <button t-att-disabled="!hasSearchResult" t-on-click="onSelectNextCell" class="o-sidePanelButton"
            t-esc="env._t('${FindAndReplaceTerms.Next}')"/>
  </div>

  <div class="o-section">
    <div t-esc="env._t('${FindAndReplaceTerms.Replace}')" class="o-section-title"/>
    <input type="text" class="o-input" t-model="state.replaceWith" t-on-keydown="onKeydownReplace"/>
    <label class="o-far-checkbox">
      <input t-att-disabled="state.searchOptions.searchFormulas" type="checkbox"
             t-model="state.replaceOptions.modifyFormulas"/>
      <t t-esc="env._t('${FindAndReplaceTerms.ReplaceFormulas}')"/>
    </label>
  </div>

  <div class="o-sidePanelButtons">
    <button t-att-disabled="env.getters.getCurrentSelectedMatchIndex() === null" t-on-click="replace"
            class="o-sidePanelButton" t-esc="env._t('${FindAndReplaceTerms.Replace}')"/>
    <button t-att-disabled="env.getters.getCurrentSelectedMatchIndex() === null" t-on-click="replaceAll"
            class="o-sidePanelButton" t-esc="env._t('${FindAndReplaceTerms.ReplaceAll}')"/>
  </div>

</div>
`;
    const CSS$4 = css$5 /* scss */ `
  .o-find-and-replace {
    outline: none;
    height: 100%;
    .o-input-search-container {
      display: flex;
      .o-input-with-count {
        flex-grow: 1;
        width: auto;
      }
      .o-input-count {
        width: fit-content;
        padding: 4 0 4 4;
      }
    }
  }
`;
    class FindAndReplacePanel extends Component$6 {
        constructor() {
            super(...arguments);
            this.getters = this.env.getters;
            this.state = useState$4(this.initialState());
        }
        get hasSearchResult() {
            return this.env.getters.getCurrentSelectedMatchIndex() !== null;
        }
        mounted() {
            this.focusInput();
        }
        async willUnmount() {
            this.env.dispatch("CLEAR_SEARCH");
        }
        onInput(ev) {
            this.state.toSearch = ev.target.value;
            this.debouncedUpdateSearch();
        }
        onKeydownSearch(ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                this.onSelectNextCell();
            }
        }
        onKeydownReplace(ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                this.replace();
            }
        }
        onFocusSidePanel() {
            this.state.searchOptions.searchFormulas = this.getters.shouldShowFormulas();
            this.state.replaceOptions.modifyFormulas = this.state.searchOptions.searchFormulas
                ? this.state.searchOptions.searchFormulas
                : this.state.replaceOptions.modifyFormulas;
            this.env.dispatch("REFRESH_SEARCH");
        }
        searchFormulas() {
            this.env.dispatch("SET_FORMULA_VISIBILITY", { show: this.state.searchOptions.searchFormulas });
            this.state.replaceOptions.modifyFormulas = this.state.searchOptions.searchFormulas;
            this.updateSearch();
        }
        onSelectPreviousCell() {
            this.env.dispatch("SELECT_SEARCH_PREVIOUS_MATCH");
        }
        onSelectNextCell() {
            this.env.dispatch("SELECT_SEARCH_NEXT_MATCH");
        }
        updateSearch() {
            if (this.state.toSearch) {
                this.env.dispatch("UPDATE_SEARCH", {
                    toSearch: this.state.toSearch,
                    searchOptions: this.state.searchOptions,
                });
            }
        }
        debouncedUpdateSearch() {
            clearTimeout(this.inDebounce);
            this.inDebounce = setTimeout(() => this.updateSearch.call(this), 400);
        }
        replace() {
            this.env.dispatch("REPLACE_SEARCH", {
                replaceWith: this.state.replaceWith,
                replaceOptions: this.state.replaceOptions,
            });
        }
        replaceAll() {
            this.env.dispatch("REPLACE_ALL_SEARCH", {
                replaceWith: this.state.replaceWith,
                replaceOptions: this.state.replaceOptions,
            });
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        focusInput() {
            const input = this.el.querySelector(`input`);
            if (input) {
                input.focus();
            }
        }
        initialState() {
            return {
                toSearch: "",
                replaceWith: "",
                searchOptions: {
                    matchCase: false,
                    exactMatch: false,
                    searchFormulas: false,
                },
                replaceOptions: {
                    modifyFormulas: false,
                },
            };
        }
    }
    FindAndReplacePanel.template = TEMPLATE$5;
    FindAndReplacePanel.style = CSS$4;

    const sidePanelRegistry = new Registry();
    sidePanelRegistry.add("ConditionalFormatting", {
        title: _lt("Conditional formatting"),
        Body: ConditionalFormattingPanel,
    });
    sidePanelRegistry.add("ChartPanel", {
        title: _lt("Chart"),
        Body: ChartPanel,
    });
    sidePanelRegistry.add("FindAndReplace", {
        title: _lt("Find and Replace"),
        Body: FindAndReplacePanel,
    });

    const topbarComponentRegistry = new Registry();

    /**
     * UI plugins handle any transient data required to display a spreadsheet.
     * They can draw on the grid canvas.
     */
    class UIPlugin extends BasePlugin {
        constructor(getters, history, dispatch, config) {
            super(history, dispatch, config);
            this.getters = getters;
            this.ui = config;
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(ctx, layer) { }
    }
    UIPlugin.layers = [];

    /**
     * This plugin manage the autofill.
     *
     * The way it works is the next one:
     * For each line (row if the direction is left/right, col otherwise), we create
     * a "AutofillGenerator" object which is used to compute the cells to
     * autofill.
     *
     * When we need to autofill a cell, we compute the origin cell in the source.
     *  EX: from A1:A2, autofill A3->A6.
     *      Target | Origin cell
     *        A3   |   A1
     *        A4   |   A2
     *        A5   |   A1
     *        A6   |   A2
     * When we have the origin, we take the associated cell in the AutofillGenerator
     * and we apply the modifier (AutofillModifier) associated to the content of the
     * cell.
     */
    /**
     * This class is used to generate the next values to autofill.
     * It's done from a selection (the source) and describe how the next values
     * should be computed.
     */
    class AutofillGenerator {
        constructor(cells, getters, direction) {
            this.index = 0;
            this.cells = cells;
            this.getters = getters;
            this.direction = direction;
        }
        /**
         * Get the next value to autofill
         */
        next() {
            const genCell = this.cells[this.index++ % this.cells.length];
            if (!genCell.rule) {
                return {
                    cellData: genCell.data,
                    tooltip: genCell.data.content ? { props: genCell.data.content } : undefined,
                };
            }
            const rule = genCell.rule;
            const { cellData, tooltip } = autofillModifiersRegistry
                .get(rule.type)
                .apply(rule, genCell.data, this.getters, this.direction);
            return {
                cellData: Object.assign({}, genCell.data, cellData),
                tooltip,
            };
        }
    }
    /**
     * Autofill Plugin
     *
     */
    class AutofillPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.lastCellSelected = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "AUTOFILL_SELECT":
                    const sheetId = this.getters.getActiveSheetId();
                    this.lastCellSelected.col =
                        cmd.col === -1
                            ? this.lastCellSelected.col
                            : clip(cmd.col, 0, this.getters.getSheet(sheetId).cols.length);
                    this.lastCellSelected.row =
                        cmd.row === -1
                            ? this.lastCellSelected.row
                            : clip(cmd.row, 0, this.getters.getSheet(sheetId).rows.length);
                    if (this.lastCellSelected.col !== undefined && this.lastCellSelected.row !== undefined) {
                        return { status: "SUCCESS" };
                    }
                    return { status: "CANCELLED", reason: 23 /* InvalidAutofillSelection */ };
                case "AUTOFILL_AUTO":
                    const zone = this.getters.getSelectedZone();
                    return zone.top === zone.bottom
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 0 /* Unknown */ };
            }
            return { status: "SUCCESS" };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "AUTOFILL":
                    this.autofill(true);
                    break;
                case "AUTOFILL_SELECT":
                    this.select(cmd.col, cmd.row);
                    break;
                case "AUTOFILL_AUTO":
                    this.autofillAuto();
                    break;
                case "AUTOFILL_CELL":
                    this.autoFillMerge(cmd.originCol, cmd.originRow, cmd.col, cmd.row);
                    const sheetId = this.getters.getActiveSheetId();
                    this.dispatch("UPDATE_CELL", {
                        sheetId,
                        col: cmd.col,
                        row: cmd.row,
                        style: cmd.style,
                        content: cmd.content,
                        format: cmd.format,
                    });
                    this.dispatch("SET_BORDER", {
                        sheetId,
                        col: cmd.col,
                        row: cmd.row,
                        border: cmd.border,
                    });
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getAutofillTooltip() {
            return this.tooltip;
        }
        // ---------------------------------------------------------------------------
        // Private methods
        // ---------------------------------------------------------------------------
        /**
         * Autofill the autofillZone from the current selection
         * @param apply Flag set to true to apply the autofill in the model. It's
         *              useful to set it to false when we need to fill the tooltip
         */
        autofill(apply) {
            if (!this.autofillZone || this.direction === undefined) {
                this.tooltip = undefined;
                return;
            }
            const source = this.getters.getSelectedZone();
            const target = this.autofillZone;
            switch (this.direction) {
                case 1 /* DOWN */:
                    for (let col = source.left; col <= source.right; col++) {
                        const xcs = [];
                        for (let row = source.top; row <= source.bottom; row++) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let row = target.top; row <= target.bottom; row++) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
                case 0 /* UP */:
                    for (let col = source.left; col <= source.right; col++) {
                        const xcs = [];
                        for (let row = source.bottom; row >= source.top; row--) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let row = target.bottom; row >= target.top; row--) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
                case 2 /* LEFT */:
                    for (let row = source.top; row <= source.bottom; row++) {
                        const xcs = [];
                        for (let col = source.right; col >= source.left; col--) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let col = target.right; col >= target.left; col--) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
                case 3 /* RIGHT */:
                    for (let row = source.top; row <= source.bottom; row++) {
                        const xcs = [];
                        for (let col = source.left; col <= source.right; col++) {
                            xcs.push(toXC(col, row));
                        }
                        const generator = this.createGenerator(xcs);
                        for (let col = target.left; col <= target.right; col++) {
                            this.computeNewCell(generator, col, row, apply);
                        }
                    }
                    break;
            }
            if (apply) {
                const zone = union(this.getters.getSelectedZone(), this.autofillZone);
                this.autofillZone = undefined;
                this.lastCellSelected = {};
                this.direction = undefined;
                this.tooltip = undefined;
                this.dispatch("SET_SELECTION", {
                    zones: [zone],
                    anchor: [zone.left, zone.top],
                });
            }
        }
        /**
         * Select a cell which becomes the last cell of the autofillZone
         */
        select(col, row) {
            const source = this.getters.getSelectedZone();
            if (isInside(col, row, source)) {
                this.autofillZone = undefined;
                return;
            }
            this.direction = this.getDirection(col, row);
            switch (this.direction) {
                case 0 /* UP */:
                    this.saveZone(row, source.top - 1, source.left, source.right);
                    break;
                case 1 /* DOWN */:
                    this.saveZone(source.bottom + 1, row, source.left, source.right);
                    break;
                case 2 /* LEFT */:
                    this.saveZone(source.top, source.bottom, col, source.left - 1);
                    break;
                case 3 /* RIGHT */:
                    this.saveZone(source.top, source.bottom, source.right + 1, col);
                    break;
            }
            this.autofill(false);
        }
        /**
         * Computes the autofillZone to autofill when the user double click on the
         * autofiller
         */
        autofillAuto() {
            const zone = this.getters.getSelectedZone();
            const sheetId = this.getters.getActiveSheetId();
            let col = zone.left;
            let row = zone.bottom;
            if (col > 0) {
                let left = this.getters.getCell(sheetId, col - 1, row);
                while (left && left.type !== "empty") {
                    row += 1;
                    left = this.getters.getCell(sheetId, col - 1, row);
                }
            }
            if (row === zone.bottom) {
                col = zone.right;
                if (col <= this.getters.getActiveSheet().cols.length) {
                    let right = this.getters.getCell(sheetId, col + 1, row);
                    while (right && right.type !== "empty") {
                        row += 1;
                        right = this.getters.getCell(sheetId, col + 1, row);
                    }
                }
            }
            if (row !== zone.bottom) {
                this.select(zone.left, row - 1);
                this.autofill(true);
            }
        }
        /**
         * Generate the next cell
         */
        computeNewCell(generator, col, row, apply) {
            const { cellData, tooltip } = generator.next();
            const { col: originCol, row: originRow, content, style, border, format } = cellData;
            this.tooltip = tooltip;
            if (apply) {
                this.dispatch("AUTOFILL_CELL", {
                    originCol,
                    originRow,
                    col,
                    row,
                    content,
                    style,
                    border,
                    format,
                });
            }
        }
        /**
         * Get the rule associated to the current cell
         */
        getRule(cell, cells) {
            const rules = autofillRulesRegistry.getAll().sort((a, b) => a.sequence - b.sequence);
            const rule = rules.find((rule) => rule.condition(cell, cells));
            return rule && rule.generateRule(cell, cells);
        }
        /**
         * Create the generator to be able to autofill the next cells.
         */
        createGenerator(source) {
            const nextCells = [];
            const cellsData = [];
            const sheetId = this.getters.getActiveSheetId();
            for (let xc of source) {
                const [col, row] = toCartesian(xc);
                const cell = this.getters.getCell(sheetId, col, row);
                let cellData = {
                    col,
                    row,
                    cell,
                };
                cellsData.push(cellData);
            }
            const cells = cellsData.map((cellData) => cellData.cell);
            for (let cellData of cellsData) {
                let rule;
                if (cellData && cellData.cell) {
                    rule = this.getRule(cellData.cell, cells);
                }
                else {
                    rule = { type: "COPY_MODIFIER" };
                }
                const { col, row } = cellData;
                const data = {
                    row,
                    col,
                    content: cellData.cell ? this.getters.getCellText(cellData.cell, sheetId, true) : "",
                    style: cellData.cell ? cellData.cell.style : undefined,
                    border: this.getters.getCellBorder(sheetId, col, row) || undefined,
                    format: cellData.cell ? cellData.cell.format : undefined,
                };
                nextCells.push({ data, rule });
            }
            return new AutofillGenerator(nextCells, this.getters, this.direction);
        }
        saveZone(top, bottom, left, right) {
            this.autofillZone = { top, bottom, left, right };
        }
        /**
         * Compute the direction of the autofill from the last selected zone and
         * a given cell (col, row)
         */
        getDirection(col, row) {
            const source = this.getters.getSelectedZone();
            const position = {
                up: { number: source.top - row, value: 0 /* UP */ },
                down: { number: row - source.bottom, value: 1 /* DOWN */ },
                left: { number: source.left - col, value: 2 /* LEFT */ },
                right: { number: col - source.right, value: 3 /* RIGHT */ },
            };
            if (Object.values(position)
                .map((x) => (x.number > 0 ? 1 : 0))
                .reduce((acc, value) => acc + value) === 1) {
                return Object.values(position).find((x) => (x.number > 0 ? 1 : 0)).value;
            }
            const first = position.up.number > 0 ? "up" : "down";
            const second = position.left.number > 0 ? "left" : "right";
            return Math.abs(position[first].number) >= Math.abs(position[second].number)
                ? position[first].value
                : position[second].value;
        }
        autoFillMerge(originCol, originRow, col, row) {
            const activeSheet = this.getters.getActiveSheet();
            if (this.getters.isInMerge(activeSheet.id, col, row) &&
                !this.getters.isInMerge(activeSheet.id, originCol, originRow)) {
                const zone = this.getters.getMerge(activeSheet.id, col, row);
                if (zone) {
                    this.dispatch("REMOVE_MERGE", {
                        sheetId: activeSheet.id,
                        zone,
                    });
                }
            }
            const originMerge = this.getters.getMerge(activeSheet.id, originCol, originRow);
            if ((originMerge === null || originMerge === void 0 ? void 0 : originMerge.topLeft.col) === originCol && (originMerge === null || originMerge === void 0 ? void 0 : originMerge.topLeft.row) === originRow) {
                this.dispatch("ADD_MERGE", {
                    sheetId: activeSheet.id,
                    zone: {
                        top: row,
                        bottom: row + originMerge.bottom - originMerge.top,
                        left: col,
                        right: col + originMerge.right - originMerge.left,
                    },
                });
            }
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            if (!this.autofillZone) {
                return;
            }
            const { viewport, ctx, thinLineWidth } = renderingContext;
            const [x, y, width, height] = this.getters.getRect(this.autofillZone, viewport);
            if (width > 0 && height > 0) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = thinLineWidth;
                ctx.setLineDash([3]);
                ctx.strokeRect(x, y, width, height);
                ctx.setLineDash([]);
            }
        }
    }
    AutofillPlugin.layers = [6 /* Autofill */];
    AutofillPlugin.getters = ["getAutofillTooltip"];
    AutofillPlugin.modes = ["normal", "readonly"];

    /**
     * Clipboard Plugin
     *
     * This clipboard manages all cut/copy/paste interactions internal to the
     * application, and with the OS clipboard as well.
     */
    class ClipboardPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.status = "empty";
            this.zones = [];
            this.originSheetId = null;
            this._isPaintingFormat = false;
            this.pasteOnlyValue = false;
            this.pasteOnlyFormat = false;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            const force = "force" in cmd ? !!cmd.force : false;
            if (cmd.type === "PASTE") {
                return this.isPasteAllowed(cmd.target, force);
            }
            return {
                status: "SUCCESS",
            };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "COPY":
                    this.cutOrCopy(cmd.target, false);
                    break;
                case "CUT":
                    this.cutOrCopy(cmd.target, true);
                    break;
                case "PASTE":
                    this.pasteOnlyValue = "onlyValue" in cmd && !!cmd.onlyValue;
                    const onlyFormat = "onlyFormat" in cmd ? !!cmd.onlyFormat : this._isPaintingFormat;
                    this._isPaintingFormat = false;
                    this.pasteOnlyFormat = !this.pasteOnlyValue && onlyFormat;
                    if (cmd.interactive) {
                        this.interactivePaste(cmd.target);
                    }
                    else {
                        this.pasteFromModel(cmd.target);
                    }
                    break;
                case "PASTE_CELL":
                    const [mainCellCol, mainCellRow] = this.getters.getMainCell(cmd.originSheet, cmd.originCol, cmd.originRow);
                    if (mainCellCol == cmd.originCol && mainCellRow == cmd.originRow) {
                        this.pasteMerge(cmd.originCol, cmd.originRow, cmd.col, cmd.row, cmd.originSheet, cmd.sheetId, cmd.cut);
                    }
                    this.pasteCell(cmd.originSheet, cmd.origin, cmd.originBorder, cmd.originCol, cmd.originRow, cmd.col, cmd.row, cmd.onlyValue, cmd.onlyFormat);
                    break;
                case "PASTE_FROM_OS_CLIPBOARD":
                    this.pasteFromClipboard(cmd.target, cmd.text);
                    break;
                case "ACTIVATE_PAINT_FORMAT":
                    this._isPaintingFormat = true;
                    this.cutOrCopy(cmd.target, false);
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Format the current clipboard to a string suitable for being pasted in other
         * programs.
         *
         * - add a tab character between each consecutive cells
         * - add a newline character between each line
         *
         * Note that it returns \t if the clipboard is empty. This is necessary for the
         * clipboard copy event to add it as data, otherwise an empty string is not
         * considered as a copy content.
         */
        getClipboardContent() {
            if (!this.cells) {
                return "\t";
            }
            return (this.cells
                .map((cells) => {
                return cells
                    .map((c) => c.cell
                    ? this.getters.getCellText(c.cell, c.sheetId, this.getters.shouldShowFormulas())
                    : "")
                    .join("\t");
            })
                .join("\n") || "\t");
        }
        getPasteZones(target) {
            if (!this.cells) {
                return target;
            }
            const height = this.cells.length;
            const width = this.cells[0].length;
            const selection = target[target.length - 1];
            const pasteZones = [];
            let col = selection.left;
            let row = selection.top;
            const repX = Math.max(1, Math.floor((selection.right + 1 - selection.left) / width));
            const repY = Math.max(1, Math.floor((selection.bottom + 1 - selection.top) / height));
            for (let x = 1; x <= repX; x++) {
                for (let y = 1; y <= repY; y++) {
                    pasteZones.push({
                        left: col,
                        top: row,
                        right: col - 1 + x * width,
                        bottom: row - 1 + y * height,
                    });
                }
            }
            return pasteZones;
        }
        isPaintingFormat() {
            return this._isPaintingFormat;
        }
        // ---------------------------------------------------------------------------
        // Private methods
        // ---------------------------------------------------------------------------
        cutOrCopy(zones, cut) {
            const tops = new Set(zones.map((z) => z.top));
            const bottoms = new Set(zones.map((z) => z.bottom));
            const areZonesCompatible = tops.size === 1 && bottoms.size === 1;
            let clippedZones = areZonesCompatible ? zones : [zones[zones.length - 1]];
            clippedZones = clippedZones.map((z) => Object.assign({}, z));
            const cells = [];
            const activeSheetId = this.getters.getActiveSheetId();
            let { top, bottom } = clippedZones[0];
            for (let r = top; r <= bottom; r++) {
                const row = [];
                cells.push(row);
                for (let zone of clippedZones) {
                    let { left, right } = zone;
                    for (let c = left; c <= right; c++) {
                        const cell = this.getters.getCell(activeSheetId, c, r);
                        row.push({
                            cell: cell ? Object.assign({}, cell) : null,
                            border: this.getters.getCellBorder(activeSheetId, c, r),
                            col: c,
                            row: r,
                            sheetId: activeSheetId,
                        });
                    }
                }
            }
            this.status = "visible";
            this.shouldCut = cut;
            this.zones = clippedZones;
            this.cells = cells;
            this.originSheetId = activeSheetId;
        }
        pasteFromClipboard(target, content) {
            this.status = "invisible";
            const values = content
                .replace(/\r/g, "")
                .split("\n")
                .map((vals) => vals.split("\t"));
            const { left: activeCol, top: activeRow } = target[0];
            const width = Math.max.apply(Math, values.map((a) => a.length));
            const height = values.length;
            const sheet = this.getters.getActiveSheet();
            this.addMissingDimensions(sheet, width, height, activeCol, activeRow);
            for (let i = 0; i < values.length; i++) {
                for (let j = 0; j < values[i].length; j++) {
                    this.dispatch("UPDATE_CELL", {
                        row: activeRow + i,
                        col: activeCol + j,
                        content: values[i][j],
                        sheetId: sheet.id,
                    });
                }
            }
            this.dispatch("SET_SELECTION", {
                anchor: [activeCol, activeRow],
                zones: [
                    {
                        left: activeCol,
                        top: activeRow,
                        right: activeCol + width - 1,
                        bottom: activeRow + height - 1,
                    },
                ],
            });
        }
        isPasteAllowed(target, force) {
            const sheetId = this.getters.getActiveSheetId();
            const { zones, cells, status } = this;
            // cannot paste if we have a clipped zone larger than a cell and multiple
            // zones selected
            if (!zones || !cells || status === "empty") {
                return { status: "CANCELLED", reason: 13 /* EmptyClipboard */ };
            }
            else if (target.length > 1 && (cells.length > 1 || cells[0].length > 1)) {
                return { status: "CANCELLED", reason: 12 /* WrongPasteSelection */ };
            }
            if (!force) {
                const pasteZones = this.getters.getPasteZones(target);
                for (let zone of pasteZones) {
                    if (this.getters.doesIntersectMerge(sheetId, zone)) {
                        return {
                            status: "CANCELLED",
                            reason: 1 /* WillRemoveExistingMerge */,
                        };
                    }
                }
            }
            return { status: "SUCCESS" };
        }
        pasteFromModel(target) {
            const { cells, shouldCut } = this;
            if (!cells) {
                return;
            }
            this.status = shouldCut ? "empty" : "invisible";
            if (shouldCut) {
                this.clearCutZone();
            }
            const height = cells.length;
            const width = cells[0].length;
            if (target.length > 1) {
                for (let zone of target) {
                    for (let i = zone.left; i <= zone.right; i++) {
                        for (let j = zone.top; j <= zone.bottom; j++) {
                            this.pasteZone(width, height, i, j);
                        }
                    }
                }
                return;
            }
            const selection = target[target.length - 1];
            let col = selection.left;
            let row = selection.top;
            const repX = Math.max(1, Math.floor((selection.right + 1 - selection.left) / width));
            const repY = Math.max(1, Math.floor((selection.bottom + 1 - selection.top) / height));
            for (let x = 0; x < repX; x++) {
                for (let y = 0; y < repY; y++) {
                    this.pasteZone(width, height, col + x * width, row + y * height);
                }
            }
            if (height > 1 || width > 1) {
                const newSelection = {
                    left: col,
                    top: row,
                    right: col + repX * width - 1,
                    bottom: row + repY * height - 1,
                };
                const [anchorCol, anchorRow] = this.getters.getSelection().anchor;
                const newCol = clip(anchorCol, col, col + repX * width - 1);
                const newRow = clip(anchorRow, row, row + repY * height - 1);
                this.dispatch("SET_SELECTION", {
                    anchor: [newCol, newRow],
                    zones: [newSelection],
                });
            }
        }
        clearCutZone() {
            for (let row of this.cells) {
                for (let cell of row) {
                    if (cell) {
                        this.dispatch("CLEAR_CELL", {
                            sheetId: this.originSheetId,
                            col: cell.col,
                            row: cell.row,
                        });
                        this.dispatch("CLEAR_FORMATTING", {
                            sheetId: this.originSheetId,
                            target: [{ top: cell.row, bottom: cell.row, left: cell.col, right: cell.col }],
                        });
                    }
                }
            }
        }
        pasteZone(width, height, col, row) {
            // first, add missing cols/rows if needed
            this.addMissingDimensions(this.getters.getActiveSheet(), width, height, col, row);
            // then, perform the actual paste operation
            for (let r = 0; r < height; r++) {
                const rowCells = this.cells[r];
                for (let c = 0; c < width; c++) {
                    const originCell = rowCells[c];
                    this.dispatch("PASTE_CELL", {
                        origin: originCell.cell,
                        originBorder: originCell.border,
                        originCol: originCell.col,
                        originRow: originCell.row,
                        originSheet: originCell.sheetId,
                        col: col + c,
                        row: row + r,
                        sheetId: this.getters.getActiveSheetId(),
                        cut: this.shouldCut,
                        onlyValue: this.pasteOnlyValue,
                        onlyFormat: this.pasteOnlyFormat,
                    });
                }
            }
        }
        pasteMerge(originCol, originRow, col, row, originSheet, sheetId, cut) {
            const merge = this.getters.getMerge(originSheet, originCol, originRow);
            const sheet = this.getters.getSheet(sheetId);
            if (!merge || !sheet)
                return;
            if (cut) {
                this.dispatch("REMOVE_MERGE", {
                    sheetId: originSheet,
                    zone: merge,
                });
            }
            this.dispatch("ADD_MERGE", {
                sheetId: this.getters.getActiveSheetId(),
                zone: {
                    left: col,
                    top: row,
                    right: col + merge.right - merge.left,
                    bottom: row + merge.bottom - merge.top,
                },
            });
        }
        addMissingDimensions(sheet, width, height, col, row) {
            const { cols, rows } = sheet;
            const missingRows = height + row - rows.length;
            if (missingRows > 0) {
                this.dispatch("ADD_ROWS", {
                    row: rows.length - 1,
                    sheetId: this.getters.getActiveSheetId(),
                    quantity: missingRows,
                    position: "after",
                });
            }
            const missingCols = width + col - cols.length;
            if (missingCols > 0) {
                this.dispatch("ADD_COLUMNS", {
                    column: cols.length - 1,
                    sheetId: this.getters.getActiveSheetId(),
                    quantity: missingCols,
                    position: "after",
                });
            }
        }
        pasteCell(originSheet, origin, originBorder, originCol, originRow, col, row, onlyValue, onlyFormat) {
            const sheetId = this.getters.getActiveSheetId();
            const targetCell = this.getters.getCell(sheetId, col, row);
            if (!onlyValue || onlyFormat) {
                this.dispatch("SET_BORDER", { sheetId, col, row, border: originBorder || undefined });
            }
            if (origin) {
                let style = origin.style;
                let format = origin.format;
                let content = this.getters.getCellValue(origin, originSheet, true) || "";
                if (onlyValue) {
                    style = targetCell ? targetCell.style : undefined;
                    format = targetCell ? targetCell.format : undefined;
                    if (origin.type === CellType.formula) {
                        content = this.valueToContent(origin.value);
                    }
                }
                else if (!onlyFormat && origin.type === CellType.formula) {
                    const offsetX = col - originCol;
                    const offsetY = row - originRow;
                    // TODO: replace with range specific stuff
                    content = this.getters.applyOffset(sheetId, content, offsetX, offsetY);
                }
                const newCell = {
                    style,
                    format,
                    sheetId,
                    col,
                    row,
                };
                if (!onlyFormat) {
                    newCell["content"] = content;
                }
                this.dispatch("UPDATE_CELL", newCell);
            }
            else if (targetCell) {
                if (onlyValue) {
                    this.dispatch("UPDATE_CELL", {
                        sheetId: sheetId,
                        col,
                        row,
                        content: "",
                    });
                }
                else if (onlyFormat) {
                    this.dispatch("UPDATE_CELL", {
                        sheetId: sheetId,
                        col,
                        row,
                        style: undefined,
                        format: undefined,
                    });
                }
                else {
                    this.dispatch("CLEAR_CELL", {
                        sheetId: this.getters.getActiveSheetId(),
                        col: col,
                        row: row,
                    });
                }
            }
        }
        valueToContent(cellValue) {
            switch (typeof cellValue) {
                case "number":
                    return cellValue.toString();
                case "string":
                    return cellValue;
                case "boolean":
                    return cellValue ? "TRUE" : "FALSE";
                default:
                    return "";
            }
        }
        interactivePaste(target) {
            const result = this.dispatch("PASTE", { target, onlyFormat: false });
            if (result.status === "CANCELLED") {
                if (result.reason === 12 /* WrongPasteSelection */) {
                    this.ui.notifyUser(_lt("This operation is not allowed with multiple selections."));
                }
                if (result.reason === 1 /* WillRemoveExistingMerge */) {
                    this.ui.askConfirmation(_lt("Pasting here will remove existing merge(s). Paste anyway?"), () => this.dispatch("PASTE", { target, onlyFormat: false, force: true }));
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            const { viewport, ctx, thinLineWidth } = renderingContext;
            const zones = this.zones;
            if (this.status !== "visible" ||
                !zones.length ||
                this.originSheetId !== this.getters.getActiveSheetId()) {
                return;
            }
            ctx.save();
            ctx.setLineDash([8, 5]);
            ctx.strokeStyle = "#3266ca";
            ctx.lineWidth = 3.3 * thinLineWidth;
            for (const zone of zones) {
                const [x, y, width, height] = this.getters.getRect(zone, viewport);
                if (width > 0 && height > 0) {
                    ctx.strokeRect(x, y, width, height);
                }
            }
            ctx.restore();
        }
    }
    ClipboardPlugin.layers = [2 /* Clipboard */];
    ClipboardPlugin.getters = ["getClipboardContent", "isPaintingFormat", "getPasteZones"];
    ClipboardPlugin.modes = ["normal", "readonly"];

    const SelectionIndicator = "␣";
    class EditionPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.col = 0;
            this.row = 0;
            this.mode = "inactive";
            this.sheet = "";
            this.currentContent = "";
            this.selectionStart = 0;
            this.selectionEnd = 0;
            this.selectionInitialStart = 0;
            this.initialContent = "";
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "CHANGE_COMPOSER_SELECTION":
                    const length = this.currentContent.length;
                    const { start, end } = cmd;
                    return start >= 0 && start <= length && end >= 0 && end <= length && start <= end
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 24 /* WrongComposerSelection */ };
                case "SET_CURRENT_CONTENT":
                case "START_EDITION":
                    return cmd.selection && cmd.selection.start > cmd.selection.end
                        ? { status: "CANCELLED", reason: 24 /* WrongComposerSelection */ }
                        : { status: "SUCCESS" };
                default:
                    return { status: "SUCCESS" };
            }
        }
        beforeHandle(cmd) {
            switch (cmd.type) {
                case "ACTIVATE_SHEET":
                    if (this.mode !== "selecting") {
                        this.stopEdition();
                    }
                    break;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "START":
                    this.setActiveContent();
                    break;
                case "CHANGE_COMPOSER_SELECTION":
                    this.selectionStart = cmd.start;
                    this.selectionEnd = cmd.end;
                    break;
                case "STOP_COMPOSER_SELECTION":
                    this.removeSelectionIndicator();
                    if (this.mode === "selecting") {
                        this.mode = "editing";
                    }
                    break;
                case "START_EDITION":
                    this.startEdition(cmd.text, cmd.selection);
                    this.highlightRanges();
                    break;
                case "STOP_EDITION":
                    if (cmd.cancel) {
                        this.cancelEdition();
                        this.resetContent();
                    }
                    else {
                        this.removeSelectionIndicator();
                        this.stopEdition();
                    }
                    break;
                case "SET_CURRENT_CONTENT":
                    this.setContent(cmd.content, cmd.selection);
                    if (this.mode !== "inactive") {
                        this.highlightRanges();
                    }
                    break;
                case "REPLACE_COMPOSER_SELECTION":
                    this.replaceSelection(cmd.text);
                    break;
                case "ACTIVATE_SHEET":
                    if (this.mode === "inactive") {
                        this.setActiveContent();
                    }
                    break;
                case "SELECT_CELL":
                case "SET_SELECTION":
                case "MOVE_POSITION":
                    if (this.mode === "editing") {
                        this.dispatch("STOP_EDITION");
                    }
                    else if (this.mode === "selecting") {
                        this.removeSelectionIndicator();
                        this.insertSelectedRange();
                    }
                    if (this.mode === "inactive") {
                        this.setActiveContent();
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getEditionMode() {
            return this.mode;
        }
        getCurrentContent() {
            if (this.mode === "inactive") {
                const cell = this.getters.getActiveCell();
                const activeSheetId = this.getters.getActiveSheetId();
                return cell ? this.getters.getCellText(cell, activeSheetId, true) : "";
            }
            return this.currentContent;
        }
        getEditionSheet() {
            return this.sheet;
        }
        getComposerSelection() {
            return {
                start: this.selectionStart,
                end: this.selectionEnd,
            };
        }
        isSelectingForComposer() {
            return this.mode === "selecting" || this.mode === "resettingPosition";
        }
        /**
         * Return the (enriched) token just before the cursor.
         */
        getTokenAtCursor() {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            if (start === end && end === 0) {
                return undefined;
            }
            else {
                const tokens = composerTokenize(this.currentContent);
                return tokens.find((t) => t.start <= start && t.end >= end);
            }
        }
        // ---------------------------------------------------------------------------
        // Misc
        // ---------------------------------------------------------------------------
        /**
         * Enable the selecting mode
         */
        startComposerSelection() {
            this.mode = "resettingPosition";
            this.insertSelectionIndicator();
            const [col, row] = this.getters.getPosition();
            this.dispatch("SELECT_CELL", {
                col,
                row,
            });
            this.mode = "selecting";
            // We set this variable to store the start of the selection, to allow
            // to replace selections (ex: select twice a cell should only be added
            // once)
            this.selectionInitialStart = this.selectionStart;
        }
        getCellContent(cell) {
            var _a;
            switch (cell.type) {
                case CellType.formula:
                    return this.getters.getFormulaCellContent(this.getters.getActiveSheetId(), cell);
                case CellType.empty:
                    return "";
                case CellType.number:
                    return ((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT)) ? formatDateTime({ value: (cell.value || 0), format: cell.format })
                        : cell.content;
                case CellType.text:
                case CellType.invalidFormula:
                    return cell.content;
            }
        }
        /**
         * start the edition of a cell
         * @param str the key that is used to start the edition if it is a "content" key like a letter or number
         * @param selection
         * @private
         */
        startEdition(str, selection) {
            const cell = this.getters.getActiveCell();
            this.initialContent = (cell && this.getCellContent(cell)) || "";
            this.mode = "editing";
            this.setContent(str || this.initialContent, selection);
            this.dispatch("REMOVE_ALL_HIGHLIGHTS");
            const [col, row] = this.getters.getPosition();
            this.col = col;
            this.row = row;
            this.sheet = this.getters.getActiveSheetId();
        }
        stopEdition() {
            if (this.mode !== "inactive") {
                this.cancelEdition();
                const sheetId = this.getters.getActiveSheetId();
                const [col, row] = this.getters.getMainCell(sheetId, this.col, this.row);
                let content = this.currentContent;
                this.setContent("");
                const didChange = this.initialContent !== content;
                if (!didChange) {
                    return;
                }
                if (content) {
                    if (content.startsWith("=")) {
                        const tokens = tokenize(content);
                        const left = tokens.filter((t) => t.type === "LEFT_PAREN").length;
                        const right = tokens.filter((t) => t.type === "RIGHT_PAREN").length;
                        const missing = left - right;
                        if (missing > 0) {
                            content += new Array(missing).fill(")").join("");
                        }
                    }
                    this.dispatch("UPDATE_CELL", {
                        sheetId: this.sheet,
                        col,
                        row,
                        content,
                    });
                }
                else {
                    this.dispatch("UPDATE_CELL", {
                        sheetId: this.sheet,
                        content: "",
                        col,
                        row,
                    });
                }
                if (sheetId !== this.sheet) {
                    this.dispatch("ACTIVATE_SHEET", {
                        sheetIdFrom: this.getters.getActiveSheetId(),
                        sheetIdTo: this.sheet,
                    });
                }
            }
        }
        cancelEdition() {
            this.mode = "inactive";
            this.dispatch("REMOVE_ALL_HIGHLIGHTS");
        }
        /**
         * Reset the current content to the active cell content
         */
        resetContent() {
            this.setContent(this.initialContent || "");
        }
        setContent(text, selection) {
            this.currentContent = text;
            if (selection) {
                this.selectionStart = selection.start;
                this.selectionEnd = selection.end;
            }
            else {
                this.selectionStart = this.selectionEnd = text.length;
            }
            if (this.canStartComposerSelection()) {
                this.startComposerSelection();
            }
        }
        /**
         * Insert the currently selected zone XC in the composer content.
         * The XC replaces the following section:
         *  - start:  where the cursor was when the edition mode was
         *            changed to `selecting`.
         *  - end:    the current end of the selection.
         */
        insertSelectedRange() {
            const [zone] = this.getters.getSelectedZones();
            const sheetId = this.getters.getActiveSheetId();
            let selectedXc = this.getters.zoneToXC(sheetId, zone);
            const { end } = this.getters.getComposerSelection();
            this.dispatch("CHANGE_COMPOSER_SELECTION", {
                start: this.selectionInitialStart,
                end,
            });
            if (this.getters.getEditionSheet() !== this.getters.getActiveSheetId()) {
                const sheetName = getComposerSheetName(this.getters.getSheetName(this.getters.getActiveSheetId()));
                selectedXc = `${sheetName}!${selectedXc}`;
            }
            this.replaceSelection(selectedXc);
        }
        //insert a visual symbol to indicate the user that selection started
        insertSelectionIndicator() {
            const content = this.currentContent.slice(0, this.selectionStart) +
                SelectionIndicator +
                this.currentContent.slice(this.selectionStart);
            this.setContent(content, {
                start: this.selectionStart,
                end: this.selectionStart,
            });
        }
        removeSelectionIndicator() {
            this.currentContent = this.currentContent.replace(SelectionIndicator, "");
        }
        /**
         * Replace the current selection by a new text.
         * The cursor is then set at the end of the text.
         */
        replaceSelection(text) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.currentContent =
                this.currentContent.slice(0, start) +
                    this.currentContent.slice(end, this.currentContent.length);
            this.insertText(text, this.selectionStart);
        }
        /**
         * Insert a text at the given position.
         * The cursor is then set at the end of the text.
         */
        insertText(text, start) {
            const content = this.currentContent.slice(0, start) + text + this.currentContent.slice(start);
            const end = start + text.length;
            this.dispatch("SET_CURRENT_CONTENT", {
                content,
                selection: { start: end, end },
            });
        }
        /**
         * Highlight all ranges that can be found in the composer content.
         */
        highlightRanges() {
            if (!this.currentContent.startsWith("=")) {
                return;
            }
            this.dispatch("REMOVE_ALL_HIGHLIGHTS"); //cleanup highlights for references
            const tokens = composerTokenize(this.currentContent);
            const ranges = {};
            let lastUsedColorIndex = 0;
            for (let token of tokens.filter((token) => token.type === "SYMBOL")) {
                let value = token.value;
                const [xc, sheet] = value.split("!").reverse();
                if (rangeReference.test(xc)) {
                    const refSanitized = (sheet ? `${sheet}!` : `${this.getters.getSheetName(this.getters.getEditionSheet())}!`) +
                        xc.replace(/\$/g, "");
                    if (!ranges[refSanitized]) {
                        ranges[refSanitized] = colors[lastUsedColorIndex];
                        lastUsedColorIndex = ++lastUsedColorIndex % colors.length;
                    }
                }
            }
            if (Object.keys(ranges).length) {
                this.dispatch("ADD_HIGHLIGHTS", { ranges });
            }
        }
        setActiveContent() {
            const sheetId = this.getters.getActiveSheetId();
            const [mainCellCol, mainCellRow] = this.getters.getMainCell(sheetId, ...this.getters.getPosition());
            const anchor = this.getters.getCell(this.getters.getActiveSheetId(), mainCellCol, mainCellRow);
            if (anchor) {
                const { col, row } = this.getters.getCellPosition(anchor.id);
                this.col = col;
                this.row = row;
            }
            const content = anchor ? this.getters.getCellText(anchor, sheetId, true) : "";
            this.dispatch("SET_CURRENT_CONTENT", {
                content,
            });
        }
        /**
         * Function used to determine when composer selection can start.
         * Three conditions are necessary:
         * - the previous token is among ["COMMA", "LEFT_PAREN", "OPERATOR"]
         * - the next token is missing or is among ["COMMA", "RIGHT_PAREN", "OPERATOR"]
         * - Previous and next tokens can be separated by spaces
         */
        canStartComposerSelection() {
            if (this.isSelectingForComposer())
                return false;
            const tokens = composerTokenize(this.currentContent);
            const tokenAtCursor = this.getTokenAtCursor();
            if (this.currentContent.startsWith("=") && tokenAtCursor) {
                const tokenIdex = tokens.map((token) => token.start).indexOf(tokenAtCursor.start);
                let count = tokenIdex;
                let curentToken = tokenAtCursor;
                // check previous token
                while (!["COMMA", "LEFT_PAREN", "OPERATOR"].includes(curentToken.type)) {
                    if (curentToken.type !== "SPACE" || count < 1) {
                        return false;
                    }
                    count--;
                    curentToken = tokens[count];
                }
                count = tokenIdex + 1;
                curentToken = tokens[count];
                // check next token
                while (curentToken && !["COMMA", "RIGHT_PAREN", "OPERATOR"].includes(curentToken.type)) {
                    if (curentToken.type !== "SPACE") {
                        return false;
                    }
                    count++;
                    curentToken = tokens[count];
                }
                return true;
            }
            return false;
        }
    }
    EditionPlugin.layers = [1 /* Highlights */];
    EditionPlugin.getters = [
        "getEditionMode",
        "isSelectingForComposer",
        "getCurrentContent",
        "getEditionSheet",
        "getComposerSelection",
        "getTokenAtCursor",
    ];
    EditionPlugin.modes = ["normal", "readonly"];

    function* makeObjectIterator(obj) {
        for (let i in obj) {
            yield obj[i];
        }
    }
    function* makeSetIterator(set) {
        for (let elem of set) {
            yield elem;
        }
    }
    const functionMap = functionRegistry.mapping;
    const LOADING = "Loading...";
    class EvaluationPlugin extends UIPlugin {
        constructor(getters, history, dispatch, config) {
            super(getters, history, dispatch, config);
            this.isUpToDate = new Set(); // Set<sheetIds>
            this.loadingCells = 0;
            this.isStarted = false;
            /**
             * For all cells that are being currently computed (asynchronously).
             *
             * For example: =Wait(3)
             */
            this.PENDING = new Set();
            /**
             * For all cells that are NOT being currently computed, but depend on another
             * asynchronous computation.
             *
             * For example: A2 is in WAITING (initially) and A1 in PENDING
             *   A1: =Wait(3)
             *   A2: =A1
             */
            this.WAITING = new Set();
            /**
             * For all cells that have been async computed.
             *
             * For example:
             *  A1: =Wait(3)
             *  A2: =A1
             *
             * When A1 is computed, A1 is moved in COMPUTED
             */
            this.COMPUTED = new Set();
            this.evalContext = config.evalContext;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "RENAME_SHEET":
                case "DELETE_SHEET":
                case "CREATE_SHEET":
                case "ADD_COLUMNS":
                case "ADD_ROWS":
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                    this.isUpToDate.clear();
                    break;
                case "UPDATE_CELL":
                    if ("content" in cmd) {
                        this.isUpToDate.clear();
                    }
                    break;
                case "EVALUATE_CELLS":
                    const sheetId = this.getters.getActiveSheetId();
                    if (cmd.onlyWaiting) {
                        const cells = new Set(this.WAITING);
                        this.WAITING.clear();
                        this.evaluateCells(makeSetIterator(cells), sheetId);
                    }
                    else {
                        this.WAITING.clear();
                        this.evaluate(sheetId);
                    }
                    this.isUpToDate.add(sheetId);
                    break;
                case "UNDO":
                case "REDO":
                    this.isUpToDate.clear();
                    break;
            }
        }
        finalize() {
            const sheetId = this.getters.getActiveSheetId();
            if (!this.isUpToDate.has(sheetId)) {
                this.evaluate(sheetId);
                this.isUpToDate.add(sheetId);
            }
            if (this.loadingCells > 0) {
                this.startScheduler();
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        evaluateFormula(formula, sheetId = this.getters.getActiveSheetId()) {
            let formulaString = normalize(formula);
            const compiledFormula = compile(formulaString);
            const params = this.getFormulaParameters(() => { });
            const ranges = [];
            for (let xc of formulaString.dependencies) {
                ranges.push(this.getters.getRangeFromSheetXC(sheetId, xc, undefined, true));
            }
            return compiledFormula(ranges, sheetId, ...params);
        }
        isIdle() {
            return this.loadingCells === 0;
        }
        getRangeFormattedValues(reference, defaultSheetId) {
            const [range, sheetName] = reference.split("!").reverse();
            const sheetId = sheetName ? this.getters.getSheetIdByName(sheetName) : defaultSheetId;
            const sheet = sheetId ? this.getters.getSheet(sheetId) : undefined;
            if (sheet === undefined)
                return [[]];
            return mapCellsInZone(toZone(range), sheet, (cell) => this.getters.getCellText(cell, sheetId || defaultSheetId, this.getters.shouldShowFormulas()), "");
        }
        getRangeValues(reference, defaultSheetId) {
            const [range, sheetName] = reference.split("!").reverse();
            const sheetId = sheetName ? this.getters.getSheetIdByName(sheetName) : defaultSheetId;
            const sheet = sheetId ? this.getters.tryGetSheet(sheetId) : undefined;
            if (sheet === undefined)
                return [[]];
            return mapCellsInZone(toZone(range), sheet, (cell) => cell.value);
        }
        // ---------------------------------------------------------------------------
        // Scheduler
        // ---------------------------------------------------------------------------
        startScheduler() {
            if (!this.isStarted) {
                this.isStarted = true;
                let current = this.loadingCells;
                const recomputeCells = () => {
                    if (this.loadingCells !== current) {
                        this.dispatch("EVALUATE_CELLS", { onlyWaiting: true });
                        current = this.loadingCells;
                        if (current === 0) {
                            this.isStarted = false;
                        }
                    }
                    if (current > 0) {
                        window.setTimeout(recomputeCells, 15);
                    }
                };
                window.setTimeout(recomputeCells, 5);
            }
        }
        // ---------------------------------------------------------------------------
        // Evaluator
        // ---------------------------------------------------------------------------
        evaluate(sheetId) {
            this.COMPUTED.clear();
            this.evaluateCells(makeObjectIterator(this.getters.getCells(sheetId)), sheetId);
        }
        evaluateCells(cells, sheetId) {
            const self = this;
            const { COMPUTED, PENDING, WAITING } = this;
            const params = this.getFormulaParameters(computeValue);
            const visited = {};
            for (let cell of cells) {
                computeValue(cell, sheetId);
            }
            function handleError(e, cell) {
                if (!(e instanceof Error)) {
                    e = new Error(e);
                }
                if (PENDING.has(cell)) {
                    PENDING.delete(cell);
                    self.loadingCells--;
                }
                if (e.message === "not ready") {
                    WAITING.add(cell);
                    cell.value = LOADING;
                }
                else if (!cell.error) {
                    cell.value = "#ERROR";
                    const __lastFnCalled = params[2].__lastFnCalled || "";
                    cell.error = e.message.replace("[[FUNCTION_NAME]]", __lastFnCalled);
                }
            }
            function computeValue(cell, sheetId) {
                if (cell.type !== "formula" || !cell.formula) {
                    return;
                }
                const position = params[2].getters.getCellPosition(cell.id);
                const xc = toXC(position.col, position.row);
                visited[sheetId] = visited[sheetId] || {};
                if (xc in visited[sheetId]) {
                    if (visited[sheetId][xc] === null) {
                        cell.value = "#CYCLE";
                        cell.error = _lt("Circular reference");
                    }
                    return;
                }
                if (COMPUTED.has(cell) || PENDING.has(cell)) {
                    return;
                }
                visited[sheetId][xc] = null;
                cell.error = undefined;
                try {
                    params[2].__originCellXC = xc;
                    if (cell.formula.compiledFormula.async) {
                        cell.value = LOADING;
                        PENDING.add(cell);
                        cell.formula
                            .compiledFormula(cell.dependencies, sheetId, ...params)
                            .then((val) => {
                            cell.value = val;
                            self.loadingCells--;
                            if (PENDING.has(cell)) {
                                PENDING.delete(cell);
                                COMPUTED.add(cell);
                            }
                        })
                            .catch((e) => handleError(e, cell));
                        self.loadingCells++;
                    }
                    else {
                        cell.value = cell.formula.compiledFormula(cell.dependencies, sheetId, ...params);
                    }
                    if (Array.isArray(cell.value)) {
                        // if a value returns an array (like =A1:A3)
                        throw new Error(_lt("This formula depends on invalid values"));
                    }
                    else {
                        cell.error = undefined;
                    }
                }
                catch (e) {
                    handleError(e, cell);
                }
                visited[sheetId][xc] = true;
            }
        }
        /**
         * Return all functions necessary to properly evaluate a formula:
         * - a refFn function to read any reference, cell or range of a normalized formula
         * - a range function to convert any reference to a proper value array
         * - an evaluation context
         */
        getFormulaParameters(computeValue) {
            const evalContext = Object.assign(Object.create(functionMap), this.evalContext, {
                getters: this.getters,
            });
            const sheets = this.getters.getEvaluationSheets();
            const PENDING = this.PENDING;
            function readCell(range) {
                var _a;
                let cell;
                const s = sheets[range.sheetId];
                if (s) {
                    cell = (_a = s.rows[range.zone.top]) === null || _a === void 0 ? void 0 : _a.cells[range.zone.left];
                }
                else {
                    throw new Error(_lt("Invalid sheet name"));
                }
                if (!cell || cell.content === "") {
                    return null;
                }
                return getCellValue(cell, range.sheetId);
            }
            function getCellValue(cell, sheetId) {
                if (cell.type === CellType.formula &&
                    cell.formula.compiledFormula.async &&
                    cell.error &&
                    !PENDING.has(cell)) {
                    throw new Error(_lt("This formula depends on invalid values"));
                }
                computeValue(cell, sheetId);
                if (cell.error) {
                    throw new Error(_lt("This formula depends on invalid values"));
                }
                if (cell.value === LOADING) {
                    throw new Error("not ready");
                }
                return cell.value;
            }
            /**
             * Return a range of values. It is a list of col values.
             *
             * Note that each col is possibly sparse: it only contain the values of cells
             * that are actually present in the grid.
             */
            function _range(range) {
                const sheet = sheets[range.sheetId];
                const zone = {
                    left: range.zone.left,
                    top: range.zone.top,
                    right: Math.min(range.zone.right, sheet.cols.length - 1),
                    bottom: Math.min(range.zone.bottom, sheet.rows.length - 1),
                };
                return mapCellsInZone(zone, sheet, (cell) => getCellValue(cell, range.sheetId));
            }
            /**
             * Returns the value of the cell(s) used in reference
             *
             * @param position the index in the references array
             * @param references all the references used in the current formula
             * @param sheetId the sheet that is currently being evaluated, if a reference does not
             *        include a sheet, it is the id of the sheet of the reference to be used
             * @param isMeta if a reference is supposed to be used in a `meta` parameter as described in the
             *        function for which this parameter is used, we just return the string of the parameter.
             *        The `compute` of the formula's function must process it completely
             */
            function refFn(position, references, sheetId, isMeta = false) {
                const range = references[position];
                if (isMeta) {
                    return evalContext.getters.getRangeString(range, sheetId);
                }
                if (range.invalidSheetName) {
                    throw new Error(_lt("Invalid sheet name: %s", range.invalidSheetName));
                }
                if (range.zone.left !== range.zone.right || range.zone.top !== range.zone.bottom) {
                    // it's a range
                    return _range(range);
                }
                else {
                    //it's a cell
                    return readCell(range);
                }
            }
            /**
             * Return the values of the cell(s) used in reference, but always in the format of a range even
             * if a single cell is referenced. This is useful for the formulas that describe parameters as
             * range<number> etc.
             *
             * the parameters are the same as refFn, except that these parameters cannot be Meta
             */
            function range(position, references) {
                return _range(references[position]);
            }
            return [refFn, range, evalContext];
        }
    }
    EvaluationPlugin.getters = ["evaluateFormula", "isIdle", "getRangeFormattedValues", "getRangeValues"];
    EvaluationPlugin.modes = ["normal", "readonly"];

    const GraphColors = [
        // the same colors as those used in odoo reporting
        "rgb(31,119,180)",
        "rgb(255,127,14)",
        "rgb(174,199,232)",
        "rgb(255,187,120)",
        "rgb(44,160,44)",
        "rgb(152,223,138)",
        "rgb(214,39,40)",
        "rgb(255,152,150)",
        "rgb(148,103,189)",
        "rgb(197,176,213)",
        "rgb(140,86,75)",
        "rgb(196,156,148)",
        "rgb(227,119,194)",
        "rgb(247,182,210)",
        "rgb(127,127,127)",
        "rgb(199,199,199)",
        "rgb(188,189,34)",
        "rgb(219,219,141)",
        "rgb(23,190,207)",
        "rgb(158,218,229)",
    ];
    class EvaluationChartPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            // contains the configuration of the chart with it's values like they should be displayed,
            // as well as all the options needed for the chart library to work correctly
            this.chartRuntime = {};
            this.outOfDate = new Set();
        }
        handle(cmd) {
            switch (cmd.type) {
                case "UPDATE_CHART":
                case "CREATE_CHART":
                    const chartDefinition = this.getters.getChartDefinition(cmd.id);
                    this.chartRuntime[cmd.id] = this.mapDefinitionToRuntime(chartDefinition);
                    this.dispatch("SELECT_FIGURE", { id: cmd.id });
                    break;
                case "DELETE_FIGURE":
                    delete this.chartRuntime[cmd.id];
                    break;
                case "UPDATE_CELL":
                    for (let chartId of Object.keys(this.chartRuntime)) {
                        if (this.isCellUsedInChart(cmd.sheetId, chartId, cmd.col, cmd.row)) {
                            this.outOfDate.add(chartId);
                        }
                    }
                    break;
                case "UNDO":
                case "REDO":
                    for (let chartId of Object.keys(this.chartRuntime)) {
                        this.outOfDate.add(chartId);
                    }
            }
        }
        finalize(cmd) {
            switch (cmd.type) {
                case "EVALUATE_CELLS":
                case "START":
                    // if there was an async evaluation of cell, there is no way to know which was updated so all charts must be updated
                    for (let id in this.chartRuntime) {
                        this.outOfDate.add(id);
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getChartRuntime(figureId) {
            if (this.outOfDate.has(figureId) || !(figureId in this.chartRuntime)) {
                const chartDefinition = this.getters.getChartDefinition(figureId);
                if (chartDefinition === undefined)
                    return;
                this.chartRuntime[figureId] = this.mapDefinitionToRuntime(chartDefinition);
                this.outOfDate.delete(figureId);
            }
            return this.chartRuntime[figureId];
        }
        getDefaultConfiguration(type, title, labels) {
            const config = {
                type,
                options: {
                    // https://www.chartjs.org/docs/latest/general/responsive.html
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 20, right: 20, top: 10, bottom: 10 } },
                    elements: {
                        line: {
                            fill: false,
                        },
                        point: {
                            hitRadius: 15,
                        },
                    },
                    animation: {
                        duration: 0,
                    },
                    hover: {
                        animationDuration: 10,
                    },
                    responsiveAnimationDuration: 0,
                    title: {
                        display: true,
                        fontSize: 22,
                        fontStyle: "normal",
                        text: title,
                    },
                },
                data: {
                    labels,
                    datasets: [],
                },
            };
            if (type !== "pie") {
                config.options.scales = {
                    xAxes: [
                        {
                            ticks: {
                                // x axis configuration
                                maxRotation: 60,
                                minRotation: 15,
                                padding: 5,
                                labelOffset: 2,
                            },
                        },
                    ],
                    yAxes: [
                        {
                            ticks: {
                                // y axis configuration
                                beginAtZero: true,
                            },
                        },
                    ],
                };
            }
            return config;
        }
        isCellUsedInChart(sheetId, chartId, col, row) {
            const chart = this.getters.getChartDefinition(chartId);
            if (chart === undefined) {
                return false;
            }
            if (chart.labelRange && isInside(col, row, chart.labelRange.zone)) {
                return true;
            }
            for (let ds of chart.dataSets) {
                const dataRange = ds.dataRange;
                if (dataRange && dataRange.zone && isInside(col, row, dataRange.zone)) {
                    return true;
                }
            }
            return false;
        }
        mapDefinitionToRuntime(definition) {
            let labels = [];
            if (definition.labelRange) {
                const rangeString = this.getters.getRangeString(definition.labelRange, definition.sheetId);
                if (rangeString !== "#REF") {
                    labels = this.getters.getRangeFormattedValues(rangeString, definition.sheetId).flat(1);
                }
            }
            const runtime = this.getDefaultConfiguration(definition.type, definition.title, labels);
            let graphColorIndex = 0;
            for (const ds of definition.dataSets) {
                let label;
                if (ds.labelCell) {
                    const labelRange = ds.labelCell;
                    const cell = labelRange
                        ? this.getters.getCell(labelRange.sheetId, labelRange.zone.left, labelRange.zone.top)
                        : undefined;
                    label =
                        cell && labelRange
                            ? this.getters.getCellText(cell, labelRange.sheetId)
                            : chartTerms.Series;
                }
                else {
                    label = chartTerms.Series;
                }
                const dataset = {
                    label,
                    data: ds.dataRange ? this.getData(ds, definition.sheetId) : [],
                    lineTension: 0,
                    borderColor: definition.type !== "pie" ? GraphColors[graphColorIndex] : "#FFFFFF",
                    backgroundColor: GraphColors[graphColorIndex],
                };
                if (definition.type === "pie") {
                    const colors = [];
                    for (let i = 0; i <= dataset.data.length - 1; i++) {
                        colors.push(GraphColors[graphColorIndex]);
                        graphColorIndex = ++graphColorIndex % GraphColors.length;
                    }
                    // In case of pie graph, dataset.backgroundColor is an array of string
                    // @ts-ignore
                    dataset.backgroundColor = colors;
                }
                graphColorIndex = ++graphColorIndex % GraphColors.length;
                runtime.data.datasets.push(dataset);
            }
            return runtime;
        }
        getData(ds, sheetId) {
            if (ds.dataRange) {
                const labelCellZone = ds.labelCell ? [zoneToXc(ds.labelCell.zone)] : [];
                const dataXC = recomputeZones([zoneToXc(ds.dataRange.zone)], labelCellZone)[0];
                const dataRange = this.getters.getRangeFromSheetXC(sheetId, dataXC, undefined, false);
                const dataRangeXc = this.getters.getRangeString(dataRange, sheetId);
                return this.getters.getRangeValues(dataRangeXc, ds.dataRange.sheetId).flat(1);
            }
            return [];
        }
    }
    EvaluationChartPlugin.getters = ["getChartRuntime"];
    EvaluationChartPlugin.modes = ["normal", "readonly"];

    // -----------------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------------
    class EvaluationConditionalFormatPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.isStale = true;
            // stores the computed styles in the format of computedStyles.sheetName[col][row] = Style
            this.computedStyles = {};
            /**
             * Execute the predicate to know if a conditional formatting rule should be applied to a cell
             */
            this.rulePredicate = {
                CellIsRule: (cell, rule) => {
                    let value;
                    if (cell) {
                        switch (cell.type) {
                            case CellType.formula:
                            case CellType.number:
                            case CellType.text:
                                value = cell.value;
                                break;
                            case CellType.empty:
                            case CellType.invalidFormula:
                                value = "";
                        }
                    }
                    switch (rule.operator) {
                        case "BeginsWith":
                            if (!cell && rule.values[0] === "") {
                                return false;
                            }
                            return cell && value.startsWith(rule.values[0]);
                        case "EndsWith":
                            if (!cell && rule.values[0] === "") {
                                return false;
                            }
                            return cell && value.endsWith(rule.values[0]);
                        case "Between":
                            return cell && value >= rule.values[0] && value <= rule.values[1];
                        case "NotBetween":
                            return !(cell && value >= rule.values[0] && value <= rule.values[1]);
                        case "ContainsText":
                            return cell && value && value.toString().indexOf(rule.values[0]) > -1;
                        case "NotContains":
                            return cell && value && value.toString().indexOf(rule.values[0]) == -1;
                        case "GreaterThan":
                            return cell && value > rule.values[0];
                        case "GreaterThanOrEqual":
                            return cell && value >= rule.values[0];
                        case "LessThan":
                            return cell && value < rule.values[0];
                        case "LessThanOrEqual":
                            return cell && value <= rule.values[0];
                        case "NotEqual":
                            if (!cell && rule.values[0] === "") {
                                return false;
                            }
                            return cell && value != rule.values[0];
                        case "Equal":
                            if (!cell && rule.values[0] === "") {
                                return true;
                            }
                            return cell && value == rule.values[0];
                        default:
                            console.warn(_lt(`Not implemented operator ${rule.operator} for kind of conditional formatting:  ${rule.type}`));
                    }
                    return false;
                },
            };
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "ACTIVATE_SHEET":
                    const activeSheet = cmd.sheetIdTo;
                    this.computedStyles[activeSheet] = this.computedStyles[activeSheet] || {}; // ?
                    this.isStale = true;
                    break;
                case "AUTOFILL_CELL":
                    const sheetId = this.getters.getActiveSheetId();
                    const cfOrigin = this.getters.getRulesByCell(sheetId, cmd.originCol, cmd.originRow);
                    for (const cf of cfOrigin) {
                        this.adaptRules(sheetId, cf, [toXC(cmd.col, cmd.row)], []);
                    }
                    break;
                case "PASTE_CELL":
                    if (!cmd.onlyValue) {
                        this.pasteCf(cmd.originCol, cmd.originRow, cmd.col, cmd.row, cmd.originSheet, cmd.sheetId, cmd.cut);
                    }
                    break;
                case "DUPLICATE_SHEET":
                case "CREATE_SHEET":
                case "DELETE_SHEET":
                case "ADD_CONDITIONAL_FORMAT":
                case "REMOVE_CONDITIONAL_FORMAT":
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                case "ADD_COLUMNS":
                case "ADD_ROWS":
                case "EVALUATE_CELLS":
                case "UPDATE_CELL":
                case "UNDO":
                case "REDO":
                    this.isStale = true;
                    break;
            }
        }
        finalize() {
            if (this.isStale) {
                this.computeStyles();
                this.isStale = false;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Returns the conditional style property for a given cell reference in the active sheet or
         * undefined if this cell doesn't have a conditional style set.
         */
        getConditionalStyle(col, row) {
            var _a;
            const activeSheet = this.getters.getActiveSheetId();
            const styles = this.computedStyles[activeSheet];
            return styles && ((_a = styles[col]) === null || _a === void 0 ? void 0 : _a[row]);
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        /**
         * Compute the styles according to the conditional formatting.
         * This computation must happen after the cell values are computed if they change
         *
         * This result of the computation will be in the state.cell[XC].conditionalStyle and will be the union of all the style
         * properties of the rules applied (in order).
         * So if a cell has multiple conditional formatting applied to it, and each affect a different value of the style,
         * the resulting style will have the combination of all those values.
         * If multiple conditional formatting use the same style value, they will be applied in order so that the last applied wins
         */
        computeStyles() {
            var _a;
            const activeSheetId = this.getters.getActiveSheetId();
            this.computedStyles[activeSheetId] = {};
            const computedStyle = this.computedStyles[activeSheetId];
            for (let cf of this.getters.getConditionalFormats(activeSheetId)) {
                try {
                    switch (cf.rule.type) {
                        case "ColorScaleRule":
                            for (let range of cf.ranges) {
                                this.applyColorScale(range, cf.rule);
                            }
                            break;
                        default:
                            for (let ref of cf.ranges) {
                                const zone = toZone(ref);
                                for (let row = zone.top; row <= zone.bottom; row++) {
                                    for (let col = zone.left; col <= zone.right; col++) {
                                        const pr = this.rulePredicate[cf.rule.type];
                                        let cell = this.getters.getCell(activeSheetId, col, row);
                                        if (pr && pr(cell, cf.rule)) {
                                            if (!computedStyle[col])
                                                computedStyle[col] = [];
                                            // we must combine all the properties of all the CF rules applied to the given cell
                                            computedStyle[col][row] = Object.assign(((_a = computedStyle[col]) === null || _a === void 0 ? void 0 : _a[row]) || {}, cf.rule.style);
                                        }
                                    }
                                }
                            }
                            break;
                    }
                }
                catch (_) {
                    // we don't care about the errors within the evaluation of a rule
                }
            }
        }
        parsePoint(range, threshold, functionName) {
            switch (threshold.type) {
                case "value":
                    return this.getters.evaluateFormula(`=${functionName}(${range})`);
                case "number":
                    return Number(threshold.value);
                case "percentage":
                    const min = this.getters.evaluateFormula(`=min(${range})`);
                    const max = this.getters.evaluateFormula(`=max(${range})`);
                    const delta = max - min;
                    return min + (delta * Number(threshold.value)) / 100;
                case "percentile":
                    return this.getters.evaluateFormula(`=PERCENTILE(${range},${Number(threshold.value) / 100})`);
                case "formula":
                    const value = threshold.value && this.getters.evaluateFormula(threshold.value);
                    return !(value instanceof Promise) ? value : null;
                default:
                    return null;
            }
        }
        applyColorScale(range, rule) {
            var _a;
            const minValue = this.parsePoint(range, rule.minimum, "min");
            const midValue = rule.midpoint ? this.parsePoint(range, rule.midpoint) : null;
            const maxValue = this.parsePoint(range, rule.maximum, "max");
            if (minValue === null ||
                maxValue === null ||
                minValue >= maxValue ||
                (midValue && (minValue >= midValue || midValue >= maxValue))) {
                return;
            }
            const zone = toZone(range);
            const activeSheetId = this.getters.getActiveSheetId();
            const computedStyle = this.computedStyles[activeSheetId];
            const colorCellArgs = [];
            if (rule.midpoint && midValue) {
                colorCellArgs.push({
                    minValue,
                    minColor: rule.minimum.color,
                    colorDiffUnit: this.computeColorDiffUnits(minValue, midValue, rule.minimum.color, rule.midpoint.color),
                });
                colorCellArgs.push({
                    minValue: midValue,
                    minColor: rule.midpoint.color,
                    colorDiffUnit: this.computeColorDiffUnits(midValue, maxValue, rule.midpoint.color, rule.maximum.color),
                });
            }
            else {
                colorCellArgs.push({
                    minValue,
                    minColor: rule.minimum.color,
                    colorDiffUnit: this.computeColorDiffUnits(minValue, maxValue, rule.minimum.color, rule.maximum.color),
                });
            }
            for (let row = zone.top; row <= zone.bottom; row++) {
                for (let col = zone.left; col <= zone.right; col++) {
                    const cell = this.getters.getCell(activeSheetId, col, row);
                    let value;
                    if (cell) {
                        switch (cell.type) {
                            case CellType.formula:
                            case CellType.number:
                            case CellType.text:
                                value = cell.value;
                                break;
                            case CellType.empty:
                            case CellType.invalidFormula:
                                continue;
                        }
                        if (!Number.isNaN(Number.parseFloat(value))) {
                            value = clip(value, minValue, maxValue);
                            let color;
                            if (colorCellArgs.length === 2 && midValue) {
                                color =
                                    value <= midValue
                                        ? this.colorCell(value, colorCellArgs[0].minValue, colorCellArgs[0].minColor, colorCellArgs[0].colorDiffUnit)
                                        : this.colorCell(value, colorCellArgs[1].minValue, colorCellArgs[1].minColor, colorCellArgs[1].colorDiffUnit);
                            }
                            else {
                                color = this.colorCell(value, colorCellArgs[0].minValue, colorCellArgs[0].minColor, colorCellArgs[0].colorDiffUnit);
                            }
                            if (!computedStyle[col])
                                computedStyle[col] = [];
                            computedStyle[col][row] = ((_a = computedStyle[col]) === null || _a === void 0 ? void 0 : _a[row]) || {};
                            computedStyle[col][row].fillColor = "#" + colorNumberString(color);
                        }
                    }
                }
            }
        }
        computeColorDiffUnits(minValue, maxValue, minColor, maxColor) {
            const deltaValue = maxValue - minValue;
            const deltaColorR = ((minColor >> 16) % 256) - ((maxColor >> 16) % 256);
            const deltaColorG = ((minColor >> 8) % 256) - ((maxColor >> 8) % 256);
            const deltaColorB = (minColor % 256) - (maxColor % 256);
            const colorDiffUnitR = deltaColorR / deltaValue;
            const colorDiffUnitG = deltaColorG / deltaValue;
            const colorDiffUnitB = deltaColorB / deltaValue;
            return [colorDiffUnitR, colorDiffUnitG, colorDiffUnitB];
        }
        colorCell(value, minValue, minColor, colorDiffUnit) {
            const [colorDiffUnitR, colorDiffUnitG, colorDiffUnitB] = colorDiffUnit;
            const r = Math.round(((minColor >> 16) % 256) - colorDiffUnitR * (value - minValue));
            const g = Math.round(((minColor >> 8) % 256) - colorDiffUnitG * (value - minValue));
            const b = Math.round((minColor % 256) - colorDiffUnitB * (value - minValue));
            return (r << 16) | (g << 8) | b;
        }
        /**
         * Add or remove cells to a given conditional formatting rule.
         */
        adaptRules(sheetId, cf, toAdd, toRemove) {
            if (toAdd.length === 0 && toRemove.length === 0) {
                return;
            }
            const rules = this.getters.getConditionalFormats(sheetId);
            const replaceIndex = rules.findIndex((c) => c.id === cf.id);
            let currentRanges = [];
            if (replaceIndex > -1) {
                currentRanges = rules[replaceIndex].ranges;
            }
            currentRanges = currentRanges.concat(toAdd);
            const newRange = recomputeZones(currentRanges, toRemove);
            this.dispatch("ADD_CONDITIONAL_FORMAT", {
                cf: {
                    id: cf.id,
                    rule: cf.rule,
                    stopIfTrue: cf.stopIfTrue,
                    ranges: newRange,
                },
                sheetId,
            });
        }
        pasteCf(originCol, originRow, col, row, originSheet, destinationSheetId, cut) {
            const xc = toXC(col, row);
            for (let rule of this.getters.getConditionalFormats(originSheet)) {
                for (let range of rule.ranges) {
                    if (isInside(originCol, originRow, toZone(range))) {
                        const cf = rule;
                        const toRemoveRange = [];
                        if (cut) {
                            //remove from current rule
                            toRemoveRange.push(toXC(originCol, originRow));
                        }
                        if (originSheet === destinationSheetId) {
                            this.adaptRules(originSheet, cf, [xc], toRemoveRange);
                        }
                        else {
                            this.adaptRules(destinationSheetId, cf, [xc], []);
                            this.adaptRules(originSheet, cf, [], toRemoveRange);
                        }
                    }
                }
            }
        }
    }
    EvaluationConditionalFormatPlugin.getters = ["getConditionalStyle"];
    EvaluationConditionalFormatPlugin.modes = ["normal", "readonly"];

    const BORDER_COLOR = "#8B008B";
    const BACKGROUND_COLOR = "#8B008B33";
    var Direction;
    (function (Direction) {
        Direction[Direction["previous"] = -1] = "previous";
        Direction[Direction["current"] = 0] = "current";
        Direction[Direction["next"] = 1] = "next";
    })(Direction || (Direction = {}));
    /**
     * Find and Replace Plugin
     *
     * This plugin is used in combination with the find_and_replace sidePanel
     * It is used to 'highlight' cells that match an input string according to
     * the given searchOptions. The second part of this plugin makes it possible
     * (again with the find_and_replace sidePanel), to replace the values that match
     * the search with a new value.
     */
    class FindAndReplacePlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.searchMatches = [];
            this.selectedMatchIndex = null;
            this.currentSearchRegex = null;
            this.searchOptions = {
                matchCase: false,
                exactMatch: false,
                searchFormulas: false,
            };
            this.replaceOptions = {
                modifyFormulas: false,
            };
            this.toSearch = "";
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "UPDATE_SEARCH":
                    this.updateSearch(cmd.toSearch, cmd.searchOptions);
                    break;
                case "CLEAR_SEARCH":
                    this.clearSearch();
                    break;
                case "SELECT_SEARCH_PREVIOUS_MATCH":
                    this.selectNextCell(Direction.previous);
                    break;
                case "SELECT_SEARCH_NEXT_MATCH":
                    this.selectNextCell(Direction.next);
                    break;
                case "REPLACE_SEARCH":
                    this.replace(cmd.replaceWith, cmd.replaceOptions);
                    break;
                case "REPLACE_ALL_SEARCH":
                    this.replaceAll(cmd.replaceWith, cmd.replaceOptions);
                    break;
                case "UNDO":
                case "REDO":
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                case "ADD_COLUMNS":
                case "ADD_ROWS":
                    this.clearSearch();
                    break;
                case "ACTIVATE_SHEET":
                case "REFRESH_SEARCH":
                    this.refreshSearch();
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getSearchMatches() {
            return this.searchMatches;
        }
        getCurrentSelectedMatchIndex() {
            return this.selectedMatchIndex;
        }
        // ---------------------------------------------------------------------------
        // Search
        // ---------------------------------------------------------------------------
        /**
         * Will update the current searchOptions and accordingly update the regex.
         * It will then search for matches using the regex and store them.
         */
        updateSearch(toSearch, searchOptions) {
            this.searchOptions = searchOptions;
            if (toSearch !== this.toSearch) {
                this.selectedMatchIndex = 0;
            }
            this.toSearch = toSearch;
            this.updateRegex();
            this.refreshSearch();
        }
        /**
         * refresh the matches according to the current search options
         */
        refreshSearch() {
            const matches = this.findMatches();
            this.searchMatches = matches;
            this.selectNextCell(Direction.current);
        }
        /**
         * Updates the regex based on the current searchOptions and
         * the value toSearch
         */
        updateRegex() {
            let searchValue = this.toSearch;
            const flags = !this.searchOptions.matchCase ? "i" : "";
            if (this.searchOptions.exactMatch) {
                searchValue = `^${searchValue}$`;
            }
            this.currentSearchRegex = RegExp(searchValue, flags);
        }
        /**
         * Find matches using the current regex
         */
        findMatches() {
            const activeSheetId = this.getters.getActiveSheetId();
            const cells = this.getters.getCells(activeSheetId);
            const matches = [];
            //let field = this.searchOptions.searchFormulas ? "content" : "value";
            if (this.toSearch) {
                for (const cell of Object.values(cells)) {
                    if (cell &&
                        this.currentSearchRegex &&
                        this.currentSearchRegex.test(this.searchOptions.searchFormulas
                            ? cell.type === CellType.formula
                                ? this.getters.getFormulaCellContent(activeSheetId, cell)
                                : String(cell.value)
                            : String(cell.value))) {
                        const position = this.getters.getCellPosition(cell.id);
                        const match = { col: position.col, row: position.row, selected: false };
                        matches.push(match);
                    }
                }
            }
            return matches.sort(this.sortByRowThenColumn);
        }
        sortByRowThenColumn(a, b) {
            if (a.row === b.row) {
                return a.col - b.col;
            }
            return a.row > b.row ? 1 : -1;
        }
        /**
         * Changes the selected search cell. Given a direction it will
         * Change the selection to the previous, current or nextCell,
         * if it exists otherwise it will set the selectedMatchIndex to null.
         * It will also reset the index to 0 if the search has changed.
         * It is also used to keep coherence between the selected searchMatch
         * and selectedMatchIndex.
         */
        selectNextCell(indexChange) {
            const matches = this.searchMatches;
            if (!matches.length) {
                this.selectedMatchIndex = null;
                return;
            }
            let nextIndex;
            if (this.selectedMatchIndex === null) {
                nextIndex = 0;
            }
            else {
                nextIndex = this.selectedMatchIndex + indexChange;
            }
            //modulo of negative value to be able to cycle in both directions with previous and next
            nextIndex = ((nextIndex % matches.length) + matches.length) % matches.length;
            if (this.selectedMatchIndex !== nextIndex) {
                this.selectedMatchIndex = nextIndex;
                this.dispatch("SELECT_CELL", { col: matches[nextIndex].col, row: matches[nextIndex].row });
            }
            for (let index = 0; index < this.searchMatches.length; index++) {
                this.searchMatches[index].selected = index === this.selectedMatchIndex;
            }
        }
        clearSearch() {
            this.toSearch = "";
            this.searchMatches = [];
            this.selectedMatchIndex = null;
            this.currentSearchRegex = null;
            this.searchOptions = {
                matchCase: false,
                exactMatch: false,
                searchFormulas: false,
            };
            this.replaceOptions = {
                modifyFormulas: false,
            };
        }
        // ---------------------------------------------------------------------------
        // Replace
        // ---------------------------------------------------------------------------
        /**
         * Replace the value of the currently selected match if the replaceOptions
         * allow it
         */
        replace(replaceWith, replaceOptions) {
            this.replaceOptions = replaceOptions;
            if (this.selectedMatchIndex === null || !this.currentSearchRegex) {
                return;
            }
            const matches = this.searchMatches;
            const selectedMatch = matches[this.selectedMatchIndex];
            const sheetId = this.getters.getActiveSheetId();
            const cellToReplace = this.getters.getCell(sheetId, selectedMatch.col, selectedMatch.row);
            const toReplace = this.toReplace(cellToReplace, sheetId);
            if (!cellToReplace || !toReplace) {
                this.selectNextCell(Direction.next);
            }
            else {
                const replaceRegex = new RegExp(this.currentSearchRegex.source, this.currentSearchRegex.flags + "g");
                const newContent = toReplace.toString().replace(replaceRegex, replaceWith);
                this.dispatch("UPDATE_CELL", {
                    sheetId: this.getters.getActiveSheetId(),
                    col: selectedMatch.col,
                    row: selectedMatch.row,
                    content: newContent,
                });
                this.searchMatches.splice(this.selectedMatchIndex, 1);
                this.selectNextCell(Direction.current);
            }
        }
        /**
         * Apply the replace function to all the matches one time.
         */
        replaceAll(replaceWith, replaceOptions) {
            const matchCount = this.searchMatches.length;
            for (let i = 0; i < matchCount; i++) {
                this.replace(replaceWith, replaceOptions);
            }
        }
        /**
         * Determines if the content, the value or nothing should be replaced,
         * based on the search and replace options
         */
        toReplace(cell, sheetId) {
            if (cell) {
                if (this.searchOptions.searchFormulas && cell.type === CellType.formula) {
                    return this.getters.getFormulaCellContent(sheetId, cell);
                }
                else if (this.replaceOptions.modifyFormulas || cell.type !== CellType.formula) {
                    return cell.value.toString();
                }
            }
            return null;
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            const { ctx, viewport } = renderingContext;
            const sheetId = this.getters.getActiveSheetId();
            for (const match of this.searchMatches) {
                const merge = this.getters.getMerge(sheetId, match.col, match.row);
                const left = merge ? merge.left : match.col;
                const right = merge ? merge.right : match.col;
                const top = merge ? merge.top : match.row;
                const bottom = merge ? merge.bottom : match.row;
                const [x, y, width, height] = this.getters.getRect({ top, left, right, bottom }, viewport);
                if (width > 0 && height > 0) {
                    ctx.fillStyle = BACKGROUND_COLOR;
                    ctx.fillRect(x, y, width, height);
                    if (match.selected) {
                        ctx.strokeStyle = BORDER_COLOR;
                        ctx.strokeRect(x, y, width, height);
                    }
                }
            }
        }
    }
    FindAndReplacePlugin.layers = [3 /* Search */];
    FindAndReplacePlugin.getters = ["getSearchMatches", "getCurrentSelectedMatchIndex"];

    /**
     * HighlightPlugin
     */
    class HighlightPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.highlights = [];
            this.color = "#000";
            this.highlightSelectionEnabled = false;
            this.pendingHighlights = [];
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "ADD_HIGHLIGHTS":
                    this.addHighlights(cmd.ranges);
                    break;
                case "REMOVE_ALL_HIGHLIGHTS":
                    this.highlights = [];
                    break;
                case "REMOVE_HIGHLIGHTS":
                    this.removeHighlights(cmd.ranges);
                    break;
                case "SELECT_CELL":
                case "SET_SELECTION":
                    if (this.highlightSelectionEnabled) {
                        this.highlightSelection();
                    }
                    break;
                case "START_SELECTION_EXPANSION":
                    this.color = getNextColor();
                    break;
                case "HIGHLIGHT_SELECTION":
                    this.highlightSelectionEnabled = cmd.enabled;
                    if (!cmd.enabled) {
                        this.dispatch("RESET_PENDING_HIGHLIGHT");
                    }
                    break;
                case "RESET_PENDING_HIGHLIGHT":
                    this.pendingHighlights = [];
                    break;
                case "ADD_PENDING_HIGHLIGHTS":
                    this.addPendingHighlight(cmd.ranges);
                    break;
                case "SET_HIGHLIGHT_COLOR":
                    this.color = cmd.color;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getHighlights() {
            return this.highlights;
        }
        // ---------------------------------------------------------------------------
        // Other
        // ---------------------------------------------------------------------------
        addHighlights(ranges) {
            let highlights = this.prepareHighlights(ranges);
            this.highlights = this.highlights.concat(highlights);
        }
        addPendingHighlight(ranges) {
            let highlights = this.prepareHighlights(ranges);
            this.pendingHighlights = this.pendingHighlights.concat(highlights);
        }
        prepareHighlights(ranges) {
            if (Object.keys(ranges).length === 0) {
                return [];
            }
            const activeSheetId = this.getters.getActiveSheetId();
            return Object.keys(ranges)
                .map((r1c1) => {
                const [xc, sheet] = r1c1.split("!").reverse();
                const sheetId = this.getters.getSheetIdByName(sheet) || activeSheetId;
                const zone = this.getters.expandZone(activeSheetId, toZone(xc));
                return { zone, color: ranges[r1c1], sheet: sheetId };
            })
                .filter((x) => x.zone.top >= 0 &&
                x.zone.left >= 0 &&
                x.zone.bottom < this.getters.getSheet(x.sheet).rows.length &&
                x.zone.right < this.getters.getSheet(x.sheet).cols.length);
        }
        /**
         *
         * @param ranges {"[sheet!]XC": color}
         * @private
         */
        removeHighlights(ranges) {
            const activeSheetId = this.getters.getActiveSheetId();
            const rangesBySheets = {};
            for (let [range, color] of Object.entries(ranges)) {
                const [xc, sheetName] = range.split("!").reverse();
                const sheetId = this.getters.getSheetIdByName(sheetName);
                rangesBySheets[sheetId || activeSheetId] = Object.assign({ [xc]: color }, rangesBySheets[sheetId || activeSheetId] || {});
            }
            const shouldBeKept = (highlight) => !(rangesBySheets[highlight.sheet] &&
                rangesBySheets[highlight.sheet][this.getters.zoneToXC(activeSheetId, highlight.zone)] ===
                    highlight.color);
            this.highlights = this.highlights.filter(shouldBeKept);
        }
        /**
         * Highlight selected zones (which are not already highlighted).
         */
        highlightSelection() {
            this.removePendingHighlights();
            const zones = this.getters.getSelectedZones().filter((z) => !this.isHighlighted(z));
            const ranges = {};
            let color = this.color;
            const activeSheetId = this.getters.getActiveSheetId();
            for (const zone of zones) {
                ranges[this.getters.zoneToXC(activeSheetId, zone)] = color;
                color = getNextColor();
            }
            this.dispatch("ADD_HIGHLIGHTS", { ranges });
            this.dispatch("ADD_PENDING_HIGHLIGHTS", { ranges });
        }
        isHighlighted(zone) {
            return !!this.highlights.find((h) => isEqual(h.zone, zone));
        }
        /**
         * Remove pending highlights which are not selected.
         * Highlighted zones which are selected are still considered
         * pending.
         */
        removePendingHighlights() {
            const ranges = {};
            const [selected, notSelected] = this.pendingHighlights.reduce(([y, n], highlight) => this.getters.isSelected(highlight.zone) ? [[...y, highlight], n] : [y, [...n, highlight]], [[], []]);
            const activeSheetId = this.getters.getActiveSheetId();
            for (const { zone, color } of notSelected) {
                ranges[this.getters.zoneToXC(activeSheetId, zone)] = color;
            }
            this.dispatch("REMOVE_HIGHLIGHTS", { ranges });
            this.pendingHighlights = selected;
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            // rendering selection highlights
            const { ctx, viewport, thinLineWidth } = renderingContext;
            const sheetId = this.getters.getActiveSheetId();
            const lineWidth = 3 * thinLineWidth;
            ctx.lineWidth = lineWidth;
            for (let h of this.highlights.filter((highlight) => highlight.sheet === sheetId)) {
                const [x, y, width, height] = this.getters.getRect(h.zone, viewport);
                if (width > 0 && height > 0) {
                    ctx.strokeStyle = h.color;
                    ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, width - lineWidth, height - lineWidth);
                    ctx.globalCompositeOperation = "source-over";
                    ctx.fillStyle = h.color + "20";
                    ctx.fillRect(x + lineWidth, y + lineWidth, width - 2 * lineWidth, height - 2 * lineWidth);
                }
            }
        }
    }
    HighlightPlugin.modes = ["normal", "readonly"];
    HighlightPlugin.layers = [1 /* Highlights */];
    HighlightPlugin.getters = ["getHighlights"];

    // -----------------------------------------------------------------------------
    // Constants, types, helpers, ...
    // -----------------------------------------------------------------------------
    function computeAlign(cell, isShowingFormulas) {
        if (cell.type === CellType.formula && isShowingFormulas) {
            return "left";
        }
        else if (cell.error) {
            return "center";
        }
        switch (typeof cell.value) {
            case "object":
            case "number":
                return "right";
            case "boolean":
                return "center";
            default:
                return "left";
        }
    }
    function searchIndex(headers, offset) {
        let left = 0;
        let right = headers.length - 1;
        while (left <= right) {
            const index = Math.floor((left + right) / 2);
            const header = headers[index];
            if (offset < header.start) {
                right = index - 1;
            }
            else if (offset > header.end) {
                left = index + 1;
            }
            else {
                return index;
            }
        }
        return -1;
    }
    class RendererPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.boxes = [];
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Return the index of a column given an offset x and a visible left col index.
         * It returns -1 if no column is found.
         */
        getColIndex(x, left) {
            if (x < HEADER_WIDTH) {
                return -1;
            }
            const cols = this.getters.getActiveSheet().cols;
            const adjustedX = x - HEADER_WIDTH + cols[left].start + 1;
            return searchIndex(cols, adjustedX);
        }
        getRowIndex(y, top) {
            if (y < HEADER_HEIGHT) {
                return -1;
            }
            const rows = this.getters.getActiveSheet().rows;
            const adjustedY = y - HEADER_HEIGHT + rows[top].start + 1;
            return searchIndex(rows, adjustedY);
        }
        getRect(zone, viewport) {
            const { left, top, right, bottom } = zone;
            let { offsetY, offsetX } = viewport;
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            const { cols, rows } = this.getters.getActiveSheet();
            const x = Math.max(cols[left].start - offsetX, HEADER_WIDTH);
            const width = cols[right].end - offsetX - x;
            const y = Math.max(rows[top].start - offsetY, HEADER_HEIGHT);
            const height = rows[bottom].end - offsetY - y;
            return [x, y, width, height];
        }
        /**
         * Snap a viewport boundaries to exactly match the start of a cell.
         * @param viewport
         */
        snapViewportToCell(viewport) {
            const { cols, rows } = this.getters.getActiveSheet();
            const adjustedViewport = Object.assign({}, viewport);
            adjustedViewport.offsetX = cols[viewport.left].start;
            adjustedViewport.offsetY = rows[viewport.top].start;
            return adjustedViewport;
        }
        /**
         * Adjust the viewport until the active cell is completely visible inside it.
         * @param viewport the viewport that will be adjusted
         */
        adjustViewportPosition(viewport) {
            const adjustedViewport = Object.assign({}, viewport);
            const { cols, rows, id: sheetId } = this.getters.getActiveSheet();
            const [col, row] = this.getters.getMainCell(sheetId, ...this.getters.getPosition());
            while (col >= adjustedViewport.right && col !== cols.length - 1) {
                adjustedViewport.offsetX = cols[adjustedViewport.left].end;
                this.adjustViewportZoneX(adjustedViewport);
            }
            while (col < adjustedViewport.left) {
                adjustedViewport.offsetX = cols[adjustedViewport.left - 1].start;
                this.adjustViewportZoneX(adjustedViewport);
            }
            while (row >= adjustedViewport.bottom && row !== rows.length - 1) {
                adjustedViewport.offsetY = rows[adjustedViewport.top].end;
                this.adjustViewportZoneY(adjustedViewport);
            }
            while (row < adjustedViewport.top) {
                adjustedViewport.offsetY = rows[adjustedViewport.top - 1].start;
                this.adjustViewportZoneY(adjustedViewport);
            }
            return adjustedViewport;
        }
        adjustViewportZone(viewport) {
            const adjustedViewport = Object.assign({}, viewport);
            this.adjustViewportZoneX(adjustedViewport);
            this.adjustViewportZoneY(adjustedViewport);
            return adjustedViewport;
        }
        adjustViewportZoneX(viewport) {
            const { cols } = this.getters.getActiveSheet();
            const { width, offsetX } = viewport;
            viewport.left = this.getColIndex(offsetX + HEADER_WIDTH, 0);
            const x = width + offsetX - HEADER_WIDTH;
            viewport.right = cols.length - 1;
            for (let i = viewport.left; i < cols.length; i++) {
                if (x < cols[i].end) {
                    viewport.right = i;
                    break;
                }
            }
        }
        adjustViewportZoneY(viewport) {
            const { rows } = this.getters.getActiveSheet();
            const { height, offsetY } = viewport;
            viewport.top = this.getRowIndex(offsetY + HEADER_HEIGHT, 0);
            let y = height + offsetY - HEADER_HEIGHT;
            viewport.bottom = rows.length - 1;
            for (let i = viewport.top; i < rows.length; i++) {
                if (y < rows[i].end) {
                    viewport.bottom = i;
                    break;
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext, layer) {
            switch (layer) {
                case 0 /* Background */:
                    this.boxes = this.getGridBoxes(renderingContext);
                    this.drawBackground(renderingContext);
                    this.drawCellBackground(renderingContext);
                    this.drawBorders(renderingContext);
                    this.drawTexts(renderingContext);
                    break;
                case 7 /* Headers */:
                    this.drawHeaders(renderingContext);
                    break;
            }
        }
        drawBackground(renderingContext) {
            const { ctx, viewport, thinLineWidth } = renderingContext;
            let { width, height, offsetX, offsetY, top, left, bottom, right } = viewport;
            const { cols, rows } = this.getters.getActiveSheet();
            // white background
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, viewport.width, viewport.height);
            // background grid
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            ctx.lineWidth = 2 * thinLineWidth;
            ctx.strokeStyle = CELL_BORDER_COLOR;
            ctx.beginPath();
            // vertical lines
            const lineHeight = Math.min(height, rows[bottom].end - offsetY);
            for (let i = left; i <= right; i++) {
                const x = cols[i].end - offsetX;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, lineHeight);
            }
            // horizontal lines
            const lineWidth = Math.min(width, cols[right].end - offsetX);
            for (let i = top; i <= bottom; i++) {
                const y = rows[i].end - offsetY;
                ctx.moveTo(0, y);
                ctx.lineTo(lineWidth, y);
            }
            ctx.stroke();
        }
        drawCellBackground(renderingContext) {
            const { ctx, thinLineWidth } = renderingContext;
            ctx.lineWidth = 0.3 * thinLineWidth;
            const inset = 0.1 * thinLineWidth;
            ctx.strokeStyle = "#111";
            for (let box of this.boxes) {
                // fill color
                let style = box.style;
                if (style && style.fillColor && style.fillColor !== "#ffffff") {
                    ctx.fillStyle = style.fillColor;
                    ctx.fillRect(box.x, box.y, box.width, box.height);
                    ctx.strokeRect(box.x + inset, box.y + inset, box.width - 2 * inset, box.height - 2 * inset);
                }
                if (box.error) {
                    ctx.fillStyle = "red";
                    ctx.beginPath();
                    ctx.moveTo(box.x + box.width - 5, box.y);
                    ctx.lineTo(box.x + box.width, box.y);
                    ctx.lineTo(box.x + box.width, box.y + 5);
                    ctx.fill();
                }
            }
        }
        drawBorders(renderingContext) {
            const { ctx, thinLineWidth } = renderingContext;
            for (let box of this.boxes) {
                // fill color
                let border = box.border;
                if (border) {
                    const { x, y, width, height } = box;
                    if (border.left) {
                        drawBorder(border.left, x, y, x, y + height);
                    }
                    if (border.top) {
                        drawBorder(border.top, x, y, x + width, y);
                    }
                    if (border.right) {
                        drawBorder(border.right, x + width, y, x + width, y + height);
                    }
                    if (border.bottom) {
                        drawBorder(border.bottom, x, y + height, x + width, y + height);
                    }
                }
            }
            function drawBorder([style, color], x1, y1, x2, y2) {
                ctx.strokeStyle = color;
                ctx.lineWidth = (style === "thin" ? 2 : 3) * thinLineWidth;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
        drawTexts(renderingContext) {
            const { ctx, thinLineWidth } = renderingContext;
            ctx.textBaseline = "middle";
            let currentFont;
            for (let box of this.boxes) {
                if (box.text) {
                    const style = box.style || {};
                    const align = box.align;
                    const italic = style.italic ? "italic " : "";
                    const weight = style.bold ? "bold" : DEFAULT_FONT_WEIGHT;
                    const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
                    const size = fontSizeMap[sizeInPt];
                    const font = `${italic}${weight} ${size}px ${DEFAULT_FONT}`;
                    if (font !== currentFont) {
                        currentFont = font;
                        ctx.font = font;
                    }
                    ctx.fillStyle = style.textColor || "#000";
                    let x;
                    let y = box.y + box.height / 2 + 1;
                    if (align === "left") {
                        x = box.x + 3;
                    }
                    else if (align === "right") {
                        x = box.x + box.width - 3;
                    }
                    else {
                        x = box.x + box.width / 2;
                    }
                    ctx.textAlign = align;
                    if (box.clipRect) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(...box.clipRect);
                        ctx.clip();
                    }
                    ctx.fillText(box.text, Math.round(x), Math.round(y));
                    if (style.strikethrough) {
                        if (align === "right") {
                            x = x - box.textWidth;
                        }
                        else if (align === "center") {
                            x = x - box.textWidth / 2;
                        }
                        ctx.fillRect(x, y, box.textWidth, 2.6 * thinLineWidth);
                    }
                    if (box.clipRect) {
                        ctx.restore();
                    }
                }
            }
        }
        drawHeaders(renderingContext) {
            const { ctx, viewport, thinLineWidth } = renderingContext;
            let { width, height, offsetX, offsetY, left, top, right, bottom } = viewport;
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            const selection = this.getters.getSelectedZones();
            const { cols, rows } = this.getters.getActiveSheet();
            const activeCols = this.getters.getActiveCols();
            const activeRows = this.getters.getActiveRows();
            ctx.fillStyle = BACKGROUND_HEADER_COLOR;
            ctx.font = `400 ${HEADER_FONT_SIZE}px ${DEFAULT_FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = thinLineWidth;
            ctx.strokeStyle = "#333";
            // background
            ctx.fillRect(0, 0, width, HEADER_HEIGHT);
            ctx.fillRect(0, 0, HEADER_WIDTH, height);
            // selection background
            ctx.fillStyle = BACKGROUND_HEADER_SELECTED_COLOR;
            for (let zone of selection) {
                const x1 = Math.max(HEADER_WIDTH, cols[zone.left].start - offsetX);
                const x2 = Math.max(HEADER_WIDTH, cols[zone.right].end - offsetX);
                const y1 = Math.max(HEADER_HEIGHT, rows[zone.top].start - offsetY);
                const y2 = Math.max(HEADER_HEIGHT, rows[zone.bottom].end - offsetY);
                ctx.fillStyle = activeCols.has(zone.left)
                    ? BACKGROUND_HEADER_ACTIVE_COLOR
                    : BACKGROUND_HEADER_SELECTED_COLOR;
                ctx.fillRect(x1, 0, x2 - x1, HEADER_HEIGHT);
                ctx.fillStyle = activeRows.has(zone.top)
                    ? BACKGROUND_HEADER_ACTIVE_COLOR
                    : BACKGROUND_HEADER_SELECTED_COLOR;
                ctx.fillRect(0, y1, HEADER_WIDTH, y2 - y1);
            }
            // 2 main lines
            ctx.beginPath();
            ctx.moveTo(HEADER_WIDTH, 0);
            ctx.lineTo(HEADER_WIDTH, height);
            ctx.moveTo(0, HEADER_HEIGHT);
            ctx.lineTo(width, HEADER_HEIGHT);
            ctx.strokeStyle = HEADER_BORDER_COLOR;
            ctx.stroke();
            ctx.beginPath();
            // column text + separator
            for (let i = left; i <= right; i++) {
                const col = cols[i];
                ctx.fillStyle = activeCols.has(i) ? "#fff" : TEXT_HEADER_COLOR;
                ctx.fillText(col.name, (col.start + col.end) / 2 - offsetX, HEADER_HEIGHT / 2);
                ctx.moveTo(col.end - offsetX, 0);
                ctx.lineTo(col.end - offsetX, HEADER_HEIGHT);
            }
            // row text + separator
            for (let i = top; i <= bottom; i++) {
                const row = rows[i];
                ctx.fillStyle = activeRows.has(i) ? "#fff" : TEXT_HEADER_COLOR;
                ctx.fillText(row.name, HEADER_WIDTH / 2, (row.start + row.end) / 2 - offsetY);
                ctx.moveTo(0, row.end - offsetY);
                ctx.lineTo(HEADER_WIDTH, row.end - offsetY);
            }
            ctx.stroke();
        }
        hasContent(col, row) {
            const sheetId = this.getters.getActiveSheetId();
            const cell = this.getters.getCell(sheetId, col, row);
            return (cell && cell.type !== "empty") || this.getters.isInMerge(sheetId, col, row);
        }
        getGridBoxes(renderingContext) {
            const { viewport } = renderingContext;
            let { right, left, top, bottom, offsetX, offsetY } = viewport;
            offsetX -= HEADER_WIDTH;
            offsetY -= HEADER_HEIGHT;
            const showFormula = this.getters.shouldShowFormulas();
            const result = [];
            const { cols, rows, id: sheetId } = this.getters.getActiveSheet();
            // process all visible cells
            for (let rowNumber = top; rowNumber <= bottom; rowNumber++) {
                const row = rows[rowNumber];
                for (let colNumber = left; colNumber <= right; colNumber++) {
                    let cell = row.cells[colNumber];
                    const border = this.getters.getCellBorder(sheetId, colNumber, rowNumber);
                    const col = cols[colNumber];
                    const conditionalStyle = this.getters.getConditionalStyle(colNumber, rowNumber);
                    if (!this.getters.isInMerge(sheetId, colNumber, rowNumber)) {
                        if (cell) {
                            const text = this.getters.getCellText(cell, sheetId, showFormula);
                            const textWidth = this.getters.getCellWidth(cell);
                            let style = this.getters.getCellStyle(cell);
                            if (conditionalStyle) {
                                style = Object.assign({}, style, conditionalStyle);
                            }
                            const align = text
                                ? (style && style.align) || computeAlign(cell, showFormula)
                                : undefined;
                            let clipRect = null;
                            if (text && textWidth > cols[colNumber].size) {
                                if (align === "left") {
                                    let c = colNumber;
                                    while (c < right && !this.hasContent(c + 1, rowNumber)) {
                                        c++;
                                    }
                                    const width = cols[c].end - col.start;
                                    if (width < textWidth) {
                                        clipRect = [col.start - offsetX, row.start - offsetY, width, row.size];
                                    }
                                }
                                else {
                                    let c = colNumber;
                                    while (c > left && !this.hasContent(c - 1, rowNumber)) {
                                        c--;
                                    }
                                    const width = col.end - cols[c].start;
                                    if (width < textWidth) {
                                        clipRect = [cols[c].start - offsetX, row.start - offsetY, width, row.size];
                                    }
                                }
                            }
                            result.push({
                                x: col.start - offsetX,
                                y: row.start - offsetY,
                                width: col.size,
                                height: row.size,
                                text,
                                textWidth,
                                border,
                                style,
                                align,
                                clipRect,
                                error: cell.error,
                            });
                        }
                        else {
                            result.push({
                                x: col.start - offsetX,
                                y: row.start - offsetY,
                                width: col.size,
                                height: row.size,
                                text: "",
                                textWidth: 0,
                                border,
                                style: conditionalStyle ? conditionalStyle : null,
                                align: undefined,
                                clipRect: null,
                                error: undefined,
                            });
                        }
                    }
                }
            }
            const activeSheetId = this.getters.getActiveSheetId();
            // process all visible merges
            for (let merge of this.getters.getMerges(activeSheetId)) {
                if (overlap(merge, viewport)) {
                    const refCell = this.getters.getCell(activeSheetId, merge.left, merge.top);
                    const borderTopLeft = this.getters.getCellBorder(activeSheetId, merge.left, merge.top);
                    const borderBottomRight = this.getters.getCellBorder(activeSheetId, merge.right + 1, merge.bottom + 1);
                    const width = cols[merge.right].end - cols[merge.left].start;
                    let text, textWidth, style, align, border;
                    style = refCell ? this.getters.getCellStyle(refCell) : null;
                    if (refCell || borderBottomRight || borderTopLeft) {
                        text = refCell ? this.getters.getCellText(refCell, activeSheetId, showFormula) : "";
                        textWidth = refCell ? this.getters.getCellWidth(refCell) : null;
                        const conditionalStyle = this.getters.getConditionalStyle(merge.topLeft.col, merge.topLeft.row);
                        if (conditionalStyle) {
                            style = Object.assign({}, style, conditionalStyle);
                        }
                        align = text ? (style && style.align) || computeAlign(refCell, showFormula) : null;
                        border = {
                            bottom: borderBottomRight ? borderBottomRight.bottom : null,
                            left: borderTopLeft ? borderTopLeft.left : null,
                            right: borderBottomRight ? borderBottomRight.right : null,
                            top: borderTopLeft ? borderTopLeft.top : null,
                        };
                    }
                    style = style || {};
                    // Small trick: the code that draw the background color skips the color
                    // #ffffff.  But for merges, we actually need to draw the background,
                    // otherwise the grid is visible. So, we change the #ffffff color to the
                    // color #fff, which is actually the same.
                    if (!style.fillColor || style.fillColor === "#ffffff") {
                        style = Object.create(style);
                        style.fillColor = "#fff";
                    }
                    const x = cols[merge.left].start - offsetX;
                    const y = rows[merge.top].start - offsetY;
                    const height = rows[merge.bottom].end - rows[merge.top].start;
                    result.push({
                        x: x,
                        y: y,
                        width,
                        height,
                        text,
                        textWidth,
                        border,
                        style,
                        align,
                        clipRect: [x, y, width, height],
                        error: refCell ? refCell.error : undefined,
                    });
                }
            }
            return result;
        }
    }
    RendererPlugin.layers = [0 /* Background */, 7 /* Headers */];
    RendererPlugin.getters = [
        "getColIndex",
        "getRowIndex",
        "getRect",
        "snapViewportToCell",
        "adjustViewportPosition",
        "adjustViewportZone",
    ];
    RendererPlugin.modes = ["normal", "readonly"];

    var SelectionMode;
    (function (SelectionMode) {
        SelectionMode[SelectionMode["idle"] = 0] = "idle";
        SelectionMode[SelectionMode["selecting"] = 1] = "selecting";
        SelectionMode[SelectionMode["readyToExpand"] = 2] = "readyToExpand";
        SelectionMode[SelectionMode["expanding"] = 3] = "expanding";
    })(SelectionMode || (SelectionMode = {}));
    /**
     * SelectionPlugin
     */
    class SelectionPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.selection = {
                zones: [{ top: 0, left: 0, bottom: 0, right: 0 }],
                anchor: [0, 0],
            };
            this.activeCol = 0;
            this.activeRow = 0;
            this.mode = SelectionMode.idle;
            this.sheetsData = {};
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "MOVE_POSITION": {
                    const [refCol, refRow] = this.getReferenceCoords();
                    const { cols, rows, id: sheetId } = this.getters.getActiveSheet();
                    let targetCol = refCol;
                    let targetRow = refRow;
                    if (this.getters.isInMerge(sheetId, refCol, refRow)) {
                        while (this.getters.isInSameMerge(sheetId, refCol, refRow, targetCol + cmd.deltaX, targetRow + cmd.deltaY)) {
                            targetCol += cmd.deltaX;
                            targetRow += cmd.deltaY;
                        }
                    }
                    const outOfBound = (cmd.deltaY < 0 && targetRow === 0) ||
                        (cmd.deltaY > 0 && targetRow === rows.length - 1) ||
                        (cmd.deltaX < 0 && targetCol === 0) ||
                        (cmd.deltaX > 0 && targetCol === cols.length - 1);
                    if (outOfBound) {
                        return {
                            status: "CANCELLED",
                            reason: 11 /* SelectionOutOfBound */,
                        };
                    }
                    break;
                }
                case "SELECT_COLUMN": {
                    const { index } = cmd;
                    if (index < 0 || index >= this.getters.getActiveSheet().cols.length) {
                        return {
                            status: "CANCELLED",
                            reason: 11 /* SelectionOutOfBound */,
                        };
                    }
                    break;
                }
                case "SELECT_ROW": {
                    const { index } = cmd;
                    if (index < 0 || index >= this.getters.getActiveSheet().rows.length) {
                        return {
                            status: "CANCELLED",
                            reason: 11 /* SelectionOutOfBound */,
                        };
                    }
                    break;
                }
            }
            return {
                status: "SUCCESS",
            };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "START":
                    this.selectCell(0, 0);
                    break;
                case "ACTIVATE_SHEET":
                    this.sheetsData[cmd.sheetIdFrom] = {
                        selection: JSON.parse(JSON.stringify(this.selection)),
                        activeCol: this.activeCol,
                        activeRow: this.activeRow,
                    };
                    if (cmd.sheetIdTo in this.sheetsData) {
                        Object.assign(this, this.sheetsData[cmd.sheetIdTo]);
                    }
                    else {
                        this.selectCell(0, 0);
                    }
                    break;
                case "SET_SELECTION":
                    this.setSelection(cmd.anchor, cmd.zones, cmd.strict);
                    break;
                case "START_SELECTION":
                    this.mode = SelectionMode.selecting;
                    break;
                case "PREPARE_SELECTION_EXPANSION":
                    this.mode = SelectionMode.readyToExpand;
                    break;
                case "START_SELECTION_EXPANSION":
                    this.mode = SelectionMode.expanding;
                    break;
                case "STOP_SELECTION":
                    this.mode = SelectionMode.idle;
                    break;
                case "MOVE_POSITION":
                    this.movePosition(cmd.deltaX, cmd.deltaY);
                    break;
                case "SELECT_CELL":
                    this.selectCell(cmd.col, cmd.row);
                    break;
                case "SELECT_COLUMN":
                    this.selectColumn(cmd.index, cmd.createRange || false, cmd.updateRange || false);
                    break;
                case "SELECT_ROW":
                    this.selectRow(cmd.index, cmd.createRange || false, cmd.updateRange || false);
                    break;
                case "SELECT_ALL":
                    this.selectAll();
                    break;
                case "ALTER_SELECTION":
                    if (cmd.delta) {
                        this.moveSelection(cmd.delta[0], cmd.delta[1]);
                    }
                    if (cmd.cell) {
                        this.addCellToSelection(...cmd.cell);
                    }
                    break;
                case "UNDO":
                case "REDO":
                case "REMOVE_COLUMNS":
                case "REMOVE_ROWS":
                    this.updateSelection();
                    break;
                case "ADD_COLUMNS":
                    if (cmd.position === "before") {
                        this.onAddColumns(cmd.quantity);
                    }
                    break;
                case "ADD_ROWS":
                    if (cmd.position === "before") {
                        this.onAddRows(cmd.quantity);
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getActiveCell() {
            const sheetId = this.getters.getActiveSheetId();
            const [mainCol, mainRow] = this.getters.getMainCell(sheetId, this.activeCol, this.activeRow);
            return this.getters.getCell(sheetId, mainCol, mainRow);
        }
        getActiveCols() {
            const activeCols = new Set();
            for (let zone of this.selection.zones) {
                if (zone.top === 0 && zone.bottom === this.getters.getActiveSheet().rows.length - 1) {
                    for (let i = zone.left; i <= zone.right; i++) {
                        activeCols.add(i);
                    }
                }
            }
            return activeCols;
        }
        getActiveRows() {
            const activeRows = new Set();
            for (let zone of this.selection.zones) {
                if (zone.left === 0 && zone.right === this.getters.getActiveSheet().cols.length - 1) {
                    for (let i = zone.top; i <= zone.bottom; i++) {
                        activeRows.add(i);
                    }
                }
            }
            return activeRows;
        }
        getCurrentStyle() {
            const cell = this.getters.getActiveCell();
            return cell ? this.getters.getCellStyle(cell) : {};
        }
        getSelectedZones() {
            return this.selection.zones;
        }
        getSelectedZone() {
            return this.selection.zones[this.selection.zones.length - 1];
        }
        getSelection() {
            return this.selection;
        }
        getPosition() {
            return [this.activeCol, this.activeRow];
        }
        getAggregate() {
            let aggregate = 0;
            let n = 0;
            for (let zone of this.selection.zones) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    const r = this.getters.getRow(this.getters.getActiveSheetId(), row);
                    if (r === undefined)
                        continue;
                    for (let col = zone.left; col <= zone.right; col++) {
                        const cell = r.cells[col];
                        if (cell && cell.type !== "text" && !cell.error && typeof cell.value === "number") {
                            n++;
                            aggregate += cell.value;
                        }
                    }
                }
            }
            return n < 2 ? null : formatStandardNumber(aggregate);
        }
        getSelectionMode() {
            return this.mode;
        }
        isSelected(zone) {
            return !!this.getters.getSelectedZones().find((z) => isEqual(z, zone));
        }
        // ---------------------------------------------------------------------------
        // Other
        // ---------------------------------------------------------------------------
        /**
         * Return [col, row]
         */
        getReferenceCoords() {
            const isSelectingRange = this.getters.isSelectingForComposer();
            return isSelectingRange ? this.selection.anchor : [this.activeCol, this.activeRow];
        }
        selectColumn(index, createRange, updateRange) {
            const bottom = this.getters.getActiveSheet().rows.length - 1;
            const zone = { left: index, right: index, top: 0, bottom };
            const current = this.selection.zones;
            let zones, anchor;
            if (updateRange) {
                const [col, row] = this.selection.anchor;
                const updatedZone = union(zone, { left: col, right: col, top: 0, bottom });
                zones = current.slice(0, -1).concat(updatedZone);
                anchor = [col, row];
            }
            else {
                zones = createRange ? current.concat(zone) : [zone];
                anchor = [index, 0];
            }
            this.dispatch("SET_SELECTION", { zones, anchor, strict: true });
        }
        selectRow(index, createRange, updateRange) {
            const right = this.getters.getActiveSheet().cols.length - 1;
            const zone = { top: index, bottom: index, left: 0, right };
            const current = this.selection.zones;
            let zones, anchor;
            if (updateRange) {
                const [col, row] = this.selection.anchor;
                const updatedZone = union(zone, { left: 0, right, top: row, bottom: row });
                zones = current.slice(0, -1).concat(updatedZone);
                anchor = [col, row];
            }
            else {
                zones = createRange ? current.concat(zone) : [zone];
                anchor = [0, index];
            }
            this.dispatch("SET_SELECTION", { zones, anchor, strict: true });
        }
        selectAll() {
            const bottom = this.getters.getActiveSheet().rows.length - 1;
            const right = this.getters.getActiveSheet().cols.length - 1;
            const zone = { left: 0, top: 0, bottom, right };
            this.dispatch("SET_SELECTION", { zones: [zone], anchor: [0, 0] });
        }
        /**
         * Change the anchor of the selection active cell to an absolute col and row index.
         *
         * This is a non trivial task. We need to stop the editing process and update
         * properly the current selection.  Also, this method can optionally create a new
         * range in the selection.
         */
        selectCell(col, row) {
            const sheetId = this.getters.getActiveSheetId();
            let zone = this.getters.expandZone(sheetId, { left: col, right: col, top: row, bottom: row });
            if (this.mode === SelectionMode.expanding) {
                this.selection.zones.push(zone);
            }
            else {
                this.selection.zones = [zone];
            }
            this.selection.anchor = [col, row];
            if (!this.getters.isSelectingForComposer()) {
                this.activeCol = col;
                this.activeRow = row;
            }
        }
        /**
         * Moves the position of either the active cell of the anchor of the current selection by a number of rows / cols delta
         */
        movePosition(deltaX, deltaY) {
            const [refCol, refRow] = this.getReferenceCoords();
            const sheetId = this.getters.getActiveSheetId();
            if (this.getters.isInMerge(sheetId, refCol, refRow)) {
                let targetCol = refCol;
                let targetRow = refRow;
                while (this.getters.isInSameMerge(sheetId, refCol, refRow, targetCol, targetRow)) {
                    targetCol += deltaX;
                    targetRow += deltaY;
                }
                if (targetCol >= 0 && targetRow >= 0) {
                    this.selectCell(targetCol, targetRow);
                }
            }
            else {
                this.selectCell(refCol + deltaX, refRow + deltaY);
            }
        }
        setSelection(anchor, zones, strict = false) {
            this.selectCell(...anchor);
            if (strict) {
                this.selection.zones = zones;
            }
            else {
                const sheetId = this.getters.getActiveSheetId();
                this.selection.zones = zones.map((zone) => this.getters.expandZone(sheetId, zone));
            }
            this.selection.anchor = anchor;
        }
        moveSelection(deltaX, deltaY) {
            const selection = this.selection;
            const zones = selection.zones.slice();
            const lastZone = zones[selection.zones.length - 1];
            const [anchorCol, anchorRow] = selection.anchor;
            const { left, right, top, bottom } = lastZone;
            let result = lastZone;
            const activeSheet = this.getters.getActiveSheet();
            const expand = (z) => {
                const { left, right, top, bottom } = this.getters.expandZone(activeSheet.id, z);
                return {
                    left: Math.max(0, left),
                    right: Math.min(activeSheet.cols.length - 1, right),
                    top: Math.max(0, top),
                    bottom: Math.min(activeSheet.rows.length - 1, bottom),
                };
            };
            // check if we can shrink selection
            let n = 0;
            while (result !== null) {
                n++;
                if (deltaX < 0) {
                    result = anchorCol <= right - n ? expand({ top, left, bottom, right: right - n }) : null;
                }
                if (deltaX > 0) {
                    result = left + n <= anchorCol ? expand({ top, left: left + n, bottom, right }) : null;
                }
                if (deltaY < 0) {
                    result = anchorRow <= bottom - n ? expand({ top, left, bottom: bottom - n, right }) : null;
                }
                if (deltaY > 0) {
                    result = top + n <= anchorRow ? expand({ top: top + n, left, bottom, right }) : null;
                }
                if (result && !isEqual(result, lastZone)) {
                    zones[zones.length - 1] = result;
                    this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
                    return;
                }
            }
            const currentZone = { top: anchorRow, bottom: anchorRow, left: anchorCol, right: anchorCol };
            const zoneWithDelta = {
                top: top + deltaY,
                left: left + deltaX,
                bottom: bottom + deltaY,
                right: right + deltaX,
            };
            result = expand(union(currentZone, zoneWithDelta));
            if (!isEqual(result, lastZone)) {
                zones[zones.length - 1] = result;
                this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
            }
        }
        addCellToSelection(col, row) {
            const selection = this.selection;
            const [anchorCol, anchorRow] = selection.anchor;
            const zone = {
                left: Math.min(anchorCol, col),
                top: Math.min(anchorRow, row),
                right: Math.max(anchorCol, col),
                bottom: Math.max(anchorRow, row),
            };
            const zones = selection.zones.slice(0, -1).concat(zone);
            this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
        }
        updateSelection() {
            const activeSheet = this.getters.getActiveSheet();
            const cols = activeSheet.cols.length - 1;
            const rows = activeSheet.rows.length - 1;
            const zones = this.selection.zones.map((z) => ({
                left: clip(z.left, 0, cols),
                right: clip(z.right, 0, cols),
                top: clip(z.top, 0, rows),
                bottom: clip(z.bottom, 0, rows),
            }));
            const anchorCol = zones[zones.length - 1].left;
            const anchorRow = zones[zones.length - 1].top;
            this.dispatch("SET_SELECTION", { zones, anchor: [anchorCol, anchorRow] });
        }
        onAddColumns(quantity) {
            const selection = this.getSelectedZone();
            const zone = {
                left: selection.left + quantity,
                right: selection.right + quantity,
                top: selection.top,
                bottom: selection.bottom,
            };
            this.dispatch("SET_SELECTION", { zones: [zone], anchor: [zone.left, zone.top], strict: true });
        }
        onAddRows(quantity) {
            const selection = this.getSelectedZone();
            const zone = {
                left: selection.left,
                right: selection.right,
                top: selection.top + quantity,
                bottom: selection.bottom + quantity,
            };
            this.dispatch("SET_SELECTION", { zones: [zone], anchor: [zone.left, zone.top], strict: true });
        }
        // ---------------------------------------------------------------------------
        // Grid rendering
        // ---------------------------------------------------------------------------
        drawGrid(renderingContext) {
            const { viewport, ctx, thinLineWidth } = renderingContext;
            // selection
            const zones = this.getSelectedZones();
            ctx.fillStyle = "#f3f7fe";
            const onlyOneCell = zones.length === 1 && zones[0].left === zones[0].right && zones[0].top === zones[0].bottom;
            ctx.fillStyle = onlyOneCell ? "#f3f7fe" : "#e9f0ff";
            ctx.strokeStyle = SELECTION_BORDER_COLOR;
            ctx.lineWidth = 1.5 * thinLineWidth;
            ctx.globalCompositeOperation = "multiply";
            for (const zone of zones) {
                const [x, y, width, height] = this.getters.getRect(zone, viewport);
                if (width > 0 && height > 0) {
                    ctx.fillRect(x, y, width, height);
                    ctx.strokeRect(x, y, width, height);
                }
            }
            ctx.globalCompositeOperation = "source-over";
            // active zone
            const activeSheet = this.getters.getActiveSheetId();
            const [col, row] = this.getPosition();
            ctx.strokeStyle = "#3266ca";
            ctx.lineWidth = 3 * thinLineWidth;
            let zone;
            if (this.getters.isInMerge(activeSheet, col, row)) {
                zone = this.getters.getMerge(activeSheet, col, row);
            }
            else {
                zone = {
                    top: row,
                    bottom: row,
                    left: col,
                    right: col,
                };
            }
            const [x, y, width, height] = this.getters.getRect(zone, viewport);
            if (width > 0 && height > 0) {
                ctx.strokeRect(x, y, width, height);
            }
        }
    }
    SelectionPlugin.layers = [5 /* Selection */];
    SelectionPlugin.modes = ["normal", "readonly"];
    SelectionPlugin.getters = [
        "getActiveCell",
        "getActiveCols",
        "getActiveRows",
        "getCurrentStyle",
        "getSelectedZones",
        "getSelectedZone",
        "getAggregate",
        "getSelection",
        "getPosition",
        "getSelectionMode",
        "isSelected",
    ];

    /**
     * Selection input Plugin
     *
     * The SelectionInput component input and output are both arrays of strings, but
     * it requires an intermediary internal state to work.
     * This plugin handles this internal state.
     */
    class SelectionInputPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.inputs = {};
            this.activeSheets = {};
            this.inputMaximums = {};
            this.focusedInputId = null;
            this.focusedRange = null;
            this.willAddNewRange = false;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "FOCUS_RANGE":
                    const index = this.getIndex(cmd.id, cmd.rangeId);
                    if (this.focusedInputId === cmd.id && this.focusedRange === index) {
                        return { status: "CANCELLED", reason: 16 /* InputAlreadyFocused */ };
                    }
                    break;
                case "ADD_EMPTY_RANGE":
                    if (this.inputs[cmd.id].length === this.inputMaximums[cmd.id]) {
                        return { status: "CANCELLED", reason: 17 /* MaximumRangesReached */ };
                    }
                    break;
            }
            return { status: "SUCCESS" };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "ENABLE_NEW_SELECTION_INPUT":
                    this.initInput(cmd.id, cmd.initialRanges || [], cmd.maximumRanges);
                    break;
                case "DISABLE_SELECTION_INPUT":
                    if (this.focusedInputId === cmd.id) {
                        this.dispatch("HIGHLIGHT_SELECTION", { enabled: false });
                        this.dispatch("REMOVE_ALL_HIGHLIGHTS");
                        this.focusedRange = null;
                        this.focusedInputId = null;
                    }
                    delete this.inputs[cmd.id];
                    delete this.activeSheets[cmd.id];
                    delete this.inputMaximums[cmd.id];
                    break;
                case "FOCUS_RANGE":
                    this.focus(cmd.id, this.getIndex(cmd.id, cmd.rangeId));
                    break;
                case "CHANGE_RANGE": {
                    const index = this.getIndex(cmd.id, cmd.rangeId);
                    if (index !== null) {
                        this.changeRange(cmd.id, index, cmd.value);
                    }
                    break;
                }
                case "ADD_EMPTY_RANGE":
                    this.inputs[cmd.id] = [...this.inputs[cmd.id], Object.freeze({ xc: "", id: uuidv4() })];
                    this.focusLast(cmd.id);
                    break;
                case "REMOVE_RANGE":
                    const index = this.getIndex(cmd.id, cmd.rangeId);
                    if (index !== null) {
                        this.removeRange(cmd.id, index);
                    }
                    break;
                case "ADD_HIGHLIGHTS":
                    const highlights = this.getters.getHighlights();
                    this.add(highlights.slice(highlights.length - Object.keys(cmd.ranges).length));
                    break;
                case "START_SELECTION_EXPANSION":
                    if (this.willAddNewRange) {
                        this.dispatch("RESET_PENDING_HIGHLIGHT");
                    }
                    break;
                case "PREPARE_SELECTION_EXPANSION": {
                    const [id, index] = [this.focusedInputId, this.focusedRange];
                    if (id !== null && index !== null) {
                        this.willAddNewRange = this.inputs[id][index].xc.trim() !== "";
                    }
                    break;
                }
                case "ACTIVATE_SHEET":
                    if (this.focusedInputId !== null && this.focusedRange !== null) {
                        this.highlightAllRanges(this.focusedInputId);
                    }
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        /**
         * Return a list of all valid XCs.
         * e.g. ["A1", "Sheet2!B3", "E12"]
         */
        getSelectionInput(id) {
            if (!this.inputs[id]) {
                return [];
            }
            return this.inputs[id].map((input, index) => Object.assign({}, input, {
                color: this.focusedInputId === id && this.focusedRange !== null ? input.color : null,
                isFocused: this.focusedInputId === id && this.focusedRange === index,
            }));
        }
        getSelectionInputValue(id) {
            return this.cleanInputs(this.inputs[id].map((range) => range.xc));
        }
        // ---------------------------------------------------------------------------
        // Other
        // ---------------------------------------------------------------------------
        initInput(id, initialRanges, maximumRanges) {
            this.inputs[id] = initialRanges.map((r) => Object.freeze({
                xc: r,
                id: uuidv4(),
            }));
            this.activeSheets[id] = this.getters.getActiveSheetId();
            if (maximumRanges !== undefined) {
                this.inputMaximums[id] = maximumRanges;
            }
            if (this.inputs[id].length === 0) {
                this.dispatch("ADD_EMPTY_RANGE", { id });
            }
        }
        /**
         * Focus a given range or remove the focus.
         */
        focus(id, index) {
            const currentFocusedInput = this.focusedInputId;
            const currentFocusedRange = this.focusedInputId && this.focusedRange;
            this.focusedInputId = id;
            if (currentFocusedRange !== null && index == null) {
                this.dispatch("HIGHLIGHT_SELECTION", { enabled: false });
                this.removeAllHighlights();
            }
            if (currentFocusedInput !== null && id !== null && currentFocusedInput !== id) {
                this.removeAllHighlights();
            }
            if ((currentFocusedRange === null && index !== null) || currentFocusedInput !== id) {
                this.dispatch("HIGHLIGHT_SELECTION", { enabled: true });
                this.highlightAllRanges(id);
            }
            this.setPendingRange(id, index);
            if (index !== null) {
                const color = this.inputs[id][index].color || getNextColor();
                this.dispatch("SET_HIGHLIGHT_COLOR", { color });
            }
            this.focusedRange = index;
        }
        focusLast(id) {
            this.focus(id, this.inputs[id].length - 1);
        }
        removeAllHighlights() {
            this.dispatch("REMOVE_ALL_HIGHLIGHTS");
        }
        /**
         * Highlight all valid ranges of the current sheet.
         */
        highlightAllRanges(id) {
            const inputs = this.inputs[id];
            for (const [index, input] of inputs.entries()) {
                this.focusedRange = index;
                const ranges = this.inputToHighlights(id, input);
                if (Object.keys(ranges).length > 0) {
                    this.dispatch("ADD_HIGHLIGHTS", { ranges });
                }
            }
        }
        add(newHighlights) {
            if (this.focusedInputId === null ||
                this.focusedRange === null ||
                this.getters.isSelectingForComposer() ||
                newHighlights.length === 0) {
                return;
            }
            const mode = this.getters.getSelectionMode();
            const sheet = this.activeSheets[this.focusedInputId];
            if (mode === SelectionMode.expanding && this.willAddNewRange) {
                this.addNewRange(this.focusedInputId, this.highlightsToInput(newHighlights, sheet));
                this.focusLast(this.focusedInputId);
                this.willAddNewRange = false;
            }
            else {
                this.setRange(this.focusedInputId, this.focusedRange, this.highlightsToInput(newHighlights, sheet));
            }
        }
        /**
         * Add a new input at the end.
         */
        addNewRange(id, values) {
            this.insertNewRange(id, this.inputs[id].length, values);
        }
        /**
         * Insert new inputs after the given index.
         */
        insertNewRange(id, index, values) {
            if (this.inputMaximums[id] < this.inputs[id].length + values.length) {
                return;
            }
            this.inputs[id].splice(index, 0, ...values);
        }
        setRange(id, index, values) {
            let [existingRange, ...newRanges] = values;
            const additionalRanges = this.inputs[id].length + newRanges.length - this.inputMaximums[id];
            if (additionalRanges) {
                newRanges = newRanges.slice(0, newRanges.length - additionalRanges);
            }
            this.inputs[id].splice(index, 1, existingRange, ...newRanges);
            // focus the last newly added range
            if (newRanges.length) {
                this.focus(id, index + newRanges.length);
            }
        }
        changeRange(id, index, value) {
            if (this.focusedInputId !== id || this.focusedRange !== index) {
                this.dispatch("FOCUS_RANGE", { id, rangeId: this.inputs[id][index].id });
            }
            const input = this.inputs[id][index];
            const valuesNotHighlighted = value
                .split(",")
                .map((reference) => reference.trim())
                .filter((reference) => !this.shouldBeHighlighted(this.activeSheets[id], reference));
            const highlightRanges = this.inputToHighlights(id, {
                color: input.color,
                xc: value,
            });
            this.dispatch("REMOVE_HIGHLIGHTS", { ranges: this.inputToHighlights(id, input) });
            this.dispatch("ADD_HIGHLIGHTS", {
                ranges: highlightRanges,
            });
            const highlightNumber = Object.keys(highlightRanges).length;
            const setRange = highlightNumber ? this.insertNewRange.bind(this) : this.setRange.bind(this);
            setRange(id, index + highlightNumber, valuesNotHighlighted.map((value) => ({
                id: uuidv4(),
                xc: value,
            })));
        }
        removeRange(id, index) {
            const [removedRange] = this.inputs[id].splice(index, 1);
            if (this.focusedInputId === id && this.focusedRange !== null) {
                this.dispatch("REMOVE_HIGHLIGHTS", {
                    ranges: this.inputToHighlights(id, removedRange),
                });
                this.focusLast(id);
            }
        }
        setPendingRange(id, index) {
            this.dispatch("RESET_PENDING_HIGHLIGHT");
            if (index !== null && this.inputs[id][index].xc) {
                this.dispatch("ADD_PENDING_HIGHLIGHTS", {
                    ranges: this.inputToHighlights(id, this.inputs[id][index]),
                });
            }
        }
        /**
         * Convert highlights to the input format
         */
        highlightsToInput(highlights, activeSheetId) {
            const toXC = this.getters.zoneToXC;
            const sheetId = this.getters.getActiveSheetId();
            return highlights.map((h) => Object.freeze({
                xc: h.sheet !== activeSheetId
                    ? `${this.getters.getSheetName(h.sheet)}!${toXC(sheetId, h.zone)}`
                    : toXC(sheetId, h.zone),
                id: uuidv4(),
                color: h.color,
            }));
        }
        /**
         * Convert highlights input format to the command format.
         * The first xc in the input range will keep its color.
         * Invalid ranges and ranges from other sheets than the active sheets
         * are ignored.
         */
        inputToHighlights(id, { xc, color }) {
            const ranges = this.cleanInputs([xc]).filter((reference) => this.shouldBeHighlighted(this.activeSheets[id], reference));
            if (ranges.length === 0)
                return {};
            const [fromInput, ...otherRanges] = ranges;
            const highlights = {
                [fromInput]: color || getNextColor(),
            };
            for (const range of otherRanges) {
                highlights[range] = getNextColor();
            }
            return highlights;
        }
        isRangeValid(xc) {
            const [rangeXc, sheetName] = xc.split("!").reverse();
            return (rangeXc.match(rangeReference) !== null &&
                (sheetName === undefined || this.getters.getSheetIdByName(sheetName) !== undefined));
        }
        cleanInputs(ranges) {
            return ranges
                .map((xc) => xc.split(","))
                .flat()
                .map((xc) => xc.trim())
                .filter((xc) => xc !== "")
                .filter((range) => this.isRangeValid(range));
        }
        /**
         * Check if a cell or range reference should be highlighted.
         * It should be highlighted if it references the current active sheet.
         * Note that if no sheet name is given in the reference ("A1"), it refers to the
         * active sheet when the selection input was enabled which might be different from
         * the current active sheet.
         */
        shouldBeHighlighted(inputSheetId, reference) {
            const sheetName = reference.split("!").reverse()[1];
            const sheetId = this.getters.getSheetIdByName(sheetName);
            const activeSheetId = this.getters.getActiveSheet().id;
            const valid = this.cleanInputs([reference]).length === 1;
            return (valid &&
                (sheetId === activeSheetId || (sheetId === undefined && activeSheetId === inputSheetId)));
        }
        /**
         * Return the index of a range given its id
         * or `null` if the range is not found.
         */
        getIndex(id, rangeId) {
            const index = this.inputs[id].findIndex((range) => range.id === rangeId);
            return index >= 0 ? index : null;
        }
    }
    SelectionInputPlugin.modes = ["normal", "readonly"];
    SelectionInputPlugin.layers = [1 /* Highlights */];
    SelectionInputPlugin.getters = ["getSelectionInput", "getSelectionInputValue"];

    class SortPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.headerTypeFromCell = (cell) => {
                var _a;
                switch (cell.type) {
                    case CellType.formula:
                        if (typeof cell.value === "number" && ((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT))) {
                            // date
                            return CellType.number;
                        }
                        else {
                            switch (typeof cell.value) {
                                case "boolean":
                                    return "boolean";
                                case "number":
                                    return CellType.number;
                                default:
                                    return CellType.text;
                            }
                        }
                    case CellType.invalidFormula:
                        return CellType.text;
                    default:
                        return cell.type;
                }
            };
        }
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "SORT_CELLS":
                    return this.isSortAllowed(cmd.sheetId, cmd.anchor, cmd.zone);
            }
            return { status: "SUCCESS" };
        }
        handle(cmd) {
            switch (cmd.type) {
                case "SORT_CELLS":
                    if (cmd.interactive) {
                        this.interactiveSortSelection(cmd.sheetId, cmd.anchor, cmd.zone, cmd.sortDirection);
                    }
                    else {
                        this.sortZone(cmd.sheetId, cmd.anchor, cmd.zone, cmd.sortDirection);
                    }
                    break;
            }
        }
        isSortAllowed(sheetId, anchor, zone) {
            if (!isInside(anchor[0], anchor[1], zone)) {
                throw new Error(_lt("The anchor must be part of the provided zone"));
            }
            const hasMerges = this.getters.doesIntersectMerge(sheetId, zone);
            if (hasMerges) {
                const merges = this.getters.getMerges(sheetId).filter((merge) => overlap(merge, zone));
                /*Test the presence of single cells*/
                for (let row = zone.top; row <= zone.bottom; row++) {
                    for (let col = zone.left; col <= zone.right; col++) {
                        if (!this.getters.isInMerge(sheetId, col, row)) {
                            return { status: "CANCELLED", reason: 38 /* InvalidSortZone */ };
                        }
                    }
                }
                /*Test the presence of merges of different sizes*/
                const mergeDimension = zoneToDimension(merges[0]);
                let [widthFirst, heightFirst] = [mergeDimension.width, mergeDimension.height];
                if (!merges.every((merge) => {
                    let [widthCurrent, heightCurrent] = [
                        merge.right - merge.left + 1,
                        merge.bottom - merge.top + 1,
                    ];
                    return widthCurrent === widthFirst && heightCurrent === heightFirst;
                })) {
                    return { status: "CANCELLED", reason: 38 /* InvalidSortZone */ };
                }
            }
            return { status: "SUCCESS" };
        }
        interactiveSortSelection(sheetId, anchor, zone, sortDirection) {
            let result;
            //several columns => bypass the contiguity check
            let multiColumns = zone.right > zone.left;
            if (this.getters.doesIntersectMerge(sheetId, zone)) {
                multiColumns = false;
                let table;
                for (let r = zone.top; r <= zone.bottom; r++) {
                    table = [];
                    for (let c = zone.left; c <= zone.right; c++) {
                        let merge = this.getters.getMerge(sheetId, c, r);
                        if (merge && !table.includes(merge.id.toString())) {
                            table.push(merge.id.toString());
                        }
                    }
                    if (table.length >= 2) {
                        multiColumns = true;
                        break;
                    }
                }
            }
            if (multiColumns) {
                result = this.dispatch("SORT_CELLS", { sheetId, anchor, zone, sortDirection });
            }
            else {
                // check contiguity
                const contiguousZone = this.getContiguousZone(sheetId, zone);
                if (isEqual(contiguousZone, zone)) {
                    // merge as it is
                    result = this.dispatch("SORT_CELLS", {
                        sheetId,
                        anchor,
                        zone,
                        sortDirection,
                    });
                }
                else {
                    this.ui.askConfirmation(_lt("We found data next to your selection. Since this data was not selected, it will not be sorted. Do you want to extend your selection?"), () => {
                        zone = contiguousZone;
                        result = this.dispatch("SORT_CELLS", {
                            sheetId,
                            anchor,
                            zone,
                            sortDirection,
                        });
                    }, () => {
                        result = this.dispatch("SORT_CELLS", {
                            sheetId,
                            anchor,
                            zone,
                            sortDirection,
                        });
                    });
                }
            }
            if (result && result.status === "CANCELLED") {
                switch (result.reason) {
                    case 38 /* InvalidSortZone */:
                        this.dispatch("SET_SELECTION", {
                            anchor: anchor,
                            zones: [zone],
                        });
                        this.ui.notifyUser(_lt("Cannot sort. To sort, select only cells or only merges that have the same size."));
                        break;
                }
            }
        }
        // getContiguousZone helpers
        /**
         * safe-version of expandZone to make sure we don't get out of the grid
         */
        expand(sheet, z) {
            const { left, right, top, bottom } = this.getters.expandZone(sheet.id, z);
            return {
                left: Math.max(0, left),
                right: Math.min(sheet.cols.length - 1, right),
                top: Math.max(0, top),
                bottom: Math.min(sheet.rows.length - 1, bottom),
            };
        }
        /**
         * verifies the presence of at least one non-empty cell in the given zone
         */
        checkExpandedValues(sheet, z) {
            const expandedZone = this.expand(sheet, z);
            const sheetId = sheet.id;
            let line = [];
            let cell;
            if (this.getters.doesIntersectMerge(sheetId, expandedZone)) {
                const { left, right, top, bottom } = expandedZone;
                for (let c = left; c <= right; c++) {
                    for (let r = top; r <= bottom; r++) {
                        const [mainCellCol, mainCellRow] = this.getters.getMainCell(sheetId, c, r);
                        cell = this.getters.getCell(sheetId, mainCellCol, mainCellRow);
                        line.push(cell ? this.getters.getCellText(cell, sheetId) : "");
                    }
                }
            }
            else {
                const values = mapCellsInZone(expandedZone, sheet, (cell) => this.getters.getCellText(cell, sheetId), "");
                line = values.flat();
            }
            return line.some((item) => item !== "");
        }
        /**
         * This function will expand the provided zone in directions (top, bottom, left, right) for which there
         * are non-null cells on the external boundary of the zone in the given direction.
         *
         * Example:
         *          A     B     C     D     E
         *         ___   ___   ___   ___   ___
         *    1  |     |  D  |     |     |     |
         *         ___   ___   ___   ___   ___
         *    2  |  5  |     |  1  |  D  |     |
         *         ___   ___   ___   ___   ___
         *    3  |     |     |  A  |  X  |     |
         *         ___   ___   ___   ___   ___
         *    4  |     |     |     |     |     |
         *         ___   ___   ___   ___   ___
         *
         *  Let's consider a provided zone corresponding to (C2:D3) - (left:2, right: 3, top:1, bottom:2)
         *  - the top external bounday is (B1:E1)
         *    Since we have B1='D' != "", we expand to the top: => (C1:D3)
         *    The top boundary having reached the top of the grid, we cannot expand in that direction anymore
         *
         *  - the left boundary is (B1:B4)
         *    since we have B1 again, we expand to the left  => (B1:D3)
         *
         *  - the right and bottom boundaries are a dead end for now as (E1:E4) and (A4:E4) are empty.
         *
         *  - the left boundary is now (A1:A4)
         *    Since we have A2=5 != "", we can therefore expand to the left => (A1:D3)
         *
         *  This will be the final zone as left and top have reached the boundaries of the grid and
         *  the other boundaries (E1:E4) and (A4:E4) are empty.
         *
         * @param sheetId UID of concerned sheet
         * @param zone Zone
         *
         */
        getContiguousZone(sheetId, zone) {
            let { top, bottom, left, right } = zone;
            let canExpand;
            const sheet = this.getters.getSheet(sheetId);
            let stop = false;
            while (!stop) {
                stop = true;
                /** top row external boundary */
                if (top > 0) {
                    canExpand = this.checkExpandedValues(sheet, {
                        left: left - 1,
                        right: right + 1,
                        top: top - 1,
                        bottom: top - 1,
                    });
                    if (canExpand) {
                        stop = false;
                        top--;
                    }
                }
                /** left column external boundary */
                if (left > 0) {
                    canExpand = this.checkExpandedValues(sheet, {
                        left: left - 1,
                        right: left - 1,
                        top: top - 1,
                        bottom: bottom + 1,
                    });
                    if (canExpand) {
                        stop = false;
                        left--;
                    }
                }
                /** right column external boundary */
                if (right < sheet.cols.length - 1) {
                    canExpand = this.checkExpandedValues(sheet, {
                        left: right + 1,
                        right: right + 1,
                        top: top - 1,
                        bottom: bottom + 1,
                    });
                    if (canExpand) {
                        stop = false;
                        right++;
                    }
                }
                /** bottom row external boundary */
                if (bottom < sheet.rows.length - 1) {
                    canExpand = this.checkExpandedValues(sheet, {
                        left: left - 1,
                        right: right + 1,
                        top: bottom + 1,
                        bottom: bottom + 1,
                    });
                    if (canExpand) {
                        stop = false;
                        bottom++;
                    }
                }
            }
            return { left, right, top, bottom };
        }
        /**
         * This function evaluates if the top row of a provided zone can be considered as a `header`
         * by checking the following criteria:
         * * If the left-most column top row value (topLeft) is empty, we ignore it while evaluating the criteria.
         * 1 - Apart from the left-most column, every element of the top row must be non-empty, i.e. a cell should be present in the sheet.
         * 2 - There should be at least one column in which the type (HeaderType) of the rop row cell differs from the type of the cell below.
         *  For the second criteria, we ignore columns on which the cell below is empty.
         *
         */
        hasHeader(sheet, zone, deltaX, deltaY) {
            const { left, right, top, bottom } = zone;
            if (bottom - top + 1 === 1)
                return false;
            let cells = mapCellsInZone({ left, right, top: top, bottom: top + 2 * deltaY - 1 }, sheet, this.headerTypeFromCell, CellType.empty, deltaX, deltaY);
            // ignore left-most column when topLeft cell is empty
            const topLeft = cells[0][0];
            if (topLeft === CellType.empty) {
                cells = cells.slice(1);
            }
            if (cells.some((item) => item[0] === CellType.empty)) {
                return false;
            }
            else if (cells.some((item) => item[1] !== CellType.empty && item[0] !== item[1])) {
                return true;
            }
            else {
                return false;
            }
        }
        sortCellsList(list, sortDirection) {
            const cellsIndex = list.map((val, index) => ({ index, val }));
            const sortingCellsIndexes = cellsIndex.filter((x) => !(x.val == undefined || x.val.value === ""));
            const emptyCellsIndexes = cellsIndex.filter((x) => x.val == undefined || x.val.value === "");
            const inverse = sortDirection === "descending" ? -1 : 1;
            const sortTypes = [CellType.number, CellType.text, "boolean"];
            const convertCell = (cell) => {
                let type = this.headerTypeFromCell(cell);
                return { type: type, value: cell.value };
            };
            const sortingTypeValueMapIndexes = sortingCellsIndexes.map((item) => {
                return {
                    index: item.index,
                    val: convertCell(item.val),
                };
            });
            const sortedIndex = sortingTypeValueMapIndexes.sort((left, right) => {
                let typeOrder = sortTypes.indexOf(left.val.type) - sortTypes.indexOf(right.val.type);
                if (typeOrder === 0) {
                    if (left.val.type === "text") {
                        typeOrder = left.val.value.localeCompare(right.val.value);
                    }
                    else
                        typeOrder = left.val.value - right.val.value;
                }
                return inverse * typeOrder;
            });
            return sortedIndex.concat(emptyCellsIndexes);
        }
        sortZone(sheetId, anchor, zone, sortDirection) {
            let stepX = 1, stepY = 1, sortingCol = anchor[0]; // fetch anchor
            let sortZone = Object.assign({}, zone);
            // Update in case of merges in the zone
            if (this.getters.doesIntersectMerge(sheetId, sortZone)) {
                const [col, row] = anchor;
                const merge = this.getters.getMerge(sheetId, col, row);
                stepX = merge.right - merge.left + 1;
                stepY = merge.bottom - merge.top + 1;
                sortingCol = merge.topLeft.col;
            }
            const sheet = this.getters.getSheet(sheetId);
            const hasHeader = this.hasHeader(sheet, sortZone, stepX, stepY);
            if (hasHeader) {
                sortZone.top += stepY;
            }
            const cells = mapCellsInZone(sortZone, sheet, (cell) => cell, undefined, stepX, stepY);
            const sortingCells = cells[sortingCol - sortZone.left];
            const sortedIndexOfSortTypeCells = this.sortCellsList(sortingCells, sortDirection);
            const sortedIndex = sortedIndexOfSortTypeCells.map((x) => x.index);
            const [width, height] = [cells.length, cells[0].length];
            for (let c = 0; c < width; c++) {
                for (let r = 0; r < height; r++) {
                    let cell = cells[c][sortedIndex[r]];
                    let newCol = sortZone.left + c * stepX;
                    let newRow = sortZone.top + r * stepY;
                    let newCellValues = {
                        sheetId: sheetId,
                        col: newCol,
                        row: newRow,
                        content: "",
                        value: "",
                    };
                    if (cell) {
                        let content = this.getters.getCellValue(cell, sheetId, true) || "";
                        if (cell.type === CellType.formula) {
                            const position = this.getters.getCellPosition(cell.id);
                            const offsetY = newRow - position.row;
                            // we only have a vertical offset
                            content = this.getters.applyOffset(sheetId, content, 0, offsetY);
                        }
                        newCellValues.style = cell.style;
                        newCellValues.content = content;
                        newCellValues.format = cell.format;
                        newCellValues.value = cell.value;
                    }
                    this.dispatch("UPDATE_CELL", newCellValues);
                }
            }
        }
    }
    SortPlugin.getters = ["getContiguousZone"];

    class UIOptionsPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.showFormulas = false;
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        handle(cmd) {
            switch (cmd.type) {
                case "SET_FORMULA_VISIBILITY":
                    this.showFormulas = cmd.show;
                    break;
            }
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        shouldShowFormulas() {
            return this.showFormulas;
        }
    }
    UIOptionsPlugin.modes = ["normal", "readonly"];
    UIOptionsPlugin.getters = ["shouldShowFormulas"];

    class SheetUIPlugin extends UIPlugin {
        constructor() {
            super(...arguments);
            this.activeSheet = null;
            // This flag is used to avoid to historize the ACTIVE_SHEET command when it's
            // the main command.
            this.historizeActiveSheet = true;
            this.ctx = document.createElement("canvas").getContext("2d");
        }
        // ---------------------------------------------------------------------------
        // Command Handling
        // ---------------------------------------------------------------------------
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "ACTIVATE_SHEET":
                    try {
                        this.getters.getSheet(cmd.sheetIdTo);
                        this.historizeActiveSheet = false;
                        break;
                    }
                    catch (error) {
                        return { status: "CANCELLED", reason: 15 /* InvalidSheetId */ };
                    }
            }
            return { status: "SUCCESS" };
        }
        beforeHandle(cmd) {
            switch (cmd.type) {
                case "DELETE_SHEET":
                    if (this.getActiveSheetId() === cmd.sheetId) {
                        const currentIndex = this.getters
                            .getVisibleSheets()
                            .findIndex((sheetId) => sheetId === this.getActiveSheetId());
                        let sheetIdTo;
                        const currentSheets = this.getters.getVisibleSheets();
                        if (currentIndex === 0) {
                            sheetIdTo = currentSheets[1];
                        }
                        else {
                            sheetIdTo = currentSheets[Math.max(0, currentIndex - 1)];
                        }
                        this.dispatch("ACTIVATE_SHEET", {
                            sheetIdFrom: this.getActiveSheetId(),
                            sheetIdTo,
                        });
                    }
                    break;
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "CREATE_SHEET":
                    if (cmd.activate) {
                        this.dispatch("ACTIVATE_SHEET", {
                            sheetIdFrom: this.getActiveSheetId(),
                            sheetIdTo: cmd.sheetId,
                        });
                    }
                    break;
                case "DUPLICATE_SHEET":
                    this.duplicateSheet(cmd.sheetIdTo);
                    break;
                case "RENAME_SHEET":
                    if (cmd.interactive) {
                        this.interactiveRenameSheet(cmd.sheetId, _lt("Rename Sheet"));
                    }
                    break;
                case "DELETE_SHEET_CONFIRMATION":
                    this.interactiveDeleteSheet(cmd.sheetId);
                    break;
                case "ADD_MERGE":
                    if (cmd.interactive) {
                        this.interactiveMerge(cmd.sheetId, cmd.zone);
                    }
                    break;
                case "START":
                    this.historizeActiveSheet = false;
                    this.dispatch("ACTIVATE_SHEET", {
                        sheetIdTo: this.getters.getSheets()[0].id,
                        sheetIdFrom: this.getters.getSheets()[0].id,
                    });
                    break;
                case "ACTIVATE_SHEET":
                    const sheet = this.getters.getSheet(cmd.sheetIdTo);
                    if (this.historizeActiveSheet) {
                        this.history.update("activeSheet", sheet);
                    }
                    else {
                        this.activeSheet = sheet;
                    }
                    break;
                case "AUTORESIZE_COLUMNS":
                    for (let col of cmd.cols) {
                        const size = this.getColMaxWidth(cmd.sheetId, col);
                        if (size !== 0) {
                            this.dispatch("RESIZE_COLUMNS", {
                                columns: [col],
                                size: size + 2 * PADDING_AUTORESIZE,
                                sheetId: cmd.sheetId,
                            });
                        }
                    }
                    break;
                case "AUTORESIZE_ROWS":
                    for (let row of cmd.rows) {
                        const size = this.getRowMaxHeight(cmd.sheetId, row);
                        if (size !== 0) {
                            this.dispatch("RESIZE_ROWS", {
                                rows: [row],
                                size: size + 2 * PADDING_AUTORESIZE,
                                sheetId: cmd.sheetId,
                            });
                        }
                    }
                    break;
            }
        }
        duplicateSheet(sheetId) {
            this.dispatch("ACTIVATE_SHEET", {
                sheetIdFrom: this.getActiveSheetId(),
                sheetIdTo: sheetId,
            });
        }
        finalize() {
            this.historizeActiveSheet = true;
        }
        // ---------------------------------------------------------------------------
        // Getters
        // ---------------------------------------------------------------------------
        getActiveSheet() {
            return this.activeSheet;
        }
        getActiveSheetId() {
            return this.activeSheet.id;
        }
        getCellWidth(cell) {
            const text = this.getters.getCellText(cell, this.getters.getActiveSheetId(), this.getters.shouldShowFormulas());
            return computeTextWidth(this.ctx, text, this.getters.getCellStyle(cell));
        }
        getCellHeight(cell) {
            const style = this.getters.getCellStyle(cell);
            const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
            return fontSizeMap[sizeInPt];
        }
        // ---------------------------------------------------------------------------
        // Grid manipulation
        // ---------------------------------------------------------------------------
        getColMaxWidth(sheetId, index) {
            const cells = this.getters.getColCells(sheetId, index);
            const sizes = cells.map((cell) => this.getCellWidth(cell));
            return Math.max(0, ...sizes);
        }
        getRowMaxHeight(sheetId, index) {
            const sheet = this.getters.getSheet(sheetId);
            const cells = Object.values(sheet.rows[index].cells);
            const sizes = cells.map((cell) => this.getCellHeight(cell));
            return Math.max(0, ...sizes);
        }
        interactiveRenameSheet(sheetId, title) {
            const placeholder = this.getters.getSheetName(sheetId);
            this.ui.editText(title, placeholder, (name) => {
                if (!name) {
                    return;
                }
                const result = this.dispatch("RENAME_SHEET", { sheetId: sheetId, name });
                const sheetName = this.getters.getSheetName(sheetId);
                if (result.status === "CANCELLED" && sheetName !== name) {
                    this.interactiveRenameSheet(sheetId, _lt("Please enter a valid sheet name"));
                }
            });
        }
        interactiveDeleteSheet(sheetId) {
            this.ui.askConfirmation(_lt("Are you sure you want to delete this sheet ?"), () => {
                this.dispatch("DELETE_SHEET", { sheetId: sheetId });
            });
        }
        interactiveMerge(sheet, zone) {
            const result = this.dispatch("ADD_MERGE", { sheetId: sheet, zone });
            if (result.status === "CANCELLED") {
                if (result.reason === 2 /* MergeIsDestructive */) {
                    this.ui.askConfirmation(_lt("Merging these cells will only preserve the top-leftmost value. Merge anyway?"), () => {
                        this.dispatch("ADD_MERGE", { sheetId: sheet, zone, force: true });
                    });
                }
            }
        }
    }
    SheetUIPlugin.getters = ["getActiveSheet", "getActiveSheetId", "getCellWidth", "getCellHeight"];

    const corePluginRegistry = new Registry()
        .add("sheet", SheetPlugin)
        .add("range", RangePlugin)
        .add("cell", CellPlugin)
        .add("merge", MergePlugin)
        .add("borders", BordersPlugin)
        .add("conditional formatting", ConditionalFormatPlugin)
        .add("figures", FigurePlugin)
        .add("chart", ChartPlugin);
    const uiPluginRegistry = new Registry()
        .add("ui_sheet", SheetUIPlugin)
        .add("ui_options", UIOptionsPlugin)
        .add("evaluation", EvaluationPlugin)
        .add("evaluation_cf", EvaluationConditionalFormatPlugin)
        .add("evaluation_chart", EvaluationChartPlugin)
        .add("clipboard", ClipboardPlugin)
        .add("selection", SelectionPlugin)
        .add("edition", EditionPlugin)
        .add("highlight", HighlightPlugin)
        .add("selectionInput", SelectionInputPlugin)
        .add("grid renderer", RendererPlugin)
        .add("autofill", AutofillPlugin)
        .add("find_and_replace", FindAndReplacePlugin)
        .add("sort", SortPlugin);

    /**
     * This is the current state version number. It should be incremented each time
     * a breaking change is made in the way the state is handled, and an upgrade
     * function should be defined
     */
    const CURRENT_VERSION = 7;
    /**
     * This function tries to load anything that could look like a valid
     * workbookData object. It applies any migrations, if needed, and return a
     * current, complete workbookData object.
     *
     * It also ensures that there is at least one sheet.
     */
    function load(data) {
        if (!data) {
            return createEmptyWorkbookData();
        }
        data = Object.assign({}, data);
        // apply migrations, if needed
        if ("version" in data) {
            if (data.version < CURRENT_VERSION) {
                data = migrate(data);
            }
        }
        // sanity check: try to fix missing fields/corrupted state by providing
        // sensible default values
        data = Object.assign(createEmptyWorkbookData(), data, { version: CURRENT_VERSION });
        data.sheets = data.sheets.map((s, i) => Object.assign(createEmptySheet(`Sheet${i + 1}`), s));
        if (data.sheets.length === 0) {
            data.sheets.push(createEmptySheet());
        }
        return data;
    }
    function migrate(data) {
        const index = MIGRATIONS.findIndex((m) => m.from === data.version);
        for (let i = index; i < MIGRATIONS.length; i++) {
            data = MIGRATIONS[i].applyMigration(data);
        }
        return data;
    }
    const MIGRATIONS = [
        {
            description: "add the `activeSheet` field on data",
            from: 1,
            to: 2,
            applyMigration(data) {
                if (data.sheets && data.sheets[0]) {
                    data.activeSheet = data.sheets[0].name;
                }
                return data;
            },
        },
        {
            description: "add an id field in each sheet",
            from: 2,
            to: 3,
            applyMigration(data) {
                if (data.sheets && data.sheets.length) {
                    for (let sheet of data.sheets) {
                        sheet.id = sheet.id || sheet.name;
                    }
                }
                return data;
            },
        },
        {
            description: "activeSheet is now an id, not the name of a sheet",
            from: 3,
            to: 4,
            applyMigration(data) {
                const activeSheet = data.sheets.find((s) => s.name === data.activeSheet);
                data.activeSheet = activeSheet.id;
                return data;
            },
        },
        {
            description: "add figures object in each sheets",
            from: 4,
            to: 5,
            applyMigration(data) {
                for (let sheet of data.sheets) {
                    sheet.figures = sheet.figures || [];
                }
                return data;
            },
        },
        {
            description: "normalize the content of the cell if it is a formula to avoid parsing all the formula that vary only by the cells they use",
            from: 5,
            to: 6,
            applyMigration(data) {
                for (let sheet of data.sheets) {
                    for (let xc in sheet.cells) {
                        const cell = sheet.cells[xc];
                        if (cell.content && cell.content.startsWith("=")) {
                            cell.formula = normalize(cell.content);
                        }
                    }
                }
                return data;
            },
        },
        {
            description: "transform chart data structure",
            from: 6,
            to: 7,
            applyMigration(data) {
                for (let sheet of data.sheets) {
                    for (let f in sheet.figures) {
                        const { dataSets, ...newData } = sheet.figures[f].data;
                        const newDataSets = [];
                        for (let ds of dataSets) {
                            if (ds.labelCell) {
                                const dataRange = toZone(ds.dataRange);
                                const newRange = ds.labelCell + ":" + toXC(dataRange.right, dataRange.bottom);
                                newDataSets.push(newRange);
                            }
                            else {
                                newDataSets.push(ds.dataRange);
                            }
                        }
                        newData.dataSetsHaveTitle = Boolean(dataSets[0].labelCell);
                        newData.dataSets = newDataSets;
                        sheet.figures[f].data = newData;
                    }
                }
                return data;
            },
        },
    ];
    // -----------------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------------
    function createEmptySheet(name = "Sheet1") {
        return {
            id: uuidv4(),
            name,
            colNumber: 26,
            rowNumber: 100,
            cells: {},
            cols: {},
            rows: {},
            merges: [],
            conditionalFormats: [],
            figures: [],
        };
    }
    function createEmptyWorkbookData() {
        const data = {
            version: CURRENT_VERSION,
            sheets: [createEmptySheet("Sheet1")],
            entities: {},
            styles: {},
            borders: {},
        };
        return data;
    }

    /**
     * Max Number of history steps kept in memory
     */
    const MAX_HISTORY_STEPS = 99;
    class WHistory {
        constructor() {
            this.current = null;
            this.undoStack = [];
            this.redoStack = [];
            this.historize = false;
        }
        // getters
        canUndo() {
            return this.undoStack.length > 0;
        }
        canRedo() {
            return this.redoStack.length > 0;
        }
        allowDispatch(cmd) {
            switch (cmd.type) {
                case "UNDO":
                    return this.canUndo()
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 3 /* EmptyUndoStack */ };
                case "REDO":
                    return this.canRedo()
                        ? { status: "SUCCESS" }
                        : { status: "CANCELLED", reason: 4 /* EmptyRedoStack */ };
            }
            return { status: "SUCCESS" };
        }
        beforeHandle(cmd) {
            if (!this.current && cmd.type !== "REDO" && cmd.type !== "UNDO" && this.historize) {
                this.current = [];
            }
        }
        handle(cmd) {
            switch (cmd.type) {
                case "UNDO":
                    this.undo();
                    break;
                case "REDO":
                    this.redo();
                    break;
                case "START":
                    this.historize = true;
            }
        }
        finalize() {
            if (this.current && this.current.length) {
                this.undoStack.push(this.current);
                this.redoStack = [];
                this.current = null;
                if (this.undoStack.length > MAX_HISTORY_STEPS) {
                    this.undoStack.shift();
                }
            }
        }
        undo() {
            const step = this.undoStack.pop();
            if (!step) {
                return;
            }
            this.redoStack.push(step);
            for (let i = step.length - 1; i >= 0; i--) {
                let change = step[i];
                this.applyChange(change, "before");
            }
        }
        redo() {
            const step = this.redoStack.pop();
            if (!step) {
                return;
            }
            this.undoStack.push(step);
            for (let change of step) {
                this.applyChange(change, "after");
            }
        }
        /**
         * Create an empty structure according to the type of the node key:
         * string: object
         * number: array
         */
        createEmptyStructure(node) {
            if (typeof node === "string") {
                return {};
            }
            else if (typeof node === "number") {
                return [];
            }
            throw new Error(`Cannot create new node`);
        }
        applyChange(change, target) {
            let val = change.root;
            let key = change.path[change.path.length - 1];
            for (let pathIndex = 0; pathIndex < change.path.slice(0, -1).length; pathIndex++) {
                const p = change.path[pathIndex];
                if (val[p] === undefined) {
                    const nextPath = change.path[pathIndex + 1];
                    val[p] = this.createEmptyStructure(nextPath);
                }
                val = val[p];
            }
            if (change[target] === undefined) {
                delete val[key];
            }
            else {
                val[key] = change[target];
            }
        }
        updateStateFromRoot(...args) {
            const val = args.pop();
            const [root, ...path] = args;
            let value = root;
            let key = path[path.length - 1];
            for (let pathIndex = 0; pathIndex <= path.length - 2; pathIndex++) {
                const p = path[pathIndex];
                if (value[p] === undefined) {
                    const nextPath = path[pathIndex + 1];
                    value[p] = this.createEmptyStructure(nextPath);
                }
                value = value[p];
            }
            if (value[key] === val) {
                return;
            }
            if (this.current) {
                this.current.push({
                    root,
                    path,
                    before: value[key],
                    after: val,
                });
            }
            if (val === undefined) {
                delete value[key];
            }
            else {
                value[key] = val;
            }
        }
    }

    var Status;
    (function (Status) {
        Status[Status["Ready"] = 0] = "Ready";
        Status[Status["Running"] = 1] = "Running";
        Status[Status["Finalizing"] = 2] = "Finalizing";
        Status[Status["Interactive"] = 3] = "Interactive";
    })(Status || (Status = {}));
    class Model extends owl.core.EventBus {
        constructor(data = {}, config = {}) {
            super();
            /**
             * A plugin can draw some contents on the canvas. But even better: it can do
             * so multiple times.  The order of the render calls will determine a list of
             * "layers" (i.e., earlier calls will be obviously drawn below later calls).
             * This list simply keeps the renderers+layer information so the drawing code
             * can just iterate on it
             */
            this.renderers = [];
            /**
             * Internal status of the model. Important for command handling coordination
             */
            this.status = 0 /* Ready */;
            // ---------------------------------------------------------------------------
            // Command Handling
            // ---------------------------------------------------------------------------
            /**
             * The dispatch method is the only entry point to manipulate date in the model.
             * This is through this method that commands are dispatched, most of the time
             * recursively until no plugin want to react anymore.
             *
             * Small technical detail: it is defined as an arrow function.  There are two
             * reasons for this:
             * 1. this means that the dispatch method can be "detached" from the model,
             *    which is done when it is put in the environment (see the Spreadsheet
             *    component)
             * 2. This allows us to define its type by using the interface CommandDispatcher
             */
            this.dispatch = (type, payload) => {
                const command = Object.assign({ type }, payload);
                let status = command.interactive ? 3 /* Interactive */ : this.status;
                switch (status) {
                    case 0 /* Ready */:
                        for (let handler of this.handlers) {
                            const allowDispatch = handler.allowDispatch(command);
                            if (allowDispatch.status === "CANCELLED") {
                                return allowDispatch;
                            }
                        }
                        this.status = 1 /* Running */;
                        for (const h of this.handlers) {
                            h.beforeHandle(command);
                        }
                        for (const h of this.handlers) {
                            h.handle(command);
                        }
                        this.status = 2 /* Finalizing */;
                        for (const h of this.handlers) {
                            h.finalize(command);
                        }
                        this.status = 0 /* Ready */;
                        if (this.config.mode !== "headless") {
                            this.trigger("update");
                        }
                        break;
                    case 1 /* Running */:
                    case 3 /* Interactive */:
                        for (const h of this.handlers) {
                            h.beforeHandle(command);
                        }
                        for (const h of this.handlers) {
                            h.handle(command);
                        }
                        break;
                    case 2 /* Finalizing */:
                        throw new Error(_lt("Cannot dispatch commands in the finalize state"));
                }
                return { status: "SUCCESS" };
            };
            DEBUG.model = this;
            const workbookData = load(data);
            const history = new WHistory();
            this.getters = {
                canUndo: history.canUndo.bind(history),
                canRedo: history.canRedo.bind(history),
            };
            this.handlers = [history];
            this.config = {
                mode: config.mode || "normal",
                openSidePanel: config.openSidePanel || (() => { }),
                notifyUser: config.notifyUser || (() => { }),
                askConfirmation: config.askConfirmation || (() => { }),
                editText: config.editText || (() => { }),
                evalContext: config.evalContext || {},
            };
            // registering plugins
            for (let Plugin of corePluginRegistry.getAll()) {
                this.setupPlugin(Plugin, workbookData);
            }
            for (let Plugin of uiPluginRegistry.getAll()) {
                this.setupUiPlugin(Plugin);
            }
            setIsFastStrategy(false);
            // starting plugins
            this.dispatch("START");
        }
        destroy() {
            delete DEBUG.model;
        }
        setupUiPlugin(Plugin) {
            const dispatch = this.dispatch.bind(this);
            const history = this.handlers.find((p) => p instanceof WHistory);
            if (Plugin.modes.includes(this.config.mode)) {
                const plugin = new Plugin(this.getters, history, dispatch, this.config);
                for (let name of Plugin.getters) {
                    if (!(name in plugin)) {
                        throw new Error(`Invalid getter name: ${name} for plugin ${plugin.constructor}`);
                    }
                    this.getters[name] = plugin[name].bind(plugin);
                }
                this.handlers.push(plugin);
                const layers = Plugin.layers.map((l) => [plugin, l]);
                this.renderers.push(...layers);
                this.renderers.sort((p1, p2) => p1[1] - p2[1]);
            }
        }
        /**
         * Initialise and properly configure a plugin.
         *
         * This method is private for now, but if the need arise, there is no deep
         * reason why the model could not add dynamically a plugin while it is running.
         */
        setupPlugin(Plugin, data) {
            const dispatch = this.dispatch.bind(this);
            const history = this.handlers.find((p) => p instanceof WHistory);
            setIsFastStrategy(true);
            if (Plugin.modes.includes(this.config.mode)) {
                const plugin = new Plugin(this.getters, history, dispatch, this.config);
                plugin.import(data);
                for (let name of Plugin.getters) {
                    if (!(name in plugin)) {
                        throw new Error(`Invalid getter name: ${name} for plugin ${plugin.constructor}`);
                    }
                    this.getters[name] = plugin[name].bind(plugin);
                }
                this.handlers.push(plugin);
            }
        }
        // ---------------------------------------------------------------------------
        // Grid Rendering
        // ---------------------------------------------------------------------------
        /**
         * When the Grid component is ready (= mounted), it has a reference to its
         * canvas and need to draw the grid on it.  This is then done by calling this
         * method, which will dispatch the call to all registered plugins.
         *
         * Note that nothing prevent multiple grid components from calling this method
         * each, or one grid component calling it multiple times with a different
         * context. This is probably the way we should do if we want to be able to
         * freeze a part of the grid (so, we would need to render different zones)
         */
        drawGrid(context) {
            // we make sure here that the viewport is properly positioned: the offsets
            // correspond exactly to a cell
            context.viewport = this.getters.snapViewportToCell(context.viewport);
            for (let [renderer, layer] of this.renderers) {
                renderer.drawGrid(context, layer);
            }
        }
        // ---------------------------------------------------------------------------
        // Data Export
        // ---------------------------------------------------------------------------
        /**
         * As the name of this method strongly implies, it is useful when we need to
         * export date out of the model.
         */
        exportData() {
            const data = createEmptyWorkbookData();
            for (let handler of this.handlers) {
                if (handler instanceof CorePlugin) {
                    handler.export(data);
                }
            }
            return data;
        }
    }

    /**
     * Return true if the event was triggered from
     * a child element.
     */
    function isChildEvent(parent, ev) {
        return !!ev.target && parent.contains(ev.target);
    }

    const { xml: xml$7, css: css$6 } = owl.tags;
    const { useExternalListener: useExternalListener$2, useRef } = owl.hooks;
    const MENU_WIDTH = 200;
    const MENU_ITEM_HEIGHT = 32;
    const SEPARATOR_HEIGHT = 1;
    //------------------------------------------------------------------------------
    // Context Menu Component
    //------------------------------------------------------------------------------
    const TEMPLATE$6 = xml$7 /* xml */ `
    <div>
      <div class="o-menu" t-att-style="style" t-on-scroll="onScroll" t-on-wheel.stop="">
        <t t-foreach="props.menuItems" t-as="menuItem" t-key="menuItem.id">
          <t t-set="isMenuRoot" t-value="isRoot(menuItem)"/>
          <t t-set="isMenuEnabled" t-value="isEnabled(menuItem)"/>
          <div
            t-att-title="getName(menuItem)"
            t-att-data-name="menuItem.id"
            t-on-click="onClickMenu(menuItem, menuItem_index)"
            t-on-mouseover="onMouseOver(menuItem, menuItem_index)"
            class="o-menu-item"
            t-att-class="{
              'o-menu-root': isMenuRoot,
              'o-separator': menuItem.separator and !menuItem_last,
              'disabled': !isMenuEnabled,
            }">
            <t t-esc="getName(menuItem)"/>
            <span class="o-menu-item-shortcut" t-esc="getShortCut(menuItem)"/>
            <t t-if="isMenuRoot">
              ${TRIANGLE_RIGHT_ICON}
            </t>
          </div>
        </t>
      </div>
      <Menu t-if="subMenu.isOpen"
        position="subMenuPosition"
        menuItems="subMenu.menuItems"
        depth="props.depth + 1"
        t-ref="subMenuRef"
        t-on-close="subMenu.isOpen=false"/>
    </div>`;
    const CSS$5 = css$6 /* scss */ `
  .o-menu {
    position: absolute;
    width: ${MENU_WIDTH}px;
    background-color: white;
    box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
    font-size: 13px;
    overflow-y: auto;
    z-index: 10;
    padding: 5px 0px;
    .o-menu-item {
      display: flex;
      justify-content: space-between;
      box-sizing: border-box;
      height: ${MENU_ITEM_HEIGHT}px;
      padding: 7px 20px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      cursor: pointer;

      &:hover {
        background-color: #ebebeb;
      }

      &.disabled {
        color: grey;
        cursor: not-allowed;
      }

      &.o-separator {
        border-bottom: ${SEPARATOR_HEIGHT}px solid #e0e2e4;
      }

      &.o-menu-root {
        display: flex;
        justify-content: space-between;
      }
      .o-menu-item-shortcut {
        color: grey;
      }
    }
  }
`;
    class Menu extends owl.Component {
        constructor() {
            super(...arguments);
            this.subMenuRef = useRef("subMenuRef");
            useExternalListener$2(window, "click", this.onClick);
            useExternalListener$2(window, "contextmenu", this.onContextMenu);
            this.subMenu = owl.useState({
                isOpen: false,
                position: null,
                scrollOffset: 0,
                menuItems: [],
            });
        }
        get subMenuPosition() {
            const position = Object.assign({}, this.subMenu.position);
            position.y -= this.subMenu.scrollOffset || 0;
            return position;
        }
        get renderRight() {
            const { x, width } = this.props.position;
            return x < width - MENU_WIDTH;
        }
        get renderBottom() {
            const { y, height } = this.props.position;
            return y < height - this.menuHeight;
        }
        get menuHeight() {
            const separators = this.props.menuItems.filter((m) => m.separator);
            const others = this.props.menuItems;
            return MENU_ITEM_HEIGHT * others.length + separators.length * SEPARATOR_HEIGHT;
        }
        get style() {
            const { x, height } = this.props.position;
            const hStyle = `left:${this.renderRight ? x : x - MENU_WIDTH}`;
            const vStyle = `top:${this.menuVerticalPosition()}`;
            const heightStyle = `max-height:${height}`;
            return `${vStyle}px;${hStyle}px;${heightStyle}px`;
        }
        activateMenu(menu) {
            menu.action(this.env);
            this.close();
        }
        close() {
            this.subMenu.isOpen = false;
            this.trigger("close");
        }
        menuVerticalPosition() {
            const { y, height } = this.props.position;
            if (this.renderBottom) {
                return y;
            }
            return Math.max(MENU_ITEM_HEIGHT, y - Math.min(this.menuHeight, height));
        }
        subMenuHorizontalPosition() {
            const { x, width } = this.props.position;
            const spaceRight = x + 2 * MENU_WIDTH < width;
            if (this.renderRight && spaceRight) {
                return x + MENU_WIDTH;
            }
            else if (this.renderRight && !spaceRight) {
                return x - MENU_WIDTH;
            }
            return x - (this.props.depth + 1) * MENU_WIDTH;
        }
        subMenuVerticalPosition(menuCount, position) {
            const { height } = this.props.position;
            const y = this.menuVerticalPosition() + this.menuItemVerticalOffset(position);
            const subMenuHeight = menuCount * MENU_ITEM_HEIGHT;
            const spaceBelow = y < height - subMenuHeight;
            if (spaceBelow) {
                return y;
            }
            return Math.max(MENU_ITEM_HEIGHT, y - subMenuHeight + MENU_ITEM_HEIGHT);
        }
        /**
         * Return the number of pixels between the top of the menu
         * and the menu item at a given index.
         */
        menuItemVerticalOffset(index) {
            return this.props.menuItems.slice(0, index).length * MENU_ITEM_HEIGHT;
        }
        onClick(ev) {
            // Don't close a root menu when clicked to open the submenus.
            if (this.el && isChildEvent(this.el, ev)) {
                return;
            }
            this.close();
        }
        onContextMenu(ev) {
            // Don't close a root menu when clicked to open the submenus.
            if (this.el && isChildEvent(this.el, ev)) {
                return;
            }
            this.subMenu.isOpen = false;
        }
        getName(menu) {
            return cellMenuRegistry.getName(menu, this.env);
        }
        getShortCut(menu) {
            return cellMenuRegistry.getShortCut(menu);
        }
        isRoot(menu) {
            return !menu.action;
        }
        isEnabled(menu) {
            return menu.isEnabled(this.env);
        }
        closeSubMenus() {
            if (this.subMenuRef.comp) {
                this.subMenuRef.comp.closeSubMenus();
            }
            this.subMenu.isOpen = false;
        }
        onScroll(ev) {
            this.subMenu.scrollOffset = ev.target.scrollTop;
        }
        /**
         * If the given menu is not disabled, open it's submenu at the
         * correct position according to available surrounding space.
         */
        openSubMenu(menu, position) {
            this.closeSubMenus();
            this.subMenu.isOpen = true;
            this.subMenu.menuItems = cellMenuRegistry.getChildren(menu, this.env);
            const { width, height } = this.props.position;
            this.subMenu.position = {
                x: this.subMenuHorizontalPosition(),
                y: this.subMenuVerticalPosition(this.subMenu.menuItems.length, position),
                height,
                width,
            };
        }
        onClickMenu(menu, position) {
            if (menu.isEnabled(this.env)) {
                if (this.isRoot(menu)) {
                    this.openSubMenu(menu, position);
                }
                else {
                    this.activateMenu(menu);
                }
            }
        }
        onMouseOver(menu, position) {
            if (menu.isEnabled(this.env)) {
                if (this.isRoot(menu)) {
                    this.openSubMenu(menu, position);
                }
                else {
                    this.subMenu.isOpen = false;
                }
            }
        }
    }
    Menu.template = TEMPLATE$6;
    Menu.components = { Menu };
    Menu.style = CSS$5;
    Menu.defaultProps = {
        depth: 1,
    };

    const { Component: Component$7 } = owl__namespace;
    const { xml: xml$8, css: css$7 } = owl.tags;
    const { useState: useState$5 } = owl.hooks;
    // -----------------------------------------------------------------------------
    // SpreadSheet
    // -----------------------------------------------------------------------------
    const TEMPLATE$7 = xml$8 /* xml */ `
  <div class="o-spreadsheet-bottom-bar">
    <div class="o-sheet-item o-add-sheet" t-on-click="addSheet">${PLUS}</div>
    <div class="o-sheet-item o-list-sheets" t-on-click="listSheets">${LIST}</div>
    <div class="o-all-sheets">
      <t t-foreach="getters.getSheets()" t-as="sheet" t-key="sheet.id">
        <div class="o-sheet-item o-sheet" t-on-click="activateSheet(sheet.id)"
             t-on-contextmenu.prevent="onContextMenu(sheet.id)"
             t-att-title="sheet.name"
             t-att-data-id="sheet.id"
             t-att-class="{active: sheet.id === getters.getActiveSheetId()}">
          <span class="o-sheet-name" t-esc="sheet.name" t-on-dblclick="onDblClick(sheet.id)"/>
          <span class="o-sheet-icon" t-on-click.stop="onIconClick(sheet.id)">${TRIANGLE_DOWN_ICON}</span>
        </div>
      </t>
    </div>
    <t t-set="aggregate" t-value="getters.getAggregate()"/>
    <div t-if="aggregate !== null" class="o-aggregate">Sum: <t t-esc="aggregate"/></div>
    <Menu t-if="menuState.isOpen"
          position="menuState.position"
          menuItems="menuState.menuItems"
          t-on-close="menuState.isOpen=false"/>
  </div>`;
    const CSS$6 = css$7 /* scss */ `
  .o-spreadsheet-bottom-bar {
    background-color: ${BACKGROUND_GRAY_COLOR};
    padding-left: ${HEADER_WIDTH}px;
    display: flex;
    align-items: center;
    font-size: 15px;
    border-top: 1px solid lightgrey;
    overflow: hidden;

    .o-add-sheet,
    .o-list-sheets {
      margin-right: 5px;
    }

    .o-sheet-item {
      display: flex;
      align-items: center;
      padding: 5px;
      cursor: pointer;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }

    .o-all-sheets {
      display: flex;
      align-items: center;
      max-width: 80%;
      overflow: hidden;
    }

    .o-sheet {
      color: #666;
      padding: 0 15px;
      padding-right: 10px;
      height: ${BOTTOMBAR_HEIGHT}px;
      line-height: ${BOTTOMBAR_HEIGHT}px;
      user-select: none;
      white-space: nowrap;

      &.active {
        color: #484;
        background-color: white;
        box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
      }

      .o-sheet-icon {
        margin-left: 5px;

        &:hover {
          background-color: rgba(0, 0, 0, 0.08);
        }
      }
    }

    .o-aggregate {
      background-color: white;
      margin-left: auto;
      font-size: 14px;
      margin-right: 20px;
      padding: 4px 8px;
      color: #333;
      border-radius: 3px;
      box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
    }
    .fade-enter-active {
      transition: opacity 0.5s;
    }

    .fade-enter {
      opacity: 0;
    }
  }
`;
    class BottomBar extends Component$7 {
        constructor() {
            super(...arguments);
            this.getters = this.env.getters;
            this.menuState = useState$5({ isOpen: false, position: null, menuItems: [] });
        }
        mounted() {
            this.focusSheet();
        }
        patched() {
            this.focusSheet();
        }
        focusSheet() {
            const div = this.el.querySelector(`[data-id="${this.getters.getActiveSheetId()}"]`);
            if (div && div.scrollIntoView) {
                div.scrollIntoView();
            }
        }
        addSheet() {
            const position = this.env.getters
                .getVisibleSheets()
                .findIndex((sheetId) => sheetId === this.env.getters.getActiveSheetId()) + 1;
            this.env.dispatch("CREATE_SHEET", { activate: true, sheetId: uuidv4(), position });
        }
        listSheets(ev) {
            const registry = new MenuItemRegistry();
            const from = this.getters.getActiveSheetId();
            let i = 0;
            for (let sheet of this.getters.getSheets()) {
                registry.add(sheet.id, {
                    name: sheet.name,
                    sequence: i,
                    action: (env) => env.dispatch("ACTIVATE_SHEET", { sheetIdFrom: from, sheetIdTo: sheet.id }),
                });
                i++;
            }
            this.openContextMenu(ev.currentTarget, registry);
        }
        activateSheet(name) {
            this.env.dispatch("ACTIVATE_SHEET", {
                sheetIdFrom: this.getters.getActiveSheetId(),
                sheetIdTo: name,
            });
        }
        onDblClick(sheetId) {
            this.env.dispatch("RENAME_SHEET", { interactive: true, sheetId });
        }
        openContextMenu(target, registry) {
            const x = target.offsetLeft;
            const y = target.offsetTop;
            this.menuState.isOpen = true;
            this.menuState.menuItems = registry.getAll().filter((x) => x.isVisible(this.env));
            this.menuState.position = {
                x,
                y,
                height: 400,
                width: this.el.clientWidth,
            };
        }
        onIconClick(sheet, ev) {
            if (this.getters.getActiveSheetId() !== sheet) {
                this.activateSheet(sheet);
            }
            if (this.menuState.isOpen) {
                this.menuState.isOpen = false;
            }
            else {
                this.openContextMenu(ev.currentTarget.parentElement, sheetMenuRegistry);
            }
        }
        onContextMenu(sheet, ev) {
            if (this.getters.getActiveSheetId() !== sheet) {
                this.activateSheet(sheet);
            }
            this.openContextMenu(ev.currentTarget, sheetMenuRegistry);
        }
    }
    BottomBar.template = TEMPLATE$7;
    BottomBar.style = CSS$6;
    BottomBar.components = { Menu };

    function startDnd(onMouseMove, onMouseUp) {
        const _onMouseUp = (ev) => {
            onMouseUp(ev);
            window.removeEventListener("mouseup", _onMouseUp);
            window.removeEventListener("dragstart", _onDragStart);
            window.removeEventListener("mousemove", onMouseMove);
        };
        function _onDragStart(ev) {
            ev.preventDefault();
        }
        window.addEventListener("mouseup", _onMouseUp);
        window.addEventListener("dragstart", _onDragStart);
        window.addEventListener("mousemove", onMouseMove);
    }

    const { Component: Component$8 } = owl__namespace;
    const { xml: xml$9, css: css$8 } = owl.tags;
    const { useState: useState$6 } = owl.hooks;
    // -----------------------------------------------------------------------------
    // Autofill
    // -----------------------------------------------------------------------------
    const TEMPLATE$8 = xml$9 /* xml */ `
  <div class="o-autofill" t-on-mousedown="onMouseDown" t-att-style="style" t-on-dblclick="onDblClick">
    <div class="o-autofill-handler" t-att-style="styleHandler"/>
    <t t-set="tooltip" t-value="getTooltip()"/>
    <div t-if="tooltip" class="o-autofill-nextvalue" t-att-style="styleNextvalue">
      <t t-component="tooltip.component" t-props="tooltip.props"/>
    </div>
  </div>
`;
    const CSS$7 = css$8 /* scss */ `
  .o-autofill {
    height: 6px;
    width: 6px;
    border: 1px solid white;
    position: absolute;
    background-color: #1a73e8;

    .o-autofill-handler {
      position: absolute;
      height: 8px;
      width: 8px;

      &:hover {
        cursor: crosshair;
      }
    }

    .o-autofill-nextvalue {
      position: absolute;
      background-color: white;
      border: 1px solid black;
      padding: 5px;
      font-size: 12px;
      pointer-events: none;
      white-space: nowrap;
    }
  }
`;
    class Autofill extends Component$8 {
        constructor() {
            super(...arguments);
            this.state = useState$6({
                position: { left: 0, top: 0 },
                handler: false,
            });
        }
        get style() {
            const { left, top } = this.props.position;
            return `top:${top}px;left:${left}px`;
        }
        get styleHandler() {
            let position = this.state.handler ? this.state.position : { left: 0, top: 0 };
            return `top:${position.top}px;left:${position.left}px;`;
        }
        get styleNextvalue() {
            let position = this.state.handler ? this.state.position : { left: 0, top: 0 };
            return `top:${position.top + 5}px;left:${position.left + 15}px;`;
        }
        getTooltip() {
            const tooltip = this.env.getters.getAutofillTooltip();
            if (tooltip && !tooltip.component) {
                tooltip.component = TooltipComponent;
            }
            return tooltip;
        }
        onMouseDown(ev) {
            this.state.handler = true;
            this.state.position = { left: 0, top: 0 };
            const start = { left: ev.clientX, top: ev.clientY };
            let lastCol;
            let lastRow;
            const onMouseUp = () => {
                this.state.handler = false;
                this.env.dispatch("AUTOFILL");
            };
            const onMouseMove = (ev) => {
                this.state.position = {
                    left: ev.clientX - start.left,
                    top: ev.clientY - start.top,
                };
                const parent = this.el.parentElement;
                const position = parent.getBoundingClientRect();
                const col = this.env.getters.getColIndex(ev.clientX - position.left, this.props.viewport.left);
                const row = this.env.getters.getRowIndex(ev.clientY - position.top, this.props.viewport.top);
                if (lastCol !== col || lastRow !== row) {
                    const activeSheet = this.env.getters.getActiveSheet();
                    lastCol = col === -1 ? lastCol : clip(col, 0, activeSheet.cols.length);
                    lastRow = row === -1 ? lastRow : clip(row, 0, activeSheet.rows.length);
                    if (lastCol !== undefined && lastRow !== undefined) {
                        this.env.dispatch("AUTOFILL_SELECT", { col: lastCol, row: lastRow });
                    }
                }
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onDblClick() {
            this.env.dispatch("AUTOFILL_AUTO");
        }
    }
    Autofill.template = TEMPLATE$8;
    Autofill.style = CSS$7;
    class TooltipComponent extends Component$8 {
    }
    TooltipComponent.template = xml$9 /* xml */ `
    <div t-esc="props.content"/>
  `;

    const { Component: Component$9, useState: useState$7 } = owl__namespace;
    const { xml: xml$a, css: css$9 } = owl.tags;
    const functions$4 = functionRegistry.content;
    const providerRegistry = new Registry();
    providerRegistry.add("functions", async function () {
        return Object.keys(functions$4).map((key) => {
            return {
                text: key,
                description: functions$4[key].description,
            };
        });
    });
    // -----------------------------------------------------------------------------
    // Autocomplete DropDown component
    // -----------------------------------------------------------------------------
    const TEMPLATE$9 = xml$a /* xml */ `
  <div t-att-class="{'o-autocomplete-dropdown':state.values.length}" >
    <t t-foreach="state.values" t-as="v" t-key="v.text">
        <div t-att-class="{'o-autocomplete-value-focus': state.selectedIndex === v_index}" t-on-click.stop.prevent="fillValue(v_index)">
             <div class="o-autocomplete-value" t-esc="v.text"/>
             <div class="o-autocomplete-description" t-esc="v.description" t-if="state.selectedIndex === v_index"/>
        </div>
    </t>
  </div>`;
    const CSS$8 = css$9 /* scss */ `
  .o-autocomplete-dropdown {
    width: 300px;
    margin: 4px;
    background-color: #fff;
    box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);

    & > div:hover {
      background-color: #f2f2f2;
    }
    .o-autocomplete-value-focus {
      background-color: rgba(0, 0, 0, 0.08);
    }

    & > div {
      display: flex;
      flex-direction: column;
      padding: 1px 0 5px 5px;
      .o-autocomplete-description {
        padding: 0 0 0 5px;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
`;
    class TextValueProvider extends Component$9 {
        constructor() {
            super(...arguments);
            this.state = useState$7({
                values: [],
                selectedIndex: 0,
            });
        }
        mounted() {
            this.filter(this.props.search);
        }
        willUpdateProps(nextProps) {
            if (nextProps.search !== this.props.search) {
                this.filter(nextProps.search);
            }
            return super.willUpdateProps(nextProps);
        }
        async filter(searchTerm) {
            const provider = providerRegistry.get(this.props.provider);
            let values = await provider();
            if (this.props.filter) {
                values = this.props.filter(searchTerm, values);
            }
            else {
                values = values
                    .filter((t) => t.text.toUpperCase().startsWith(searchTerm.toUpperCase()))
                    .sort((l, r) => (l.text < r.text ? -1 : l.text > r.text ? 1 : 0));
            }
            this.state.values = values.slice(0, 10);
            this.state.selectedIndex = 0;
        }
        fillValue(index) {
            this.state.selectedIndex = index;
            this.trigger("completed", { text: this.getValueToFill() });
        }
        moveDown() {
            this.state.selectedIndex = (this.state.selectedIndex + 1) % this.state.values.length;
        }
        moveUp() {
            this.state.selectedIndex--;
            if (this.state.selectedIndex < 0) {
                this.state.selectedIndex = this.state.values.length - 1;
            }
        }
        getValueToFill() {
            if (this.state.values.length) {
                return this.state.values[this.state.selectedIndex].text;
            }
        }
    }
    TextValueProvider.template = TEMPLATE$9;
    TextValueProvider.style = CSS$8;

    class ContentEditableHelper {
        constructor(el) {
            this.el = el;
        }
        updateEl(el) {
            this.el = el;
        }
        /**
         * select the text at position start to end, no matter the children
         */
        selectRange(start, end) {
            let selection = window.getSelection();
            this.removeSelection();
            let range = document.createRange();
            if (start == end && start === 0) {
                range.setStart(this.el, 0);
                range.setEnd(this.el, 0);
            }
            else {
                if (start < 0 || end > this.el.textContent.length) {
                    console.warn(`wrong selection asked start ${start}, end ${end}, text content length ${this.el.textContent.length}`);
                    if (start < 0)
                        start = 0;
                    if (end > this.el.textContent.length)
                        end = this.el.textContent.length;
                }
                let startNode = this.findChildAtCharacterIndex(start);
                let endNode = this.findChildAtCharacterIndex(end);
                range.setStart(startNode.node, startNode.offset);
                range.setEnd(endNode.node, endNode.offset);
            }
            selection.addRange(range);
        }
        /**
         * finds the dom element that contains the character at `offset`
         */
        findChildAtCharacterIndex(offset) {
            let it = this.iterateChildren(this.el);
            let current, previous;
            let usedCharacters = offset;
            do {
                current = it.next();
                if (!current.done && !current.value.hasChildNodes()) {
                    if (current.value.textContent && current.value.textContent.length < usedCharacters) {
                        usedCharacters -= current.value.textContent.length;
                    }
                    else {
                        it.return(current.value);
                    }
                    previous = current.value;
                }
            } while (!current.done);
            if (current.value) {
                return { node: current.value, offset: usedCharacters };
            }
            return { node: previous, offset: usedCharacters };
        }
        /**
         * Iterate over the dom tree starting at `el` and over all the children depth first.
         * */
        *iterateChildren(el) {
            yield el;
            if (el.hasChildNodes()) {
                for (let child of el.childNodes) {
                    yield* this.iterateChildren(child);
                }
            }
        }
        /**
         * insert text at the current selection point. If a selection of 1 or more elements is done,
         * the selection is replaced by the text to be inserted
         * */
        insertText(value, color) {
            if (!value)
                return;
            if (document.activeElement === this.el) {
                document.execCommand("foreColor", false, color);
                document.execCommand("insertText", false, value);
            }
            else {
                const span = document.createElement("span");
                span.innerText = value;
                if (color) {
                    span.style.color = color;
                }
                this.el.appendChild(span);
            }
        }
        /**
         * remove the current selection of the user
         * */
        removeSelection() {
            let selection = window.getSelection();
            selection.removeAllRanges();
        }
        removeAll() {
            if (this.el) {
                while (this.el.firstChild) {
                    this.el.removeChild(this.el.firstChild);
                }
            }
        }
        /**
         * finds the indexes of the current selection.
         * */
        getCurrentSelection() {
            let { startElement, endElement, startSelectionOffset, endSelectionOffset, } = this.getStartAndEndSelection();
            let startSizeBefore = this.findSizeBeforeElement(startElement);
            let endSizeBefore = this.findSizeBeforeElement(endElement);
            return {
                start: startSizeBefore + startSelectionOffset,
                end: endSizeBefore + endSelectionOffset,
            };
        }
        findSizeBeforeElement(nodeToFind) {
            let it = this.iterateChildren(this.el);
            let usedCharacters = 0;
            let current = it.next();
            while (!current.done && current.value !== nodeToFind) {
                if (!current.value.hasChildNodes()) {
                    if (current.value.textContent) {
                        usedCharacters += current.value.textContent.length;
                    }
                }
                current = it.next();
            }
            return usedCharacters;
        }
        getStartAndEndSelection() {
            const selection = document.getSelection();
            const range = selection.getRangeAt(0);
            return {
                startElement: range.startContainer,
                startSelectionOffset: range.startOffset,
                endElement: range.endContainer,
                endSelectionOffset: range.endOffset,
            };
        }
    }

    const formulaAssistantTerms = {
        ABOUT: _lt("ABOUT"),
        OPTIONAL: _lt("optional"),
        BY_DEFAULT: _lt("by default"),
        REPEATABLE: _lt("repeatable"),
    };

    const { Component: Component$a } = owl__namespace;
    const { xml: xml$b, css: css$a } = owl.tags;
    const { useState: useState$8 } = owl.hooks;
    // -----------------------------------------------------------------------------
    // Formula Assistant component
    // -----------------------------------------------------------------------------
    const TEMPLATE$a = xml$b /* xml */ `
  <div class="o-formula-assistant-container"
       t-att-class="{'o-formula-assistant-event-none': assistantState.allowCellSelectionBehind}">
    <t t-set="context" t-value="getContext()"/>
    <div class="o-formula-assistant" t-if="context.functionName" t-on-mousemove="onMouseMove"
         t-att-class="{'o-formula-assistant-transparency': assistantState.allowCellSelectionBehind}">

      <div class="o-formula-assistant-head">
        <span t-esc="context.functionName"/> (
        <t t-foreach="context.functionDescription.args" t-as="arg" t-key="arg.name" >
          <span t-if="arg_index > '0'" >, </span>
          <span t-att-class="{ 'o-formula-assistant-focus': context.argToFocus === arg_index }" >
            <span>
              <span t-if="arg.optional || arg.repeating || arg.default">[</span>
              <span t-esc="arg.name" />
              <span t-if="arg.repeating">, ...</span>
              <span t-if="arg.optional || arg.repeating || arg.default">]</span>
            </span>
          </span>
        </t> )
      </div>

      <div class="o-formula-assistant-core">
        <div class="o-formula-assistant-gray" t-esc="env._t('${formulaAssistantTerms.ABOUT}')"/>
        <div t-esc="context.functionDescription.description"/>
      </div>

      <t t-foreach="context.functionDescription.args" t-as="arg" t-key="arg.name">
        <div class="o-formula-assistant-arg"
            t-att-class="{
              'o-formula-assistant-gray': context.argToFocus >= '0',
              'o-formula-assistant-focus': context.argToFocus === arg_index,
            }" >
          <div>
            <span t-esc="arg.name" />
            <span t-if="arg.optional || arg.repeating || arg.default "> - [<t t-esc="env._t('${formulaAssistantTerms.OPTIONAL}')"/>] </span>
            <span t-if="arg.default">
              <t t-esc="arg.defaultValue" />
              <t t-esc="env._t(' ${formulaAssistantTerms.BY_DEFAULT}')"/>
            </span>
            <span t-if="arg.repeating" t-esc="env._t('${formulaAssistantTerms.REPEATABLE}')"/>
          </div>
          <div class="o-formula-assistant-arg-description" t-esc="arg.description"/>
        </div>
      </t>

    </div>
  </div>
`;
    const CSS$9 = css$a /* scss */ `
  .o-formula-assistant {
    width: 300px;
    background-color: #fff;
    box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);
    margin: 4px;
    white-space: normal;
    .o-formula-assistant-head {
      background-color: #f2f2f2;
      padding: 10px;
    }
    .o-formula-assistant-core {
      padding: 0px 0px 10px 0px;
      margin: 10px;
      border-bottom: 1px solid gray;
    }
    .o-formula-assistant-arg {
      padding: 0px 10px 10px 10px;
      display: flex;
      flex-direction: column;
    }
    .o-formula-assistant-arg-description {
      font-size: 85%;
    }
    .o-formula-assistant-focus {
      div:first-child,
      span {
        color: purple;
        text-shadow: 0px 0px 1px purple;
      }
      div:last-child {
        color: black;
      }
    }
    .o-formula-assistant-gray {
      color: gray;
    }
  }
  .o-formula-assistant-container {
    position: absolute;
    user-select: none;
  }
  .o-formula-assistant-event-none {
    pointer-events: none;
  }
  .o-formula-assistant-transparency {
    opacity: 0.3;
  }
`;
    class FunctionDescriptionProvider extends Component$a {
        constructor() {
            super(...arguments);
            this.assistantState = useState$8({
                allowCellSelectionBehind: false,
            });
            this.timeOutId = 0;
        }
        willUnmount() {
            if (this.timeOutId) {
                clearTimeout(this.timeOutId);
            }
        }
        getContext() {
            return this.props;
        }
        onMouseMove() {
            this.assistantState.allowCellSelectionBehind = true;
            if (this.timeOutId) {
                clearTimeout(this.timeOutId);
            }
            this.timeOutId = setTimeout(() => {
                this.assistantState.allowCellSelectionBehind = false;
            }, 2000);
        }
    }
    FunctionDescriptionProvider.template = TEMPLATE$a;
    FunctionDescriptionProvider.style = CSS$9;

    const { Component: Component$b } = owl__namespace;
    const { useRef: useRef$1, useState: useState$9 } = owl.hooks;
    const { xml: xml$c, css: css$b } = owl.tags;
    const functions$5 = functionRegistry.content;
    const FunctionColor = "#4a4e4d";
    const OperatorColor = "#3da4ab";
    const StringColor = "#f6cd61";
    const NumberColor = "#02c39a";
    const MatchingParenColor = "pink";
    const SelectionIndicatorColor = "lightgrey";
    const tokenColor = {
        OPERATOR: OperatorColor,
        NUMBER: NumberColor,
        STRING: StringColor,
        BOOLEAN: NumberColor,
        FUNCTION: FunctionColor,
        DEBUGGER: OperatorColor,
        LEFT_PAREN: OperatorColor,
        RIGHT_PAREN: OperatorColor,
    };
    const TEMPLATE$b = xml$c /* xml */ `
<div class="o-composer-container">
    <div class="o-composer"
      t-att-style="props.inputStyle"
      t-ref="o_composer"
      tabindex="1"
      contenteditable="true"
      spellcheck="false"

      t-on-keydown="onKeydown"
      t-on-beforeinput="onBeforeinput"
      t-on-mousedown="onMousedown"
      t-on-input="onInput"
      t-on-keyup="onKeyup"

      t-on-click.stop="onClick"
    />
    <TextValueProvider
        t-if="autoCompleteState.showProvider and props.focus"
        t-ref="o_autocomplete_provider"
        search="autoCompleteState.search"
        provider="autoCompleteState.provider"
        t-on-completed="onCompleted"
    />
    <FunctionDescriptionProvider
        t-if="functionDescriptionState.showDescription and props.focus"
        t-ref="o_function_description_provider"
        functionName = "functionDescriptionState.functionName"
        functionDescription = "functionDescriptionState.functionDescription"
        argToFocus = "functionDescriptionState.argToFocus"
    />
</div>
  `;
    const CSS$a = css$b /* scss */ `
  .o-composer-container {
    padding: 0;
    margin: 0;
    border: 0;
    z-index: 5;
    flex-grow: 1;
    .o-composer {
      caret-color: black;
      padding-left: 2px;
      padding-right: 2px;
      word-break: break-all;
      &:focus {
        outline: none;
      }
    }
  }
`;
    class Composer extends Component$b {
        constructor() {
            super(...arguments);
            this.composerRef = useRef$1("o_composer");
            this.autoCompleteRef = useRef$1("o_autocomplete_provider");
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.autoCompleteState = useState$9({
                showProvider: false,
                provider: "functions",
                search: "",
            });
            this.functionDescriptionState = useState$9({
                showDescription: false,
                functionName: "",
                functionDescription: {},
                argToFocus: 0,
            });
            // we can't allow input events to be triggered while we remove and add back the content of the composer in processContent
            this.shouldProcessInputEvents = false;
            this.tokens = [];
            this.keyMapping = {
                ArrowUp: this.processArrowKeys,
                ArrowDown: this.processArrowKeys,
                ArrowLeft: this.processArrowKeys,
                ArrowRight: this.processArrowKeys,
                Enter: this.processEnterKey,
                Escape: this.processEscapeKey,
                F2: () => console.warn("Not implemented"),
                F4: () => console.warn("Not implemented"),
                Tab: (ev) => this.processTabKey(ev),
            };
            this.contentHelper = new ContentEditableHelper(this.composerRef.el);
        }
        mounted() {
            DEBUG.composer = this;
            const el = this.composerRef.el;
            this.contentHelper.updateEl(el);
            this.processContent(this.props.focus);
        }
        willUnmount() {
            delete DEBUG.composer;
            this.trigger("composer-unmounted");
        }
        async willUpdateProps(nextProps) {
            this.processContent(nextProps.focus);
        }
        // ---------------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------------
        processArrowKeys(ev) {
            if (this.getters.isSelectingForComposer()) {
                this.functionDescriptionState.showDescription = false;
                return;
            }
            ev.stopPropagation();
            const autoCompleteComp = this.autoCompleteRef.comp;
            if (["ArrowUp", "ArrowDown"].includes(ev.key) &&
                this.autoCompleteState.showProvider &&
                autoCompleteComp) {
                ev.preventDefault();
                if (ev.key === "ArrowUp") {
                    autoCompleteComp.moveUp();
                }
                else {
                    autoCompleteComp.moveDown();
                }
            }
        }
        processTabKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const autoCompleteComp = this.autoCompleteRef.comp;
            if (this.autoCompleteState.showProvider && autoCompleteComp) {
                const autoCompleteValue = autoCompleteComp.getValueToFill();
                if (autoCompleteValue) {
                    this.autoComplete(autoCompleteValue);
                    return;
                }
            }
            else {
                // when completing with tab, if there is no value to complete, the active cell will be moved to the right.
                // we can't let the model think that it is for a ref selection.
                // todo: check if this can be removed someday
                this.dispatch("STOP_COMPOSER_SELECTION");
            }
            const deltaX = ev.shiftKey ? -1 : 1;
            this.dispatch("MOVE_POSITION", { deltaX, deltaY: 0 });
        }
        processEnterKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const autoCompleteComp = this.autoCompleteRef.comp;
            if (this.autoCompleteState.showProvider && autoCompleteComp) {
                const autoCompleteValue = autoCompleteComp.getValueToFill();
                if (autoCompleteValue) {
                    this.autoComplete(autoCompleteValue);
                    return;
                }
            }
            this.dispatch("STOP_EDITION");
            this.dispatch("MOVE_POSITION", {
                deltaX: 0,
                deltaY: ev.shiftKey ? -1 : 1,
            });
        }
        processEscapeKey() {
            this.dispatch("STOP_EDITION", { cancel: true });
        }
        onKeydown(ev) {
            let handler = this.keyMapping[ev.key];
            if (handler) {
                return handler.call(this, ev);
            }
            ev.stopPropagation();
        }
        onBeforeinput() {
            this.dispatch("STOP_COMPOSER_SELECTION");
        }
        /*
         * Triggered automatically by the content-editable between the keydown and key up
         * */
        onInput() {
            if (!this.props.focus || !this.shouldProcessInputEvents) {
                return;
            }
            const el = this.composerRef.el;
            this.dispatch("SET_CURRENT_CONTENT", {
                content: el.childNodes.length ? el.textContent : "",
                selection: this.contentHelper.getCurrentSelection(),
            });
        }
        onKeyup(ev) {
            if (!this.props.focus || ["Control", "Shift", "Tab", "Enter"].includes(ev.key)) {
                return;
            }
            if (this.autoCompleteState.showProvider && ["ArrowUp", "ArrowDown"].includes(ev.key)) {
                return; // already processed in keydown
            }
            if (this.getters.isSelectingForComposer() &&
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
                return; // already processed in keydown
            }
            ev.preventDefault();
            ev.stopPropagation();
            this.autoCompleteState.showProvider = false;
            if (ev.ctrlKey && ev.key === " ") {
                this.autoCompleteState.search = "";
                this.autoCompleteState.showProvider = true;
                this.dispatch("STOP_COMPOSER_SELECTION");
                return;
            }
            this.dispatch("CHANGE_COMPOSER_SELECTION", this.contentHelper.getCurrentSelection());
            this.processTokenAtCursor();
        }
        onMousedown(ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            this.contentHelper.removeSelection();
        }
        onClick() {
            if (!this.props.focus) {
                this.trigger("composer-focused", {
                    selection: this.contentHelper.getCurrentSelection(),
                });
            }
            this.dispatch("STOP_COMPOSER_SELECTION");
            this.dispatch("CHANGE_COMPOSER_SELECTION", this.contentHelper.getCurrentSelection());
            this.processTokenAtCursor();
        }
        onCompleted(ev) {
            this.autoComplete(ev.detail.text);
        }
        // ---------------------------------------------------------------------------
        // Private
        // ---------------------------------------------------------------------------
        processContent(isFocused) {
            this.shouldProcessInputEvents = false;
            let value = this.getters.getCurrentContent();
            this.contentHelper.removeAll(); // remove the content of the composer, to be added just after
            if (isFocused) {
                this.contentHelper.selectRange(0, 0); // move the cursor inside the composer at 0 0.
            }
            const { start, end } = this.getters.getComposerSelection();
            if (value.startsWith("=")) {
                this.tokens = composerTokenize(value);
                const tokenAtCursor = this.getters.getTokenAtCursor();
                for (let token of this.tokens) {
                    switch (token.type) {
                        case "OPERATOR":
                        case "NUMBER":
                        case "FUNCTION":
                        case "COMMA":
                        case "BOOLEAN":
                            this.contentHelper.insertText(token.value, this.tokenColor(token.type));
                            break;
                        case "SYMBOL":
                            let value = token.value;
                            const [xc, sheet] = value.split("!").reverse();
                            if (rangeReference.test(xc)) {
                                this.contentHelper.insertText(value, this.rangeColor(xc, sheet));
                            }
                            else {
                                this.contentHelper.insertText(value, "#000");
                            }
                            break;
                        case "LEFT_PAREN":
                        case "RIGHT_PAREN":
                            // Compute the matching parenthesis
                            if (tokenAtCursor &&
                                ["LEFT_PAREN", "RIGHT_PAREN"].includes(tokenAtCursor.type) &&
                                tokenAtCursor.parenIndex &&
                                tokenAtCursor.parenIndex === token.parenIndex) {
                                this.contentHelper.insertText(token.value, this.parenthesisColor());
                            }
                            else {
                                this.contentHelper.insertText(token.value);
                            }
                            break;
                        case "UNKNOWN":
                            if (token.value === SelectionIndicator) {
                                this.contentHelper.insertText(token.value, SelectionIndicatorColor);
                            }
                            else {
                                this.contentHelper.insertText(token.value);
                            }
                            break;
                        default:
                            this.contentHelper.insertText(token.value);
                            break;
                    }
                }
                // Put the cursor back where it was
            }
            else {
                this.contentHelper.insertText(value);
            }
            if (isFocused) {
                this.contentHelper.selectRange(start, end);
            }
            if (this.composerRef.el.clientWidth !== this.composerRef.el.scrollWidth) {
                this.trigger("content-width-changed", {
                    newWidth: this.composerRef.el.scrollWidth,
                });
            }
            if (this.composerRef.el.clientHeight !== this.composerRef.el.scrollHeight) {
                this.trigger("content-height-changed", {
                    newHeight: this.composerRef.el.scrollHeight,
                });
            }
            this.shouldProcessInputEvents = true;
        }
        rangeColor(xc, sheetName) {
            if (this.getters.getEditionMode() === "inactive") {
                return undefined;
            }
            const highlights = this.getters.getHighlights();
            const refSheet = sheetName
                ? this.getters.getSheetIdByName(sheetName)
                : this.getters.getEditionSheet();
            const highlight = highlights.find((highlight) => zoneToXc(highlight.zone) == xc.replace(/\$/g, "") && highlight.sheet === refSheet);
            return highlight && highlight.color ? highlight.color : undefined;
        }
        tokenColor(tokenType) {
            return this.getters.getEditionMode() !== "inactive" ? tokenColor[tokenType] : undefined;
        }
        parenthesisColor() {
            return this.getters.getEditionMode() !== "inactive" ? MatchingParenColor : undefined;
        }
        /**
         * Compute the state of the composer from the tokenAtCursor.
         * If the token is a function or symbol (that isn't a cell/range reference) we have to initialize
         * the autocomplete engine otherwise we initialize the formula assistant.
         */
        processTokenAtCursor() {
            let content = this.getters.getCurrentContent();
            this.autoCompleteState.showProvider = false;
            this.functionDescriptionState.showDescription = false;
            if (content.startsWith("=")) {
                const tokenAtCursor = this.getters.getTokenAtCursor();
                if (tokenAtCursor) {
                    const [xc] = tokenAtCursor.value.split("!").reverse();
                    if (tokenAtCursor.type === "FUNCTION" ||
                        (tokenAtCursor.type === "SYMBOL" && !rangeReference.test(xc))) {
                        // initialize Autocomplete Dropdown
                        this.autoCompleteState.search = tokenAtCursor.value;
                        this.autoCompleteState.showProvider = true;
                    }
                    else if (tokenAtCursor.functionContext && tokenAtCursor.type !== "UNKNOWN") {
                        // initialize Formula Assistant
                        const tokenContext = tokenAtCursor.functionContext;
                        const parentFunction = tokenContext.parent.toUpperCase();
                        const description = functions$5[parentFunction];
                        const argPosition = tokenContext.argPosition;
                        this.functionDescriptionState = {
                            functionName: parentFunction,
                            functionDescription: description,
                            argToFocus: description.getArgToFocus(argPosition + 1) - 1,
                            showDescription: true,
                        };
                    }
                }
            }
        }
        autoComplete(value) {
            if (value) {
                const tokenAtCursor = this.getters.getTokenAtCursor();
                if (tokenAtCursor) {
                    let start = tokenAtCursor.end;
                    let end = tokenAtCursor.end;
                    if (["SYMBOL", "FUNCTION"].includes(tokenAtCursor.type)) {
                        start = tokenAtCursor.start;
                    }
                    if (this.autoCompleteState.provider && this.tokens.length) {
                        value += "(";
                        const currentTokenIndex = this.tokens
                            .map((token) => token.start)
                            .indexOf(tokenAtCursor.start);
                        if (currentTokenIndex + 1 < this.tokens.length) {
                            const nextToken = this.tokens[currentTokenIndex + 1];
                            if (nextToken.type === "LEFT_PAREN") {
                                end++;
                            }
                        }
                    }
                    this.dispatch("CHANGE_COMPOSER_SELECTION", {
                        start,
                        end,
                    });
                }
                this.dispatch("REPLACE_COMPOSER_SELECTION", {
                    text: value,
                });
            }
            this.processTokenAtCursor();
        }
    }
    Composer.template = TEMPLATE$b;
    Composer.style = CSS$a;
    Composer.components = { TextValueProvider, FunctionDescriptionProvider };
    Composer.defaultProps = {
        inputStyle: "",
        focus: false,
    };

    const { Component: Component$c } = owl__namespace;
    const { xml: xml$d, css: css$c } = owl.tags;
    const SCROLLBAR_WIDTH$1 = 14;
    const SCROLLBAR_HIGHT = 15;
    const TEMPLATE$c = xml$d /* xml */ `
  <div class="o-grid-composer" t-att-style="containerStyle">
    <Composer
      focus="props.focus"
      inputStyle="composerStyle"
      t-on-keydown="onKeydown"
      t-on-content-width-changed="onWidthChanged"
      t-on-content-height-changed="onHeigthChanged"
    />
  </div>
`;
    const COMPOSER_BORDER_WIDTH = 3 * 0.4 * window.devicePixelRatio || 1;
    const CSS$b = css$c /* scss */ `
  .o-grid-composer {
    box-sizing: border-box;
    position: absolute;
    border: ${COMPOSER_BORDER_WIDTH}px solid #3266ca;
    white-space: nowrap;
  }
`;
    /**
     * This component is a composer which positions itself on the grid at the anchor cell.
     * It also applies the style of the cell to the composer input.
     */
    class GridComposer extends Component$c {
        constructor() {
            super(...arguments);
            this.getters = this.env.getters;
            const [col, row] = this.getters.getPosition();
            this.zone = this.getters.expandZone(this.getters.getActiveSheetId(), {
                left: col,
                right: col,
                top: row,
                bottom: row,
            });
            this.rect = this.getters.getRect(this.zone, this.props.viewport);
        }
        get containerStyle() {
            const isFormula = this.getters.getCurrentContent().startsWith("=");
            const style = this.getters.getCurrentStyle();
            const fillColor = isFormula ? "#ffffff" : style.fillColor || "#ffffff";
            const textColor = style.textColor;
            const [x, y, width, height] = this.rect;
            const weight = `font-weight:${style.bold ? "bold" : 500};`;
            const italic = style.italic ? `font-style: italic;` : ``;
            const strikethrough = style.strikethrough ? `text-decoration:line-through;` : ``;
            let composerStyle = `left: ${x - 1}px;
        top:${y}px;
        height:${height + 1}px;
        width:${width}px;
        font-size:${fontSizeMap[style.fontSize || 10]}px;
        ${weight}${italic}${strikethrough}`;
            composerStyle = composerStyle + `background: ${fillColor};`;
            if (textColor && !isFormula) {
                composerStyle = composerStyle + `color: ${textColor}`;
            }
            return composerStyle;
        }
        get composerStyle() {
            const style = this.getters.getCurrentStyle();
            const cell = this.getters.getActiveCell() || { type: "text" };
            const height = this.rect[3] - COMPOSER_BORDER_WIDTH * 2 + 1;
            const align = "align" in style ? style.align : cell.type === "number" ? "right" : "left";
            return `text-align:${align};
        height: ${height}px;
        line-height:${height}px;`;
        }
        mounted() {
            const el = this.el;
            const width = Math.max(el.scrollWidth, this.rect[2]);
            this.resizeWidth(width, 0);
            const height = Math.max(el.scrollHeight, this.rect[3]);
            this.resizeHeigth(height);
        }
        onWidthChanged(ev) {
            const paddingWidth = this.props.focus ? 40 : 0;
            this.resizeWidth(ev.detail.newWidth + paddingWidth, 10);
        }
        onHeigthChanged(ev) {
            const paddingHeight = this.props.focus ? 2 : 0;
            this.resizeHeigth(ev.detail.newHeight + paddingHeight);
        }
        onKeydown(ev) {
            // In selecting mode, arrows should not move the cursor but it should
            // select adjacent cells on the grid.
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
                ev.preventDefault();
            }
        }
        resizeWidth(width, step) {
            const el = this.el;
            const maxWidth = el.parentElement.clientWidth - this.rect[0] - SCROLLBAR_WIDTH$1;
            let newWidth = Math.max(width + step, this.rect[2] + 0.5);
            if (newWidth > maxWidth) {
                el.style.whiteSpace = "normal";
                newWidth = maxWidth;
            }
            else {
                el.style.whiteSpace = "none";
            }
            el.style.width = (newWidth + "px");
        }
        resizeHeigth(height) {
            const el = this.el;
            const maxHeight = el.parentElement.clientHeight - this.rect[1] - SCROLLBAR_HIGHT;
            let newHeight = Math.max(height + 1, this.rect[3]);
            if (newHeight > maxHeight) {
                el.style.overflow = "hidden";
                newHeight = maxHeight;
            }
            el.style.height = (newHeight + "px");
        }
    }
    GridComposer.template = TEMPLATE$c;
    GridComposer.style = CSS$b;
    GridComposer.components = { Composer };

    const { useState: useState$a } = owl__namespace;
    const { xml: xml$e, css: css$d } = owl.tags;
    const { useRef: useRef$2 } = owl.hooks;
    const TEMPLATE$d = xml$e /* xml */ `
<div class="o-chart-container">
  <div class="o-chart-menu" t-on-click="showMenu">${LIST}</div>
  <canvas t-ref="graphContainer"/>
  <Menu t-if="menuState.isOpen"
    position="menuState.position"
    menuItems="menuState.menuItems"
    t-on-close="menuState.isOpen=false"/>
</div>`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const CSS$c = css$d /* scss */ `
  .o-chart-container {
    width: 100%;
    height: 100%;
    position: relative;

    > canvas {
      background-color: white;
    }
    .o-chart-menu {
      right: 0px;
      display: none;
      position: absolute;
      padding: 5px;
      cursor: pointer;
    }
  }
  .o-figure.active:focus {
    .o-chart-container {
      .o-chart-menu {
        display: flex;
      }
    }
  }
`;
    class ChartFigure extends owl.Component {
        constructor() {
            super(...arguments);
            this.menuState = useState$a({ isOpen: false, position: null, menuItems: [] });
            this.canvas = useRef$2("graphContainer");
        }
        mounted() {
            this.createChart();
        }
        patched() {
            var _a;
            const figure = this.props.figure;
            const chartData = this.env.getters.getChartRuntime(figure.id);
            if (chartData) {
                if (chartData.data && chartData.data.datasets) {
                    this.chart.data = chartData.data;
                    this.chart.config.type = chartData.type;
                    if ((_a = chartData.options) === null || _a === void 0 ? void 0 : _a.title) {
                        this.chart.config.options.title = chartData.options.title;
                    }
                }
                else {
                    this.chart.data.datasets = undefined;
                }
                this.chart.update({ duration: 0 });
            }
            else {
                this.chart && this.chart.destroy();
            }
        }
        createChart() {
            const figure = this.props.figure;
            const chartData = this.env.getters.getChartRuntime(figure.id);
            if (chartData) {
                const canvas = this.canvas.el;
                const ctx = canvas.getContext("2d");
                this.chart = new window.Chart(ctx, chartData);
            }
        }
        showMenu(ev) {
            const registry = new MenuItemRegistry();
            registry.add("edit", {
                name: _lt("Edit"),
                sequence: 1,
                action: () => this.env.openSidePanel("ChartPanel", { figure: this.props.figure }),
            });
            registry.add("delete", {
                name: _lt("Delete"),
                sequence: 10,
                action: () => {
                    this.env.dispatch("DELETE_FIGURE", {
                        sheetId: this.env.getters.getActiveSheetId(),
                        id: this.props.figure.id,
                    });
                    if (this.props.sidePanelIsOpen) {
                        this.env.toggleSidePanel("ChartPanel", { figure: this.props.figure });
                    }
                    this.trigger("figure-deleted");
                },
            });
            this.openContextMenu(ev.currentTarget, registry);
        }
        openContextMenu(target, registry) {
            const x = target.offsetLeft;
            const y = target.offsetTop;
            this.menuState.isOpen = true;
            this.menuState.menuItems = registry.getAll().filter((x) => x.isVisible(this.env));
            this.menuState.position = {
                x,
                y,
                height: 400,
                width: this.el.clientWidth,
            };
        }
    }
    ChartFigure.template = TEMPLATE$d;
    ChartFigure.style = CSS$c;
    ChartFigure.components = { Menu };

    const { xml: xml$f, css: css$e } = owl.tags;
    const { useState: useState$b } = owl__namespace;
    const TEMPLATE$e = xml$f /* xml */ `<div>
    <t t-foreach="getVisibleFigures()" t-as="info" t-key="info.id">
        <div class="o-figure-wrapper"
             t-att-style="getStyle(info)"
             t-on-mousedown="onMouseDown(info.figure)"
             >
            <div class="o-figure"
                 t-att-class="{active: info.isSelected, 'o-dragging': info.id === dnd.figureId}"
                 t-att-style="getDims(info)"
                 tabindex="0"
                 t-on-keydown.stop="onKeyDown(info.figure)">
                <t t-component="figureRegistry.get(info.figure.tag).Component"
                   t-key="info.id"
                   sidePanelIsOpen="props.sidePanelIsOpen"
                   figure="info.figure"/>
                <t t-if="info.isSelected">
                    <div class="o-anchor o-top" t-on-mousedown.stop="resize(info.figure, 0,-1)"/>
                    <div class="o-anchor o-topRight" t-on-mousedown.stop="resize(info.figure, 1,-1)"/>
                    <div class="o-anchor o-right" t-on-mousedown.stop="resize(info.figure, 1,0)"/>
                    <div class="o-anchor o-bottomRight" t-on-mousedown.stop="resize(info.figure, 1,1)"/>
                    <div class="o-anchor o-bottom" t-on-mousedown.stop="resize(info.figure, 0,1)"/>
                    <div class="o-anchor o-bottomLeft" t-on-mousedown.stop="resize(info.figure, -1,1)"/>
                    <div class="o-anchor o-left" t-on-mousedown.stop="resize(info.figure, -1,0)"/>
                    <div class="o-anchor o-topLeft" t-on-mousedown.stop="resize(info.figure, -1,-1)"/>
                </t>
            </div>
        </div>
    </t>
</div>
`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const ANCHOR_SIZE = 8;
    const BORDER_WIDTH = 1;
    const ACTIVE_BORDER_WIDTH = 2;
    const MIN_FIG_SIZE = 80;
    const CSS$d = css$e /*SCSS*/ `
  .o-figure-wrapper {
    overflow: hidden;
  }

  .o-figure {
    border: 1px solid black;
    box-sizing: border-box;
    position: absolute;
    bottom: 3px;
    right: 3px;
    &:focus {
      outline: none;
    }
    &.active {
      border: ${ACTIVE_BORDER_WIDTH}px solid ${SELECTION_BORDER_COLOR};
      z-index: 1;
    }

    &.o-dragging {
      opacity: 0.9;
      cursor: grabbing;
    }

    .o-anchor {
      z-index: 1000;
      position: absolute;
      outline: ${BORDER_WIDTH}px solid white;
      width: ${ANCHOR_SIZE}px;
      height: ${ANCHOR_SIZE}px;
      background-color: #1a73e8;
      &.o-top {
        top: -${ANCHOR_SIZE / 2}px;
        right: 50%;
        cursor: n-resize;
      }
      &.o-topRight {
        top: -${ANCHOR_SIZE / 2}px;
        right: -${ANCHOR_SIZE / 2}px;
        cursor: ne-resize;
      }
      &.o-right {
        right: -${ANCHOR_SIZE / 2}px;
        top: 50%;
        cursor: e-resize;
      }
      &.o-bottomRight {
        bottom: -${ANCHOR_SIZE / 2}px;
        right: -${ANCHOR_SIZE / 2}px;
        cursor: se-resize;
      }
      &.o-bottom {
        bottom: -${ANCHOR_SIZE / 2}px;
        right: 50%;
        cursor: s-resize;
      }
      &.o-bottomLeft {
        bottom: -${ANCHOR_SIZE / 2}px;
        left: -${ANCHOR_SIZE / 2}px;
        cursor: sw-resize;
      }
      &.o-left {
        bottom: 50%;
        left: -${ANCHOR_SIZE / 2}px;
        cursor: w-resize;
      }
      &.o-topLeft {
        top: -${ANCHOR_SIZE / 2}px;
        left: -${ANCHOR_SIZE / 2}px;
        cursor: nw-resize;
      }
    }
  }
`;
    class FiguresContainer extends owl.Component {
        constructor() {
            super(...arguments);
            this.figureRegistry = figureRegistry;
            this.dnd = useState$b({
                figureId: "",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            });
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
        }
        getVisibleFigures() {
            const selectedId = this.getters.getSelectedFigureId();
            return this.getters
                .getVisibleFigures(this.getters.getActiveSheetId(), this.props.viewport)
                .map((f) => ({
                id: f.id,
                isSelected: f.id === selectedId,
                figure: f,
            }));
        }
        getDims(info) {
            const { figure, isSelected } = info;
            const borders = 2 * (isSelected ? ACTIVE_BORDER_WIDTH : BORDER_WIDTH);
            const { width, height } = isSelected && this.dnd.figureId ? this.dnd : figure;
            return `width:${width + borders}px;height:${height + borders}px`;
        }
        getStyle(info) {
            const { figure, isSelected } = info;
            const { offsetX, offsetY } = this.props.viewport;
            const target = figure.id === (isSelected && this.dnd.figureId) ? this.dnd : figure;
            const { width, height } = target;
            let x = target.x - offsetX + HEADER_WIDTH - 1;
            let y = target.y - offsetY + HEADER_HEIGHT - 1;
            // width and height of wrapper need to be adjusted so we do not overlap
            // with headers
            const correctionX = Math.max(0, HEADER_WIDTH - x);
            x += correctionX;
            const correctionY = Math.max(0, HEADER_HEIGHT - y);
            y += correctionY;
            if (width < 0 || height < 0) {
                return `position:absolute;display:none;`;
            }
            const offset = ANCHOR_SIZE + ACTIVE_BORDER_WIDTH + (isSelected ? ACTIVE_BORDER_WIDTH : BORDER_WIDTH);
            return `position:absolute; top:${y + 1}px; left:${x + 1}px; width:${width - correctionX + offset}px; height:${height - correctionY + offset}px`;
        }
        mounted() {
            // horrible, but necessary
            // the following line ensures that we render the figures with the correct
            // viewport.  The reason is that whenever we initialize the grid
            // component, we do not know yet the actual size of the viewport, so the
            // first owl rendering is done with an empty viewport.  Only then we can
            // compute which figures should be displayed, so we have to force a
            // new rendering
            this.render();
        }
        resize(figure, dirX, dirY, ev) {
            ev.stopPropagation();
            const initialX = ev.clientX;
            const initialY = ev.clientY;
            this.dnd.figureId = figure.id;
            this.dnd.x = figure.x;
            this.dnd.y = figure.y;
            this.dnd.width = figure.width;
            this.dnd.height = figure.height;
            const onMouseMove = (ev) => {
                const deltaX = dirX * (ev.clientX - initialX);
                const deltaY = dirY * (ev.clientY - initialY);
                this.dnd.width = Math.max(figure.width + deltaX, MIN_FIG_SIZE);
                this.dnd.height = Math.max(figure.height + deltaY, MIN_FIG_SIZE);
                if (dirX < 0) {
                    this.dnd.x = figure.x - deltaX;
                }
                if (dirY < 0) {
                    this.dnd.y = figure.y - deltaY;
                }
            };
            const onMouseUp = (ev) => {
                this.dnd.figureId = "";
                const update = {
                    x: this.dnd.x,
                    y: this.dnd.y,
                };
                if (dirX) {
                    update.width = this.dnd.width;
                }
                if (dirY) {
                    update.height = this.dnd.height;
                }
                this.dispatch("UPDATE_FIGURE", {
                    sheetId: this.getters.getActiveSheetId(),
                    id: figure.id,
                    ...update,
                });
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onMouseDown(figure, ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            this.dispatch("SELECT_FIGURE", { id: figure.id });
            if (this.props.sidePanelIsOpen) {
                this.env.openSidePanel("ChartPanel", { figure });
            }
            const initialX = ev.clientX;
            const initialY = ev.clientY;
            this.dnd.figureId = figure.id;
            this.dnd.x = figure.x;
            this.dnd.y = figure.y;
            this.dnd.width = figure.width;
            this.dnd.height = figure.height;
            const onMouseMove = (ev) => {
                this.dnd.x = Math.max(figure.x - initialX + ev.clientX, 0);
                this.dnd.y = Math.max(figure.y - initialY + ev.clientY, 0);
            };
            const onMouseUp = (ev) => {
                this.dnd.figureId = "";
                this.dispatch("UPDATE_FIGURE", {
                    sheetId: this.getters.getActiveSheetId(),
                    id: figure.id,
                    x: this.dnd.x,
                    y: this.dnd.y,
                });
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onKeyDown(figure, ev) {
            ev.preventDefault();
            switch (ev.key) {
                case "Delete":
                    this.dispatch("DELETE_FIGURE", { sheetId: this.getters.getActiveSheetId(), id: figure.id });
                    this.trigger("figure-deleted");
                    break;
                case "ArrowDown":
                case "ArrowLeft":
                case "ArrowRight":
                case "ArrowUp":
                    const deltaMap = {
                        ArrowDown: [0, 1],
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                        ArrowUp: [0, -1],
                    };
                    const delta = deltaMap[ev.key];
                    this.dispatch("UPDATE_FIGURE", {
                        sheetId: this.getters.getActiveSheetId(),
                        id: figure.id,
                        x: figure.x + delta[0],
                        y: figure.y + delta[1],
                    });
            }
        }
    }
    FiguresContainer.template = TEMPLATE$e;
    FiguresContainer.style = CSS$d;
    FiguresContainer.components = {};
    figureRegistry.add("chart", { Component: ChartFigure, SidePanelComponent: "ChartPanel" });

    const { Component: Component$d } = owl__namespace;
    const { xml: xml$g, css: css$f } = owl.tags;
    const { useState: useState$c } = owl.hooks;
    // -----------------------------------------------------------------------------
    // Resizer component
    // -----------------------------------------------------------------------------
    class AbstractResizer extends Component$d {
        constructor() {
            super(...arguments);
            this.PADDING = 0;
            this.MAX_SIZE_MARGIN = 0;
            this.MIN_ELEMENT_SIZE = 0;
            this.lastSelectedElement = null;
            this.lastElement = null;
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.state = useState$c({
                isActive: false,
                isResizing: false,
                activeElement: 0,
                styleValue: 0,
                delta: 0,
            });
        }
        _computeHandleDisplay(ev) {
            const index = this._getEvOffset(ev);
            const elementIndex = this._getElementIndex(index);
            if (elementIndex < 0) {
                return;
            }
            const element = this._getElement(elementIndex);
            const offset = this._getStateOffset();
            if (index - (element.start - offset) < this.PADDING &&
                elementIndex !== this._getViewportOffset()) {
                this.state.isActive = true;
                this.state.styleValue = element.start - offset - this._getHeaderSize();
                this.state.activeElement = elementIndex - 1;
            }
            else if (element.end - offset - index < this.PADDING) {
                this.state.isActive = true;
                this.state.styleValue = element.end - offset - this._getHeaderSize();
                this.state.activeElement = elementIndex;
            }
            else {
                this.state.isActive = false;
            }
        }
        onMouseMove(ev) {
            if (this.state.isResizing) {
                return;
            }
            this._computeHandleDisplay(ev);
        }
        onMouseLeave() {
            this.state.isActive = this.state.isResizing;
        }
        onDblClick() {
            this._fitElementSize(this.state.activeElement);
            this.state.isResizing = false;
        }
        onMouseDown(ev) {
            this.state.isResizing = true;
            this.state.delta = 0;
            const initialIndex = this._getClientPosition(ev);
            const styleValue = this.state.styleValue;
            const size = this._getElement(this.state.activeElement).size;
            const minSize = styleValue - size + this.MIN_ELEMENT_SIZE;
            const maxSize = this._getMaxSize();
            const onMouseUp = (ev) => {
                this.state.isResizing = false;
                if (this.state.delta !== 0) {
                    this._updateSize();
                }
            };
            const onMouseMove = (ev) => {
                this.state.delta = this._getClientPosition(ev) - initialIndex;
                this.state.styleValue = styleValue + this.state.delta;
                if (this.state.styleValue < minSize) {
                    this.state.styleValue = minSize;
                    this.state.delta = this.MIN_ELEMENT_SIZE - size;
                }
                if (this.state.styleValue > maxSize) {
                    this.state.styleValue = maxSize;
                    this.state.delta = maxSize - styleValue;
                }
            };
            startDnd(onMouseMove, onMouseUp);
        }
        select(ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            const index = this._getElementIndex(this._getEvOffset(ev));
            if (index < 0) {
                return;
            }
            this.lastElement = index;
            this.dispatch(ev.ctrlKey ? "START_SELECTION_EXPANSION" : "START_SELECTION");
            if (ev.shiftKey) {
                this._increaseSelection(index);
            }
            else {
                this.lastSelectedElement = index;
                this._selectElement(index, ev.ctrlKey);
            }
            const initialIndex = this._getClientPosition(ev);
            const initialOffset = this._getEvOffset(ev);
            const onMouseMoveSelect = (ev) => {
                const offset = this._getClientPosition(ev) - initialIndex + initialOffset;
                const index = this._getElementIndex(offset);
                if (index !== this.lastElement && index !== -1) {
                    this._increaseSelection(index);
                    this.lastElement = index;
                }
            };
            const onMouseUpSelect = () => {
                this.lastElement = null;
                this.dispatch(ev.ctrlKey ? "PREPARE_SELECTION_EXPANSION" : "STOP_SELECTION");
            };
            startDnd(onMouseMoveSelect, onMouseUpSelect);
        }
        onMouseUp(ev) {
            this.lastElement = null;
        }
        onContextMenu(ev) {
            ev.preventDefault();
            const index = this._getElementIndex(this._getEvOffset(ev));
            if (index < 0)
                return;
            if (!this._getActiveElements().has(index)) {
                this.lastSelectedElement = index;
                this._selectElement(index, false);
            }
            const type = this._getType();
            const { x, y } = this._getXY(ev);
            this.trigger("open-contextmenu", { type, x, y });
        }
    }
    class ColResizer extends AbstractResizer {
        constructor() {
            super(...arguments);
            this.PADDING = 15;
            this.MAX_SIZE_MARGIN = 90;
            this.MIN_ELEMENT_SIZE = MIN_COL_WIDTH;
        }
        _getEvOffset(ev) {
            return ev.offsetX + HEADER_WIDTH;
        }
        _getStateOffset() {
            return this.props.viewport.offsetX - HEADER_WIDTH;
        }
        _getViewportOffset() {
            return this.props.viewport.left;
        }
        _getClientPosition(ev) {
            return ev.clientX;
        }
        _getElementIndex(index) {
            return this.getters.getColIndex(index, this.props.viewport.left);
        }
        _getElement(index) {
            return this.getters.getCol(this.getters.getActiveSheetId(), index);
        }
        _getBottomRightValue(element) {
            return element.end;
        }
        _getHeaderSize() {
            return HEADER_WIDTH;
        }
        _getMaxSize() {
            return this.el.clientWidth;
        }
        _updateSize() {
            const index = this.state.activeElement;
            const size = this.state.delta + this._getElement(index).size;
            const cols = this.getters.getActiveCols();
            this.dispatch("RESIZE_COLUMNS", {
                sheetId: this.getters.getActiveSheetId(),
                columns: cols.has(index) ? [...cols] : [index],
                size,
            });
        }
        _selectElement(index, ctrlKey) {
            this.dispatch("SELECT_COLUMN", { index, createRange: ctrlKey });
        }
        _increaseSelection(index) {
            this.dispatch("SELECT_COLUMN", { index, updateRange: true });
        }
        _fitElementSize(index) {
            const cols = this.getters.getActiveCols();
            this.dispatch("AUTORESIZE_COLUMNS", {
                sheetId: this.getters.getActiveSheetId(),
                cols: cols.has(index) ? [...cols] : [index],
            });
        }
        _getType() {
            return "COL";
        }
        _getActiveElements() {
            return this.getters.getActiveCols();
        }
        _getXY(ev) {
            return {
                x: ev.offsetX + HEADER_WIDTH,
                y: ev.offsetY,
            };
        }
    }
    ColResizer.template = xml$g /* xml */ `
    <div class="o-col-resizer" t-on-mousemove.self="onMouseMove" t-on-mouseleave="onMouseLeave" t-on-mousedown.self.prevent="select"
      t-on-mouseup.self="onMouseUp" t-on-contextmenu.self="onContextMenu">
      <t t-if="state.isActive">
        <div class="o-handle" t-on-mousedown="onMouseDown" t-on-dblclick="onDblClick" t-on-contextmenu.prevent=""
          t-attf-style="left:{{state.styleValue - 2}}px;">
          <div class="dragging" t-if="state.isResizing"/>
        </div>
      </t>
    </div>`;
    ColResizer.style = css$f /* scss */ `
    .o-col-resizer {
      position: absolute;
      top: 0;
      left: ${HEADER_WIDTH}px;
      right: 0;
      height: ${HEADER_HEIGHT}px;
      .o-handle {
        position: absolute;
        height: ${HEADER_HEIGHT}px;
        width: 4px;
        cursor: e-resize;
        background-color: #3266ca;
      }
      .dragging {
        top: ${HEADER_HEIGHT}px;
        position: absolute;
        margin-left: 2px;
        width: 1px;
        height: 10000px;
        background-color: #3266ca;
      }
    }
  `;
    class RowResizer extends AbstractResizer {
        constructor() {
            super(...arguments);
            this.PADDING = 5;
            this.MAX_SIZE_MARGIN = 60;
            this.MIN_ELEMENT_SIZE = MIN_ROW_HEIGHT;
        }
        _getEvOffset(ev) {
            return ev.offsetY + HEADER_HEIGHT;
        }
        _getStateOffset() {
            return this.props.viewport.offsetY - HEADER_HEIGHT;
        }
        _getViewportOffset() {
            return this.props.viewport.top;
        }
        _getClientPosition(ev) {
            return ev.clientY;
        }
        _getElementIndex(index) {
            return this.getters.getRowIndex(index, this.props.viewport.top);
        }
        _getElement(index) {
            return this.getters.getRow(this.getters.getActiveSheetId(), index);
        }
        _getHeaderSize() {
            return HEADER_HEIGHT;
        }
        _getMaxSize() {
            return this.el.clientHeight;
        }
        _updateSize() {
            const index = this.state.activeElement;
            const size = this.state.delta + this._getElement(index).size;
            const rows = this.getters.getActiveRows();
            this.dispatch("RESIZE_ROWS", {
                sheetId: this.getters.getActiveSheetId(),
                rows: rows.has(index) ? [...rows] : [index],
                size,
            });
        }
        _selectElement(index, ctrlKey) {
            this.dispatch("SELECT_ROW", { index, createRange: ctrlKey });
        }
        _increaseSelection(index) {
            this.dispatch("SELECT_ROW", { index, updateRange: true });
        }
        _fitElementSize(index) {
            const rows = this.getters.getActiveRows();
            this.dispatch("AUTORESIZE_ROWS", {
                sheetId: this.getters.getActiveSheetId(),
                rows: rows.has(index) ? [...rows] : [index],
            });
        }
        _getType() {
            return "ROW";
        }
        _getActiveElements() {
            return this.getters.getActiveRows();
        }
        _getXY(ev) {
            return {
                x: ev.offsetX,
                y: ev.offsetY + HEADER_HEIGHT,
            };
        }
    }
    RowResizer.template = xml$g /* xml */ `
    <div class="o-row-resizer" t-on-mousemove.self="onMouseMove"  t-on-mouseleave="onMouseLeave" t-on-mousedown.self.prevent="select"
    t-on-mouseup.self="onMouseUp" t-on-contextmenu.self="onContextMenu">
      <t t-if="state.isActive">
        <div class="o-handle" t-on-mousedown="onMouseDown" t-on-dblclick="onDblClick" t-on-contextmenu.prevent=""
          t-attf-style="top:{{state.styleValue - 2}}px;">
          <div class="dragging" t-if="state.isResizing"/>
        </div>
      </t>
    </div>`;
    RowResizer.style = css$f /* scss */ `
    .o-row-resizer {
      position: absolute;
      top: ${HEADER_HEIGHT}px;
      left: 0;
      right: 0;
      width: ${HEADER_WIDTH}px;
      height: 100%;
      .o-handle {
        position: absolute;
        height: 4px;
        width: ${HEADER_WIDTH}px;
        cursor: n-resize;
        background-color: #3266ca;
      }
      .dragging {
        left: ${HEADER_WIDTH}px;
        position: absolute;
        margin-top: 2px;
        width: 10000px;
        height: 1px;
        background-color: #3266ca;
      }
    }
  `;
    class Overlay extends Component$d {
        selectAll() {
            this.env.dispatch("SELECT_ALL");
        }
    }
    Overlay.template = xml$g /* xml */ `
    <div class="o-overlay">
      <ColResizer viewport="props.viewport"/>
      <RowResizer viewport="props.viewport"/>
      <div class="all" t-on-mousedown.self="selectAll"/>
    </div>`;
    Overlay.style = css$f /* scss */ `
    .o-overlay {
      .all {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        width: ${HEADER_WIDTH}px;
        height: ${HEADER_HEIGHT}px;
      }
    }
  `;
    Overlay.components = { ColResizer, RowResizer };

    class ScrollBar {
        constructor(el, direction) {
            this.el = el;
            this.direction = direction;
        }
        get scroll() {
            return this.direction === "horizontal" ? this.el.scrollLeft : this.el.scrollTop;
        }
        set scroll(value) {
            if (this.direction === "horizontal") {
                this.el.scrollLeft = value;
            }
            else {
                this.el.scrollTop = value;
            }
        }
    }

    /**
     * The Grid component is the main part of the spreadsheet UI. It is responsible
     * for displaying the actual grid, rendering it, managing events, ...
     *
     * The grid is rendered on a canvas. 3 sub components are (sometimes) displayed
     * on top of the canvas:
     * - a composer (to edit the cell content)
     * - a horizontal resizer (to resize columns)
     * - a vertical resizer (same, for rows)
     */
    const { Component: Component$e, useState: useState$d } = owl__namespace;
    const { xml: xml$h, css: css$g } = owl.tags;
    const { useRef: useRef$3, onMounted, onWillUnmount } = owl.hooks;
    const registries = {
        ROW: rowMenuRegistry,
        COL: colMenuRegistry,
        CELL: cellMenuRegistry,
    };
    // copy and paste are specific events that should not be managed by the keydown event,
    // but they shouldn't be preventDefault and stopped (else copy and paste events will not trigger)
    // and also should not result in typing the character C or V in the composer
    const keyDownMappingIgnore = ["CTRL+C", "CTRL+V"];
    function useErrorTooltip(env, getViewPort) {
        const { browser, getters } = env;
        const { Date, setInterval, clearInterval } = browser;
        let x = 0;
        let y = 0;
        let lastMoved = 0;
        let tooltipCol, tooltipRow;
        const canvasRef = useRef$3("canvas");
        const tooltip = useState$d({ isOpen: false, text: "", style: "" });
        let interval;
        function updateMousePosition(e) {
            x = e.offsetX;
            y = e.offsetY;
            lastMoved = Date.now();
        }
        function getPosition() {
            const viewport = getViewPort();
            const col = getters.getColIndex(x, viewport.left);
            const row = getters.getRowIndex(y, viewport.top);
            return [col, row];
        }
        function checkTiming() {
            if (tooltip.isOpen) {
                const [col, row] = getPosition();
                if (col !== tooltipCol || row !== tooltipRow) {
                    tooltip.isOpen = false;
                }
            }
            else {
                const delta = Date.now() - lastMoved;
                if (400 < delta && delta < 600) {
                    // mouse did not move for a short while
                    const [col, row] = getPosition();
                    if (col < 0 || row < 0) {
                        return;
                    }
                    const sheetId = getters.getActiveSheetId();
                    const [mainCol, mainRow] = getters.getMainCell(sheetId, col, row);
                    const cell = getters.getCell(sheetId, mainCol, mainRow);
                    if (cell && cell.error) {
                        tooltip.isOpen = true;
                        tooltip.text = cell.error;
                        tooltipCol = col;
                        tooltipRow = row;
                        const viewport = getViewPort();
                        const [x, y, width, height] = env.getters.getRect({ left: col, top: row, right: col, bottom: row }, viewport);
                        const hAlign = x + width + 200 < viewport.width ? "left" : "right";
                        const hOffset = hAlign === "left" ? x + width : viewport.width - x + (SCROLLBAR_WIDTH + 2);
                        const vAlign = y + 120 < viewport.height ? "top" : "bottom";
                        const vOffset = vAlign === "top" ? y : viewport.height - y - height + (SCROLLBAR_WIDTH + 2);
                        tooltip.style = `${hAlign}:${hOffset}px;${vAlign}:${vOffset}px`;
                    }
                }
            }
        }
        onMounted(() => {
            canvasRef.el.addEventListener("mousemove", updateMousePosition);
            interval = setInterval(checkTiming, 200);
        });
        onWillUnmount(() => {
            canvasRef.el.removeEventListener("mousemove", updateMousePosition);
            clearInterval(interval);
        });
        return tooltip;
    }
    function useTouchMove(handler, canMoveUp) {
        const canvasRef = useRef$3("canvas");
        let x = null;
        let y = null;
        function onTouchStart(ev) {
            if (ev.touches.length !== 1)
                return;
            x = ev.touches[0].clientX;
            y = ev.touches[0].clientY;
        }
        function onTouchEnd() {
            x = null;
            y = null;
        }
        function onTouchMove(ev) {
            if (ev.touches.length !== 1)
                return;
            // On mobile browsers, swiping down is often associated with "pull to refresh".
            // We only want this behavior if the grid is already at the top.
            // Otherwise we only want to move the canvas up, without triggering any refresh.
            if (canMoveUp()) {
                ev.preventDefault();
                ev.stopPropagation();
            }
            const currentX = ev.touches[0].clientX;
            const currentY = ev.touches[0].clientY;
            handler(x - currentX, y - currentY);
            x = currentX;
            y = currentY;
        }
        onMounted(() => {
            canvasRef.el.addEventListener("touchstart", onTouchStart);
            canvasRef.el.addEventListener("touchend", onTouchEnd);
            canvasRef.el.addEventListener("touchmove", onTouchMove);
        });
        onWillUnmount(() => {
            canvasRef.el.removeEventListener("touchstart", onTouchStart);
            canvasRef.el.removeEventListener("touchend", onTouchEnd);
            canvasRef.el.removeEventListener("touchmove", onTouchMove);
        });
    }
    // -----------------------------------------------------------------------------
    // TEMPLATE
    // -----------------------------------------------------------------------------
    const TEMPLATE$f = xml$h /* xml */ `
  <div class="o-grid" t-on-click="focus" t-on-keydown="onKeydown" t-on-wheel="onMouseWheel">
    <t t-if="getters.getEditionMode() !== 'inactive'">
      <GridComposer
        t-on-composer-unmounted="focus"
        focus="props.focusComposer"
        viewport="snappedViewport"/>
    </t>
    <canvas t-ref="canvas"
      t-on-mousedown="onMouseDown"
      t-on-dblclick="onDoubleClick"
      tabindex="-1"
      t-on-contextmenu="onCanvasContextMenu"
       />
    <t t-if="errorTooltip.isOpen">
      <div class="o-error-tooltip" t-esc="errorTooltip.text" t-att-style="errorTooltip.style"/>
    </t>
    <t t-if="getters.getEditionMode() === 'inactive'">
      <Autofill position="getAutofillPosition()" viewport="snappedViewport"/>
    </t>
    <Overlay t-on-open-contextmenu="onOverlayContextMenu" viewport="snappedViewport"/>
    <Menu t-if="menuState.isOpen"
      menuItems="menuState.menuItems"
      position="menuState.position"
      t-on-close.stop="menuState.isOpen=false"/>
    <t t-set="gridSize" t-value="getters.getGridSize(getters.getActiveSheet())"/>
    <FiguresContainer viewport="snappedViewport" model="props.model" sidePanelIsOpen="props.sidePanelIsOpen" t-on-figure-deleted="focus" />
    <div class="o-scrollbar vertical" t-on-scroll="onScroll" t-ref="vscrollbar">
      <div t-attf-style="width:1px;height:{{gridSize[1]}}px"/>
    </div>
    <div class="o-scrollbar horizontal" t-on-scroll="onScroll" t-ref="hscrollbar">
      <div t-attf-style="height:1px;width:{{gridSize[0]}}px"/>
    </div>
  </div>`;
    // -----------------------------------------------------------------------------
    // STYLE
    // -----------------------------------------------------------------------------
    const CSS$e = css$g /* scss */ `
  .o-grid {
    position: relative;
    overflow: hidden;
    background-color: ${BACKGROUND_GRAY_COLOR};

    > canvas {
      border-top: 1px solid #e2e3e3;
      border-bottom: 1px solid #e2e3e3;

      &:focus {
        outline: none;
      }
    }
    .o-error-tooltip {
      position: absolute;
      font-size: 13px;
      width: 180px;
      height: 80px;
      background-color: white;
      box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);
      border-left: 3px solid red;
      padding: 10px;
    }
    .o-scrollbar {
      position: absolute;
      overflow: auto;
      z-index: 2;
      &.vertical {
        right: 0;
        top: ${SCROLLBAR_WIDTH + 1}px;
        bottom: 15px;
        width: 15px;
      }
      &.horizontal {
        bottom: 0;
        height: 15px;
        right: ${SCROLLBAR_WIDTH + 1}px;
        left: ${HEADER_WIDTH}px;
      }
    }
  }
`;
    // -----------------------------------------------------------------------------
    // JS
    // -----------------------------------------------------------------------------
    class Grid extends Component$e {
        constructor() {
            super(...arguments);
            this.menuState = useState$d({
                isOpen: false,
                position: null,
                menuItems: [],
            });
            this.vScrollbarRef = useRef$3("vscrollbar");
            this.hScrollbarRef = useRef$3("hscrollbar");
            this.canvas = useRef$3("canvas");
            this.getters = this.env.getters;
            this.dispatch = this.env.dispatch;
            this.currentPosition = this.getters.getPosition();
            this.currentSheet = this.getters.getActiveSheetId();
            this.clickedCol = 0;
            this.clickedRow = 0;
            this.viewport = {
                width: 0,
                height: 0,
                offsetX: 0,
                offsetY: 0,
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            // this viewport represent the same area as the previous one, but 'snapped' to
            // the col/row structure, so, the offsets are correct for computations necessary
            // to align elements to the grid.
            this.snappedViewport = this.viewport;
            this.errorTooltip = useErrorTooltip(this.env, () => this.snappedViewport);
            // this map will handle most of the actions that should happen on key down. The arrow keys are managed in the key
            // down itself
            this.keyDownMapping = {
                ENTER: () => this.trigger("composer-focused"),
                TAB: () => this.dispatch("MOVE_POSITION", { deltaX: 1, deltaY: 0 }),
                "SHIFT+TAB": () => this.dispatch("MOVE_POSITION", { deltaX: -1, deltaY: 0 }),
                F2: () => this.trigger("composer-focused"),
                DELETE: () => {
                    this.dispatch("DELETE_CONTENT", {
                        sheetId: this.getters.getActiveSheetId(),
                        target: this.getters.getSelectedZones(),
                    });
                },
                "CTRL+A": () => this.dispatch("SELECT_ALL"),
                "CTRL+S": () => {
                    this.trigger("save-requested");
                },
                "CTRL+Z": () => this.dispatch("UNDO"),
                "CTRL+Y": () => this.dispatch("REDO"),
                "CTRL+B": () => this.dispatch("SET_FORMATTING", {
                    sheetId: this.getters.getActiveSheetId(),
                    target: this.getters.getSelectedZones(),
                    style: { bold: !this.getters.getCurrentStyle().bold },
                }),
                "CTRL+I": () => this.dispatch("SET_FORMATTING", {
                    sheetId: this.getters.getActiveSheetId(),
                    target: this.getters.getSelectedZones(),
                    style: { italic: !this.getters.getCurrentStyle().italic },
                }),
            };
            this.vScrollbar = new ScrollBar(this.vScrollbarRef.el, "vertical");
            this.hScrollbar = new ScrollBar(this.hScrollbarRef.el, "horizontal");
            useTouchMove(this.moveCanvas.bind(this), () => this.vScrollbar.scroll > 0);
        }
        mounted() {
            this.vScrollbar.el = this.vScrollbarRef.el;
            this.hScrollbar.el = this.hScrollbarRef.el;
            this.focus();
            this.drawGrid();
        }
        async willUpdateProps() {
            const sheet = this.getters.getActiveSheetId();
            if (this.currentSheet !== sheet) {
                // We need to reset the viewport as the sheet is changed
                this.viewport.offsetX = 0;
                this.viewport.offsetY = 0;
                this.hScrollbar.scroll = 0;
                this.vScrollbar.scroll = 0;
                this.viewport = this.getters.adjustViewportZone(this.viewport);
                this.viewport = this.getters.adjustViewportPosition(this.viewport);
                this.snappedViewport = this.getters.snapViewportToCell(this.viewport);
            }
        }
        patched() {
            this.drawGrid();
        }
        focus() {
            if (!this.getters.isSelectingForComposer() && !this.getters.getSelectedFigureId()) {
                this.canvas.el.focus();
            }
        }
        onScroll() {
            this.viewport.offsetX = this.hScrollbar.scroll;
            this.viewport.offsetY = this.vScrollbar.scroll;
            const viewport = this.getters.adjustViewportZone(this.viewport);
            if (!isEqual(viewport, this.viewport)) {
                this.viewport = viewport;
                this.render();
            }
            this.snappedViewport = this.getters.snapViewportToCell(this.viewport);
        }
        checkChanges() {
            const [col, row] = this.getters.getPosition();
            const [curCol, curRow] = this.currentPosition;
            const currentSheet = this.getters.getActiveSheetId();
            const changed = currentSheet !== this.currentSheet || col !== curCol || row !== curRow;
            if (changed) {
                this.currentPosition = [col, row];
            }
            if (currentSheet !== this.currentSheet) {
                this.focus();
                this.currentSheet = currentSheet;
            }
            return changed;
        }
        getAutofillPosition() {
            const zone = this.getters.getSelectedZone();
            const sheet = this.getters.getActiveSheet();
            return {
                left: sheet.cols[zone.right].end - 4 + HEADER_WIDTH - this.snappedViewport.offsetX,
                top: sheet.rows[zone.bottom].end - 4 + HEADER_HEIGHT - this.snappedViewport.offsetY,
            };
        }
        drawGrid() {
            // update viewport dimensions
            // resize window
            this.viewport.width = this.el.clientWidth - SCROLLBAR_WIDTH;
            this.viewport.height = this.el.clientHeight - SCROLLBAR_WIDTH;
            // scrollbar scrolled
            this.viewport.offsetX = this.hScrollbar.scroll;
            this.viewport.offsetY = this.vScrollbar.scroll;
            // needed to reset the bottom and the right on the current viewport to the one of the new
            // active sheet or in any case, the number of cols & rows might have changed.
            this.viewport = this.getters.adjustViewportZone(this.viewport);
            // check for position changes
            if (this.checkChanges()) {
                this.viewport = this.getters.adjustViewportPosition(this.viewport);
                this.hScrollbar.scroll = this.viewport.offsetX;
                this.vScrollbar.scroll = this.viewport.offsetY;
            }
            this.snappedViewport = this.getters.snapViewportToCell(this.viewport);
            // drawing grid on canvas
            const canvas = this.canvas.el;
            const dpr = window.devicePixelRatio || 1;
            const ctx = canvas.getContext("2d", { alpha: false });
            const thinLineWidth = 0.4 * dpr;
            const renderingContext = { ctx, viewport: this.viewport, dpr, thinLineWidth };
            const { width, height } = this.viewport;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.setAttribute("style", `width:${width}px;height:${height}px;`);
            ctx.translate(-0.5, -0.5);
            ctx.scale(dpr, dpr);
            this.props.model.drawGrid(renderingContext);
        }
        moveCanvas(deltaX, deltaY) {
            this.vScrollbar.scroll = this.vScrollbar.scroll + deltaY;
            this.hScrollbar.scroll = this.hScrollbar.scroll + deltaX;
        }
        onMouseWheel(ev) {
            function normalize(val) {
                return val * (ev.deltaMode === 0 ? 1 : DEFAULT_CELL_HEIGHT);
            }
            const deltaX = ev.shiftKey ? ev.deltaY : ev.deltaX;
            const deltaY = ev.shiftKey ? ev.deltaX : ev.deltaY;
            this.moveCanvas(normalize(deltaX), normalize(deltaY));
        }
        // ---------------------------------------------------------------------------
        // Zone selection with mouse
        // ---------------------------------------------------------------------------
        getCartesianCoordinates(ev) {
            const rect = this.el.getBoundingClientRect();
            const x = ev.pageX - rect.left;
            const y = ev.pageY - rect.top;
            const colIndex = this.getters.getColIndex(x, this.snappedViewport.left);
            const rowIndex = this.getters.getRowIndex(y, this.snappedViewport.top);
            return [colIndex, rowIndex];
        }
        onMouseDown(ev) {
            if (ev.button > 0) {
                // not main button, probably a context menu
                return;
            }
            const [col, row] = this.getCartesianCoordinates(ev);
            if (col < 0 || row < 0) {
                return;
            }
            this.clickedCol = col;
            this.clickedRow = row;
            this.dispatch(ev.ctrlKey ? "START_SELECTION_EXPANSION" : "START_SELECTION");
            if (ev.shiftKey) {
                this.dispatch("ALTER_SELECTION", { cell: [col, row] });
            }
            else {
                this.dispatch("SELECT_CELL", { col, row });
                this.checkChanges();
            }
            let prevCol = col;
            let prevRow = row;
            const onMouseMove = (ev) => {
                const [col, row] = this.getCartesianCoordinates(ev);
                if (col < 0 || row < 0) {
                    return;
                }
                if (col !== prevCol || row !== prevRow) {
                    prevCol = col;
                    prevRow = row;
                    this.dispatch("ALTER_SELECTION", { cell: [col, row] });
                }
            };
            const onMouseUp = (ev) => {
                this.dispatch(ev.ctrlKey ? "PREPARE_SELECTION_EXPANSION" : "STOP_SELECTION");
                this.canvas.el.removeEventListener("mousemove", onMouseMove);
                if (this.getters.isPaintingFormat()) {
                    this.dispatch("PASTE", {
                        target: this.getters.getSelectedZones(),
                    });
                }
            };
            startDnd(onMouseMove, onMouseUp);
        }
        onDoubleClick(ev) {
            const [col, row] = this.getCartesianCoordinates(ev);
            if (this.clickedCol === col && this.clickedRow === row) {
                this.trigger("composer-focused");
            }
        }
        // ---------------------------------------------------------------------------
        // Keyboard interactions
        // ---------------------------------------------------------------------------
        processTabKey(ev) {
            ev.preventDefault();
            const deltaX = ev.shiftKey ? -1 : 1;
            this.dispatch("MOVE_POSITION", { deltaX, deltaY: 0 });
        }
        processArrows(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const deltaMap = {
                ArrowDown: [0, 1],
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
            };
            const delta = deltaMap[ev.key];
            if (ev.shiftKey) {
                this.dispatch("ALTER_SELECTION", { delta });
            }
            else {
                this.dispatch("MOVE_POSITION", { deltaX: delta[0], deltaY: delta[1] });
            }
            if (this.getters.isPaintingFormat()) {
                this.dispatch("PASTE", {
                    target: this.getters.getSelectedZones(),
                });
            }
        }
        onKeydown(ev) {
            if (ev.key.startsWith("Arrow")) {
                this.processArrows(ev);
                return;
            }
            let keyDownString = "";
            if (ev.ctrlKey)
                keyDownString += "CTRL+";
            if (ev.metaKey)
                keyDownString += "CTRL+";
            if (ev.altKey)
                keyDownString += "ALT+";
            if (ev.shiftKey)
                keyDownString += "SHIFT+";
            keyDownString += ev.key.toUpperCase();
            let handler = this.keyDownMapping[keyDownString];
            if (handler) {
                ev.preventDefault();
                ev.stopPropagation();
                handler();
                return;
            }
            if (!keyDownMappingIgnore.includes(keyDownString)) {
                if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
                    // if the user types a character on the grid, it means he wants to start composing the selected cell with that
                    // character
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.trigger("composer-focused", { content: ev.key });
                }
            }
        }
        // ---------------------------------------------------------------------------
        // Context Menu
        // ---------------------------------------------------------------------------
        onCanvasContextMenu(ev) {
            ev.preventDefault();
            const [col, row] = this.getCartesianCoordinates(ev);
            if (col < 0 || row < 0) {
                return;
            }
            const zones = this.getters.getSelectedZones();
            const lastZone = zones[zones.length - 1];
            let type = "CELL";
            if (!isInside(col, row, lastZone)) {
                this.dispatch("STOP_EDITION");
                this.dispatch("SELECT_CELL", { col, row });
            }
            else {
                if (this.getters.getActiveCols().has(col)) {
                    type = "COL";
                }
                else if (this.getters.getActiveRows().has(row)) {
                    type = "ROW";
                }
            }
            this.toggleContextMenu(type, ev.offsetX, ev.offsetY);
        }
        onOverlayContextMenu(ev) {
            const type = ev.detail.type;
            const x = ev.detail.x;
            const y = ev.detail.y;
            this.toggleContextMenu(type, x, y);
        }
        toggleContextMenu(type, x, y) {
            this.menuState.isOpen = true;
            this.menuState.position = {
                x,
                y,
                width: this.el.clientWidth,
                height: this.el.clientHeight,
            };
            this.menuState.menuItems = registries[type]
                .getAll()
                .filter((item) => !item.isVisible || item.isVisible(this.env));
        }
    }
    Grid.template = TEMPLATE$f;
    Grid.style = CSS$e;
    Grid.components = { GridComposer, Overlay, Menu, Autofill, FiguresContainer };

    const { Component: Component$f } = owl__namespace;
    const { xml: xml$i, css: css$h } = owl.tags;
    const { useState: useState$e } = owl.hooks;
    const TEMPLATE$g = xml$i /* xml */ `
  <div class="o-sidePanel" >
    <div class="o-sidePanelHeader">
        <div class="o-sidePanelTitle" t-esc="getTitle()"/>
        <div class="o-sidePanelClose" t-on-click="trigger('close-side-panel')">×</div>
    </div>
    <div class="o-sidePanelBody">
      <t t-component="state.panel.Body" t-props="props.panelProps" t-key="'Body_' + props.component"/>
    </div>
    <div class="o-sidePanelFooter" t-if="state.panel.Footer">
      <t t-component="state.panel.Footer" t-props="props.panelProps" t-key="'Footer_' + props.component"/>
    </div>
  </div>`;
    const CSS$f = css$h /* scss */ `
  .o-sidePanel {
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    background-color: white;
    border: 1px solid darkgray;
    .o-sidePanelHeader {
      padding: 6px;
      height: 30px;
      background-color: #f8f9fa;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid darkgray;
      font-weight: bold;
      .o-sidePanelTitle {
        font-weight: bold;
        padding: 5px 10px;
        font-size: 1.2rem;
      }
      .o-sidePanelClose {
        font-size: 1.5rem;
        padding: 5px 10px;
        cursor: pointer;
        &:hover {
          background-color: WhiteSmoke;
        }
      }
    }
    .o-sidePanelBody {
      overflow: auto;
      width: 100%;
      height: 100%;
    }

    .o-sidepanel-error {
      color: red;
      margin-top: 10px;
    }

    .o-sidePanelButtons {
      padding: 5px 16px;
      text-align: right;
      .o-sidePanelButton {
        border: 1px solid lightgrey;
        padding: 0px 20px 0px 20px;
        border-radius: 4px;
        font-weight: 500;
        font-size: 14px;
        height: 30px;
        line-height: 16px;
        background: white;
        margin-right: 8px;
        &:hover:enabled {
          background-color: rgba(0, 0, 0, 0.08);
        }
      }
      .o-sidePanelButton:enabled {
        cursor: pointer;
      }
      .o-sidePanelButton:last-child {
        margin-right: 0px;
      }
    }
    .o-input {
      border-radius: 4px;
      border: 1px solid lightgrey;
      padding: 4px 6px;
      width: 96%;
      .o-type-selector {
        background-position: right 5px top 11px;
      }
    }
    select.o-input {
      background-color: white;
      text-align: left;
    }

    .o-section {
      padding: 16px;
      .o-section-title {
        font-weight: bold;
        margin-bottom: 5px;
      }
    }
    label {
      display: block;
    }
  }
`;
    class SidePanel extends Component$f {
        constructor() {
            super(...arguments);
            this.state = useState$e({
                panel: sidePanelRegistry.get(this.props.component),
            });
        }
        async willUpdateProps(nextProps) {
            this.state.panel = sidePanelRegistry.get(nextProps.component);
        }
        getTitle() {
            return typeof this.state.panel.title === "function"
                ? this.state.panel.title(this.env)
                : this.state.panel.title;
        }
    }
    SidePanel.template = TEMPLATE$g;
    SidePanel.style = CSS$f;

    const { Component: Component$g, useState: useState$f, hooks: hooks$2 } = owl__namespace;
    const { xml: xml$j, css: css$i } = owl.tags;
    const { useExternalListener: useExternalListener$3, useRef: useRef$4 } = hooks$2;
    const FORMATS = [
        { name: "general", text: "General (no specific format)" },
        { name: "number", text: "Number (1,000.12)", value: "#,##0.00" },
        { name: "percent", text: "Percent (10.12%)", value: "0.00%" },
        { name: "date", text: "Date (9/26/2008)", value: "m/d/yyyy" },
        { name: "time", text: "Time (10:43:00 PM)", value: "hh:mm:ss a" },
        { name: "datetime", text: "Date time (9/26/2008 22:43:00)", value: "m/d/yyyy hh:mm:ss" },
        { name: "duration", text: "Duration (27:51:38)", value: "hhhh:mm:ss" },
    ];
    // -----------------------------------------------------------------------------
    // TopBar
    // -----------------------------------------------------------------------------
    class TopBar extends Component$g {
        constructor() {
            super(...arguments);
            this.formats = FORMATS;
            this.currentFormat = "general";
            this.fontSizes = fontSizes;
            this.dispatch = this.env.dispatch;
            this.getters = this.env.getters;
            this.style = {};
            this.state = useState$f({
                menuState: { isOpen: false, position: null, menuItems: [] },
                activeTool: "",
            });
            this.isSelectingMenu = false;
            this.openedEl = null;
            this.inMerge = false;
            this.cannotMerge = false;
            this.undoTool = false;
            this.redoTool = false;
            this.paintFormatTool = false;
            this.fillColor = "white";
            this.textColor = "black";
            this.menus = [];
            this.menuRef = useRef$4("menuRef");
            this.composerStyle = `
    line-height: 34px;
    border-bottom: 1px solid #e0e2e4;
    border-left: 1px solid #e0e2e4;
    background-color: white;
  `;
            useExternalListener$3(window, "click", this.onClick);
        }
        get topbarComponents() {
            return topbarComponentRegistry
                .getAll()
                .filter((item) => !item.isVisible || item.isVisible(this.env));
        }
        async willStart() {
            this.updateCellState();
        }
        async willUpdateProps() {
            this.updateCellState();
        }
        onClick(ev) {
            if (this.openedEl && isChildEvent(this.openedEl, ev)) {
                return;
            }
            this.closeMenus();
        }
        toogleStyle(style) {
            setStyle(this.env, { [style]: !this.style[style] });
        }
        toogleFormat(format) {
            const formatter = FORMATS.find((f) => f.name === format);
            const value = (formatter && formatter.value) || "";
            setFormatter(this.env, value);
        }
        toggleAlign(align) {
            setStyle(this.env, { ["align"]: align });
        }
        onMenuMouseOver(menu, ev) {
            if (this.isSelectingMenu) {
                this.toggleContextMenu(menu, ev);
            }
        }
        toggleDropdownTool(tool, ev) {
            const isOpen = this.state.activeTool === tool;
            this.closeMenus();
            this.state.activeTool = isOpen ? "" : tool;
            this.openedEl = isOpen ? null : ev.target;
        }
        toggleContextMenu(menu, ev) {
            this.closeMenus();
            const x = ev.target.offsetLeft;
            const y = ev.target.clientHeight + ev.target.offsetTop;
            this.state.menuState.isOpen = true;
            const width = this.el.clientWidth;
            const height = this.el.parentElement.clientHeight;
            this.state.menuState.position = { x, y, width, height };
            this.state.menuState.menuItems = topbarMenuRegistry
                .getChildren(menu, this.env)
                .filter((item) => !item.isVisible || item.isVisible(this.env));
            this.isSelectingMenu = true;
            this.openedEl = ev.target;
        }
        closeMenus() {
            this.state.activeTool = "";
            this.state.menuState.isOpen = false;
            this.isSelectingMenu = false;
            this.openedEl = null;
            if (this.menuRef.comp) {
                this.menuRef.comp.closeSubMenus();
            }
        }
        updateCellState() {
            this.style = this.getters.getCurrentStyle();
            this.fillColor = this.style.fillColor || "white";
            this.textColor = this.style.textColor || "black";
            const zones = this.getters.getSelectedZones();
            const { top, left, right, bottom } = zones[0];
            this.cannotMerge = zones.length > 1 || (top === bottom && left === right);
            this.inMerge = false;
            if (!this.cannotMerge) {
                const [col, row] = this.getters.getPosition();
                const zone = this.getters.expandZone(this.getters.getActiveSheetId(), {
                    left: col,
                    right: col,
                    top: row,
                    bottom: row,
                });
                this.inMerge = isEqual(zones[0], zone);
            }
            this.undoTool = this.getters.canUndo();
            this.redoTool = this.getters.canRedo();
            this.paintFormatTool = this.getters.isPaintingFormat();
            const cell = this.getters.getActiveCell();
            if (cell && cell.format) {
                const format = this.formats.find((f) => f.value === cell.format);
                this.currentFormat = format ? format.name : "";
            }
            else {
                this.currentFormat = "general";
            }
            this.menus = topbarMenuRegistry
                .getAll()
                .filter((item) => !item.isVisible || item.isVisible(this.env));
        }
        getMenuName(menu) {
            return topbarMenuRegistry.getName(menu, this.env);
        }
        toggleMerge() {
            const zones = this.getters.getSelectedZones();
            const zone = zones[zones.length - 1];
            const sheet = this.getters.getActiveSheetId();
            if (this.inMerge) {
                this.dispatch("REMOVE_MERGE", { sheetId: sheet, zone });
            }
            else {
                this.dispatch("ADD_MERGE", { sheetId: sheet, zone, interactive: true });
            }
        }
        setColor(target, ev) {
            setStyle(this.env, { [target]: ev.detail.color });
        }
        setBorder(command) {
            this.dispatch("SET_FORMATTING", {
                sheetId: this.getters.getActiveSheetId(),
                target: this.getters.getSelectedZones(),
                border: command,
            });
        }
        setFormat(ev) {
            const format = ev.target.dataset.format;
            if (format) {
                this.toogleFormat(format);
            }
        }
        setDecimal(step) {
            this.dispatch("SET_DECIMAL", {
                sheetId: this.getters.getActiveSheetId(),
                target: this.getters.getSelectedZones(),
                step: step,
            });
        }
        paintFormat() {
            this.dispatch("ACTIVATE_PAINT_FORMAT", {
                target: this.getters.getSelectedZones(),
            });
        }
        clearFormatting() {
            this.dispatch("CLEAR_FORMATTING", {
                sheetId: this.getters.getActiveSheetId(),
                target: this.getters.getSelectedZones(),
            });
        }
        setSize(ev) {
            const fontSize = parseFloat(ev.target.dataset.size);
            setStyle(this.env, { fontSize });
        }
        doAction(action) {
            action(this.env);
            this.closeMenus();
        }
        undo() {
            this.dispatch("UNDO");
        }
        redo() {
            this.dispatch("REDO");
        }
    }
    TopBar.template = xml$j /* xml */ `
    <div class="o-spreadsheet-topbar">
      <div class="o-topbar-top">
        <!-- Menus -->
        <div class="o-topbar-topleft">
          <t t-foreach="menus" t-as="menu" t-key="menu_index">
            <div t-if="menu.children.length !== 0"
              class="o-topbar-menu"
              t-on-click="toggleContextMenu(menu)"
              t-on-mouseover="onMenuMouseOver(menu)"
              t-att-data-id="menu.id">
            <t t-esc="getMenuName(menu)"/>
          </div>
          </t>
          <Menu t-if="state.menuState.isOpen"
                position="state.menuState.position"
                menuItems="state.menuState.menuItems"
                t-ref="menuRef"
                t-on-close="state.menuState.isOpen=false"/>
        </div>
        <div class="o-topbar-topright">
          <div t-foreach="topbarComponents" t-as="comp" t-key="comp_index">
            <t t-component="comp.component"/>
          </div>
        </div>
      </div>
      <!-- Toolbar and Cell Content -->
      <div class="o-topbar-toolbar">
        <!-- Toolbar -->
        <div class="o-toolbar-tools">
          <div class="o-tool" title="Undo" t-att-class="{'o-disabled': !undoTool}" t-on-click="undo" >${UNDO_ICON}</div>
          <div class="o-tool" t-att-class="{'o-disabled': !redoTool}" title="Redo"  t-on-click="redo">${REDO_ICON}</div>
          <div class="o-tool" title="Paint Format" t-att-class="{active:paintFormatTool}" t-on-click="paintFormat">${PAINT_FORMAT_ICON}</div>
          <div class="o-tool" title="Clear Format" t-on-click="clearFormatting()">${CLEAR_FORMAT_ICON}</div>
          <div class="o-divider"/>
          <div class="o-tool" title="Format as percent" t-on-click="toogleFormat('percent')">%</div>
          <div class="o-tool" title="Decrease decimal places" t-on-click="setDecimal(-1)">.0</div>
          <div class="o-tool" title="Increase decimal places" t-on-click="setDecimal(+1)">.00</div>
          <div class="o-tool o-dropdown" title="More formats" t-on-click="toggleDropdownTool('formatTool')">
            <div class="o-text-icon">123${TRIANGLE_DOWN_ICON}</div>
            <div class="o-dropdown-content o-text-options  o-format-tool "  t-if="state.activeTool === 'formatTool'" t-on-click="setFormat">
              <t t-foreach="formats" t-as="format" t-key="format.name">
                <div t-att-data-format="format.name" t-att-class="{active: currentFormat === format.name}"><t t-esc="format.text"/></div>
              </t>
            </div>
          </div>
          <div class="o-divider"/>
          <!-- <div class="o-tool" title="Font"><span>Roboto</span> ${TRIANGLE_DOWN_ICON}</div> -->
          <div class="o-tool o-dropdown" title="Font Size" t-on-click="toggleDropdownTool('fontSizeTool')">
            <div class="o-text-icon"><t t-esc="style.fontSize || ${DEFAULT_FONT_SIZE}"/> ${TRIANGLE_DOWN_ICON}</div>
            <div class="o-dropdown-content o-text-options "  t-if="state.activeTool === 'fontSizeTool'" t-on-click="setSize">
              <t t-foreach="fontSizes" t-as="font" t-key="font_index">
                <div t-esc="font.pt" t-att-data-size="font.pt"/>
              </t>
            </div>
          </div>
          <div class="o-divider"/>
          <div class="o-tool" title="Bold" t-att-class="{active:style.bold}" t-on-click="toogleStyle('bold')">${BOLD_ICON}</div>
          <div class="o-tool" title="Italic" t-att-class="{active:style.italic}" t-on-click="toogleStyle('italic')">${ITALIC_ICON}</div>
          <div class="o-tool" title="Strikethrough"  t-att-class="{active:style.strikethrough}" t-on-click="toogleStyle('strikethrough')">${STRIKE_ICON}</div>
          <div class="o-tool o-dropdown o-with-color">
            <span t-attf-style="border-color:{{textColor}}" title="Text Color" t-on-click="toggleDropdownTool('textColorTool')">${TEXT_COLOR_ICON}</span>
            <ColorPicker t-if="state.activeTool === 'textColorTool'" t-on-color-picked="setColor('textColor')" t-key="textColor"/>
          </div>
          <div class="o-divider"/>
          <div class="o-tool  o-dropdown o-with-color">
            <span t-attf-style="border-color:{{fillColor}}" title="Fill Color" t-on-click="toggleDropdownTool('fillColorTool')">${FILL_COLOR_ICON}</span>
            <ColorPicker t-if="state.activeTool === 'fillColorTool'" t-on-color-picked="setColor('fillColor')" t-key="fillColor"/>
          </div>
          <div class="o-tool o-dropdown">
            <span title="Borders" t-on-click="toggleDropdownTool('borderTool')">${BORDERS_ICON}</span>
            <div class="o-dropdown-content o-border" t-if="state.activeTool === 'borderTool'">
              <div class="o-dropdown-line">
                <span class="o-line-item" t-on-click="setBorder('all')">${BORDERS_ICON}</span>
                <span class="o-line-item" t-on-click="setBorder('hv')">${BORDER_HV}</span>
                <span class="o-line-item" t-on-click="setBorder('h')">${BORDER_H}</span>
                <span class="o-line-item" t-on-click="setBorder('v')">${BORDER_V}</span>
                <span class="o-line-item" t-on-click="setBorder('external')">${BORDER_EXTERNAL}</span>
              </div>
              <div class="o-dropdown-line">
                <span class="o-line-item" t-on-click="setBorder('left')">${BORDER_LEFT}</span>
                <span class="o-line-item" t-on-click="setBorder('top')">${BORDER_TOP}</span>
                <span class="o-line-item" t-on-click="setBorder('right')">${BORDER_RIGHT}</span>
                <span class="o-line-item" t-on-click="setBorder('bottom')">${BORDER_BOTTOM}</span>
                <span class="o-line-item" t-on-click="setBorder('clear')">${BORDER_CLEAR}</span>
              </div>
            </div>
          </div>
          <div class="o-tool" title="Merge Cells"  t-att-class="{active:inMerge, 'o-disabled': cannotMerge}" t-on-click="toggleMerge">${MERGE_CELL_ICON}</div>
          <div class="o-divider"/>
          <div class="o-tool o-dropdown" title="Horizontal align" t-on-click="toggleDropdownTool('alignTool')">
            <span>
              <t t-if="style.align === 'right'">${ALIGN_RIGHT_ICON}</t>
              <t t-elif="style.align === 'center'">${ALIGN_CENTER_ICON}</t>
              <t t-else="">${ALIGN_LEFT_ICON}</t>
              ${TRIANGLE_DOWN_ICON}
            </span>
            <div t-if="state.activeTool === 'alignTool'" class="o-dropdown-content">
              <div class="o-dropdown-item" t-on-click="toggleAlign('left')">${ALIGN_LEFT_ICON}</div>
              <div class="o-dropdown-item" t-on-click="toggleAlign('center')">${ALIGN_CENTER_ICON}</div>
              <div class="o-dropdown-item" t-on-click="toggleAlign('right')">${ALIGN_RIGHT_ICON}</div>
            </div>
          </div>
          <!-- <div class="o-tool" title="Vertical align"><span>${ALIGN_MIDDLE_ICON}</span> ${TRIANGLE_DOWN_ICON}</div> -->
          <!-- <div class="o-tool" title="Text Wrapping">${TEXT_WRAPPING_ICON}</div> -->
        </div>
        <Composer inputStyle="composerStyle" focus="props.focusComposer"/>

      </div>
    </div>`;
    TopBar.style = css$i /* scss */ `
    .o-spreadsheet-topbar {
      background-color: white;
      display: flex;
      flex-direction: column;
      font-size: 13px;

      .o-topbar-top {
        border-bottom: 1px solid #e0e2e4;
        display: flex;
        padding: 2px 10px;
        justify-content: space-between;

        /* Menus */
        .o-topbar-topleft {
          display: flex;
          .o-topbar-menu {
            padding: 4px 6px;
            margin: 0 2px;
            cursor: pointer;
          }

          .o-topbar-menu:hover {
            background-color: #f1f3f4;
            border-radius: 2px;
          }
        }

        .o-topbar-topright {
          display: flex;
          justify-content: flex-end;
        }
      }
      /* Toolbar + Cell Content */
      .o-topbar-toolbar {
        border-bottom: 1px solid #e0e2e4;
        display: flex;

        .o-composer-container {
          height: 34px;
        }

        /* Toolbar */
        .o-toolbar-tools {
          display: flex;
          flex-shrink: 0;
          margin-left: 20px;
          color: #333;
          cursor: default;

          .o-tool {
            display: flex;
            align-items: center;
            margin: 2px;
            padding: 0 3px;
            border-radius: 2px;
            cursor: pointer;
            min-width: fit-content;
          }

          .o-tool.active,
          .o-tool:not(.o-disabled):hover {
            background-color: #f1f3f4;
          }

          .o-with-color > span {
            border-bottom: 4px solid;
            height: 16px;
            margin-top: 2px;
          }

          .o-with-color {
            .o-line-item:hover {
              outline: 1px solid gray;
            }
          }

          .o-border {
            .o-line-item {
              padding: 4px;
              margin: 1px;
            }
          }

          .o-divider {
            display: inline-block;
            border-right: 1px solid #e0e2e4;
            width: 0;
            margin: 0 6px;
          }

          .o-disabled {
            opacity: 0.6;
          }

          .o-dropdown {
            position: relative;

            .o-text-icon {
              height: 100%;
              line-height: 30px;
              > svg {
                margin-bottom: -5px;
              }
            }

            .o-text-options > div {
              line-height: 26px;
              padding: 3px 12px;
              &:hover {
                background-color: rgba(0, 0, 0, 0.08);
              }
            }

            .o-dropdown-content {
              position: absolute;
              top: calc(100% + 5px);
              left: 0;
              z-index: 10;
              box-shadow: 1px 2px 5px 2px rgba(51, 51, 51, 0.15);
              background-color: white;

              .o-dropdown-item {
                padding: 7px 10px;
              }

              .o-dropdown-item:hover {
                background-color: rgba(0, 0, 0, 0.08);
              }

              .o-dropdown-line {
                display: flex;
                padding: 3px 6px;

                .o-line-item {
                  width: 16px;
                  height: 16px;
                  margin: 1px 3px;

                  &:hover {
                    background-color: rgba(0, 0, 0, 0.08);
                  }
                }
              }

              &.o-format-tool {
                width: 180px;
                padding: 7px 0;
                > div {
                  padding-left: 25px;

                  &.active:before {
                    content: "✓";
                    font-weight: bold;
                    position: absolute;
                    left: 10px;
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
    TopBar.components = { ColorPicker, Menu, Composer };

    const { Component: Component$h, useState: useState$g } = owl__namespace;
    const { useRef: useRef$5, useExternalListener: useExternalListener$4 } = owl.hooks;
    const { xml: xml$k, css: css$j } = owl.tags;
    const { useSubEnv } = owl.hooks;
    // -----------------------------------------------------------------------------
    // SpreadSheet
    // -----------------------------------------------------------------------------
    const TEMPLATE$h = xml$k /* xml */ `
  <div class="o-spreadsheet" t-on-save-requested="save" t-on-keydown="onKeydown">
    <TopBar
      t-on-click="focusGrid"
      t-on-composer-focused="onTopBarComposerFocused"
      focusComposer="focusTopBarComposer"
      class="o-two-columns"/>
    <Grid
      model="model"
      sidePanelIsOpen="sidePanel.isOpen"
      t-ref="grid"
      focusComposer="focusGridComposer"
      t-on-composer-focused="onGridComposerFocused"
      t-att-class="{'o-two-columns': !sidePanel.isOpen}"/>
    <SidePanel t-if="sidePanel.isOpen"
           t-on-close-side-panel="sidePanel.isOpen = false"
           component="sidePanel.component"
           panelProps="sidePanel.panelProps"/>
    <BottomBar t-on-click="focusGrid" class="o-two-columns"/>
  </div>`;
    const CSS$g = css$j /* scss */ `
  .o-spreadsheet {
    display: grid;
    grid-template-rows: ${TOPBAR_HEIGHT}px auto ${BOTTOMBAR_HEIGHT + 1}px;
    grid-template-columns: auto 350px;
    * {
      font-family: "Roboto", "RobotoDraft", Helvetica, Arial, sans-serif;
    }
    &,
    *,
    *:before,
    *:after {
      box-sizing: content-box;
    }
  }

  .o-two-columns {
    grid-column: 1 / 3;
  }

  .o-icon {
    width: 18px;
    height: 18px;
    opacity: 0.6;
  }
`;
    const t = (s) => s;
    class Spreadsheet extends Component$h {
        constructor() {
            super(...arguments);
            this.model = new Model(this.props.data, {
                notifyUser: (content) => this.trigger("notify-user", { content }),
                askConfirmation: (content, confirm, cancel) => this.trigger("ask-confirmation", { content, confirm, cancel }),
                editText: (title, placeholder, callback) => this.trigger("edit-text", { title, placeholder, callback }),
                openSidePanel: (panel, panelProps = {}) => this.openSidePanel(panel, panelProps),
                evalContext: { env: this.env },
            });
            this.grid = useRef$5("grid");
            this.sidePanel = useState$g({ isOpen: false, panelProps: {} });
            this.composer = useState$g({
                topBar: false,
                grid: false,
            });
            // last string that was cut or copied. It is necessary so we can make the
            // difference between a paste coming from the sheet itself, or from the
            // os clipboard
            this.clipBoardString = "";
            this.keyDownMapping = {
                "CTRL+H": () => this.toggleSidePanel("FindAndReplace", {}),
                "CTRL+F": () => this.toggleSidePanel("FindAndReplace", {}),
            };
            useSubEnv({
                openSidePanel: (panel, panelProps = {}) => this.openSidePanel(panel, panelProps),
                toggleSidePanel: (panel, panelProps = {}) => this.toggleSidePanel(panel, panelProps),
                dispatch: this.model.dispatch,
                getters: this.model.getters,
                _t: Spreadsheet._t,
                clipboard: navigator.clipboard,
                export: this.model.exportData.bind(this.model),
            });
            useExternalListener$4(window, "resize", this.render);
            useExternalListener$4(document.body, "cut", this.copy.bind(this, true));
            useExternalListener$4(document.body, "copy", this.copy.bind(this, false));
            useExternalListener$4(document.body, "paste", this.paste);
            useExternalListener$4(document.body, "keyup", this.onKeyup.bind(this));
        }
        get focusTopBarComposer() {
            return this.model.getters.getEditionMode() !== "inactive" && this.composer.topBar;
        }
        get focusGridComposer() {
            return this.model.getters.getEditionMode() !== "inactive" && this.composer.grid;
        }
        mounted() {
            this.model.on("update", this, this.render);
        }
        willUnmount() {
            this.model.off("update", this);
        }
        destroy() {
            this.model.destroy();
            super.destroy();
        }
        openSidePanel(panel, panelProps) {
            this.sidePanel.component = panel;
            this.sidePanel.panelProps = panelProps;
            this.sidePanel.isOpen = true;
        }
        toggleSidePanel(panel, panelProps) {
            if (this.sidePanel.isOpen && panel === this.sidePanel.component) {
                this.sidePanel.isOpen = false;
                this.focusGrid();
            }
            else {
                this.openSidePanel(panel, panelProps);
            }
        }
        focusGrid() {
            this.grid.comp.focus();
        }
        copy(cut, ev) {
            if (!this.grid.el.contains(document.activeElement)) {
                return;
            }
            const type = cut ? "CUT" : "COPY";
            const target = this.model.getters.getSelectedZones();
            this.model.dispatch(type, { target });
            const content = this.model.getters.getClipboardContent();
            this.clipBoardString = content;
            ev.clipboardData.setData("text/plain", content);
            ev.preventDefault();
        }
        paste(ev) {
            if (!this.grid.el.contains(document.activeElement)) {
                return;
            }
            const clipboardData = ev.clipboardData;
            if (clipboardData.types.indexOf("text/plain") > -1) {
                const content = clipboardData.getData("text/plain");
                const target = this.model.getters.getSelectedZones();
                if (this.clipBoardString === content) {
                    // the paste actually comes from o-spreadsheet itself
                    this.model.dispatch("PASTE", { target, interactive: true });
                }
                else {
                    this.model.dispatch("PASTE_FROM_OS_CLIPBOARD", {
                        target,
                        text: content,
                    });
                }
            }
        }
        save() {
            this.trigger("save-content", {
                data: this.model.exportData(),
            });
        }
        onKeyup(ev) {
            if (ev.key === "Control" && this.model.getters.getSelectionMode() !== SelectionMode.expanding) {
                this.model.dispatch("STOP_SELECTION");
            }
        }
        onKeydown(ev) {
            if (ev.key === "Control" && !ev.repeat) {
                this.model.dispatch(this.model.getters.getSelectionMode() === SelectionMode.idle
                    ? "PREPARE_SELECTION_EXPANSION"
                    : "START_SELECTION_EXPANSION");
            }
            let keyDownString = "";
            if (ev.ctrlKey || ev.metaKey) {
                keyDownString += "CTRL+";
            }
            keyDownString += ev.key.toUpperCase();
            let handler = this.keyDownMapping[keyDownString];
            if (handler) {
                ev.preventDefault();
                ev.stopPropagation();
                handler();
                return;
            }
        }
        onTopBarComposerFocused(ev) {
            this.composer.grid = false;
            this.composer.topBar = true;
            this.setComposerContent(ev.detail || {});
        }
        onGridComposerFocused(ev) {
            this.composer.topBar = false;
            this.composer.grid = true;
            this.setComposerContent(ev.detail || {});
        }
        /**
         * Start the edition or update the content if it's already started.
         */
        setComposerContent({ content, selection, }) {
            if (this.model.getters.getEditionMode() === "inactive") {
                this.model.dispatch("START_EDITION", { text: content, selection });
            }
            else if (content) {
                this.model.dispatch("SET_CURRENT_CONTENT", { content, selection });
            }
        }
    }
    Spreadsheet.template = TEMPLATE$h;
    Spreadsheet.style = CSS$g;
    Spreadsheet.components = { TopBar, Grid, BottomBar, SidePanel };
    Spreadsheet._t = t;

    /**
     * We export here all entities that needs to be accessed publicly by Odoo.
     *
     * Note that the __info__ key is actually completed by the build process (see
     * the rollup.config.js file)
     */
    const __info__ = {};
    const SPREADSHEET_DIMENSIONS = {
        MIN_ROW_HEIGHT,
        MIN_COL_WIDTH,
        HEADER_HEIGHT,
        HEADER_WIDTH,
        TOPBAR_HEIGHT,
        BOTTOMBAR_HEIGHT,
        DEFAULT_CELL_WIDTH,
        DEFAULT_CELL_HEIGHT,
        SCROLLBAR_WIDTH,
    };
    const registries$1 = {
        autofillModifiersRegistry,
        autofillRulesRegistry,
        cellMenuRegistry,
        colMenuRegistry,
        functionRegistry,
        uiPluginRegistry,
        corePluginRegistry,
        rowMenuRegistry,
        sidePanelRegistry,
        sheetMenuRegistry,
        topbarMenuRegistry,
        topbarComponentRegistry,
    };
    const helpers = {
        args,
        toBoolean,
        toNumber,
        toString,
        toXC,
        toZone,
        toCartesian,
        numberToLetters,
        createFullMenuItem,
        uuidv4,
        formatDecimal,
        computeTextWidth,
    };

    exports.CorePlugin = CorePlugin;
    exports.DATETIME_FORMAT = DATETIME_FORMAT;
    exports.Model = Model;
    exports.SPREADSHEET_DIMENSIONS = SPREADSHEET_DIMENSIONS;
    exports.Spreadsheet = Spreadsheet;
    exports.UIPlugin = UIPlugin;
    exports.__DEBUG__ = DEBUG;
    exports.__info__ = __info__;
    exports.astToFormula = astToFormula;
    exports.functionCache = functionCache;
    exports.helpers = helpers;
    exports.normalize = normalize;
    exports.parse = parse;
    exports.registries = registries$1;
    exports.setTranslationMethod = setTranslationMethod;

    Object.defineProperty(exports, '__esModule', { value: true });

    exports.__info__.version = '2.0.0';
    exports.__info__.date = '2021-02-10T07:57:10.942Z';
    exports.__info__.hash = 'cbc83d2';

}(this.o_spreadsheet = this.o_spreadsheet || {}, owl));
//# sourceMappingURL=o_spreadsheet.js.map
