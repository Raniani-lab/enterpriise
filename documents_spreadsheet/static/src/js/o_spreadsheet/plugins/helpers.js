odoo.define("documents_spreadsheet/static/src/js/o_spreadsheet/plugins/helpers.js", function (require) {

    const spreadsheet = require("documents_spreadsheet.spreadsheet");
    const { parse } = spreadsheet;
    /**
     * Parse a pivot formula, returns the name of the first functions and the 
     * corresponding args
     *
     * @param {string} formula
     * @returns {Object} functionName: name of the function, args: array of string
     */
    function getFormulaNameAndArgs(formula) {
        const ast = parse(formula);
        return _parseFormulaHelper(ast, [])[0];
    }

    /**
     * Parse a pivot formula, returns the name of the functions and the 
     * corresponding args
     *
     * @param {string} formula
     *
     * @returns {number}
     */
     function getNumberOfPivotFormulas(formula) {
        const ast = parse(formula);
        return _parseFormulaHelper(ast, []).length;
    }

    /**
     * Takes an AST and returns a Array of objects
     * containing the name of the PIVOT functions and their args
     *
     * @param {string} formula
     *
     * @private
     * @returns {Array} functionName: name of the function, args: array of string
     */
     function _parseFormulaHelper(ast, pivots) {
        switch (ast.type) {
            case "UNARY_OPERATION":
                return _parseFormulaHelper(ast.right, pivots);
            case "BIN_OPERATION": {
                const left = _parseFormulaHelper(ast.left, []);
                const right = _parseFormulaHelper(ast.right, []);
                return [
                    ...pivots,
                    ...(Array.isArray(left) ? left : []),
                    ...(Array.isArray(right) ? right : []),
                ];
            }
            case "FUNCALL":
            case "ASYNC_FUNCALL": {
                const functionName = ast.value;
                const parsedFormulaArgs = ast.args.map((arg) => _parseFormulaHelper(arg, []));
                if (["PIVOT", "PIVOT.HEADER", "PIVOT.POSITION"].includes(functionName)) {
                    return [{ functionName, args: parsedFormulaArgs }];
                } else {
                    parsedFormulaArgs.forEach(arg => {
                        pivots.push(arg[0]);
                    });
                    return pivots;
                }
            }
            case "NUMBER":
                return ast.value.toString();
            case "STRING":
                return ast.value.slice(1, -1);
            default :
                return pivots;
        }
    }

    return {
        getFormulaNameAndArgs,
        getNumberOfPivotFormulas
    }
});
