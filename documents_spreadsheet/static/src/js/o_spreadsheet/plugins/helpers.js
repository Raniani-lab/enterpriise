odoo.define("documents_spreadsheet/static/src/js/o_spreadsheet/plugins/helpers.js", function (require) {

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { parse } = spreadsheet;
    /**
     * Parse a pivot formula, returns the name of the function and the args
     *
     * @private
     * @param {string} formula
     * @returns {Object} functionName: name of the function, args: array of string
     */
    function getFormulaNameAndArgs(formula) {
        const ast = parse(formula);
        const functionName = ast.value;
        let args = [];
        if (["PIVOT", "PIVOT.HEADER"].includes(functionName)) {
            args = ast.args.map((arg) => {
                switch (typeof arg.value) {
                    case "string":
                        return arg.value.slice(1, -1);
                    case "number":
                        return arg.value.toString();
                }
                return "";
            });
        }
        return { functionName, args };
    }

    return {
      getFormulaNameAndArgs,
    }
});
