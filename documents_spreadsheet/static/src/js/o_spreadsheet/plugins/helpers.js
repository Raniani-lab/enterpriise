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
        return _parseFormulaHelper(ast)[0];
    }

    /**
     * get the number of pivot formulas in a formula.
     *
     * @param {string} formula
     * @param {boolean} onlyPivot Only count the "=PIVOT" and not the "PIVOT.HEADER"
     *
     * @returns {number}
     */
     function getNumberOfPivotFormulas(formula, onlyPivot = true) {
        const ast = parse(formula);
        const parsedFormulas = _parseFormulaHelper(ast, []);
        return onlyPivot 
            ? parsedFormulas.filter(parsedFormula => parsedFormula.functionName === "PIVOT").length 
            : parsedFormulas.length
        ;
    }

    /**
     * Takes an AST and returns a Array of objects
     * containing the name of the PIVOT functions and their args (not evaluated)
     *
     * @param {string} formula
     *
     * @private
     * @returns {Array} functionName: name of the function, args: array of string
     */
     function _parseFormulaHelper(ast) {
        switch (ast.type) {
            case "UNARY_OPERATION":
                return _parseFormulaHelper(ast.right)
            case "BIN_OPERATION": {
                return _parseFormulaHelper(ast.left).concat(_parseFormulaHelper(ast.right))
            }
            case "FUNCALL":
            case "ASYNC_FUNCALL": {
                const functionName = ast.value;
                    if (["PIVOT", "PIVOT.HEADER", "PIVOT.POSITION"].includes(functionName)) {
                        return [{ functionName, args: ast.args }]
                    } else {
                        return ast.args.map((arg) => _parseFormulaHelper(arg)).flat();
                }
            }
            default :
                return [];
        }
    }

    return {
        getFormulaNameAndArgs,
        getNumberOfPivotFormulas
    }
});
