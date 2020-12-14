/** @odoo-module alias=documents_spreadsheet.Autofill */

import spreadsheet from "../o_spreadsheet_loader";

const { autofillModifiersRegistry, autofillRulesRegistry } = spreadsheet.registries

const UP = 0;
const DOWN = 1;
const LEFT = 2;
const RIGHT = 3;

//--------------------------------------------------------------------------
// Autofill Component
//--------------------------------------------------------------------------
class AutofillTooltip extends owl.Component {}
AutofillTooltip.template = "documents_spreadsheet.AutofillTooltip";

//--------------------------------------------------------------------------
// Autofill Rules
//--------------------------------------------------------------------------

autofillRulesRegistry.add("autofill_pivot", {
    condition: (cell) => cell && cell.type === "formula" && cell.formula.text.match(/=\s*PIVOT/),
    generateRule: (cell, cells) => {
        const increment = cells.filter(
            (cell) => cell && cell.type === "formula" && cell.formula.text.match(/=\s*PIVOT/)
        ).length;
        return { type: "PIVOT_UPDATER", increment, current: 0 };
    },
    sequence: 10,
}).add("autofill_pivot_position", {
    condition: (cell) => cell && cell.type === "formula" && cell.formula.text.match(/=.*PIVOT.*PIVOT\.POSITION/),
    generateRule: () => ({ type: "PIVOT_POSITION_UPDATER", current: 0 }),
    sequence: 1,
});

//--------------------------------------------------------------------------
// Autofill Modifier
//--------------------------------------------------------------------------

autofillModifiersRegistry.add("PIVOT_UPDATER", {
    apply: (rule, data, getters, direction) => {
        rule.current += rule.increment;
        let isColumn;
        let steps;
        switch (direction) {
            case UP:
                isColumn = false;
                steps = -rule.current;
                break;
            case DOWN:
                isColumn = false;
                steps = rule.current;
                break;
            case LEFT:
                isColumn = true;
                steps = -rule.current;
                break;
            case RIGHT:
                isColumn = true;
                steps = rule.current;
        }
        const content = getters.getNextValue(
            getters.getFormulaCellContent(data.sheetId, data.cell), isColumn, steps
        );
        let tooltip = {
            props: {
                content: data.content,
            }
        };
        if (content && content !== data.content) {
            tooltip = {
                props: {
                    content: getters.getTooltipFormula(content, isColumn),
                },
                component: AutofillTooltip,
            }
        }
        if (!content) {
            tooltip = undefined;
        }
        return {
            cellData: {
                style: undefined,
                format: undefined,
                border: undefined,
                content,
            },
            tooltip,
        };
    },
}).add("PIVOT_POSITION_UPDATER", {
    /**
     * Increment (or decrement) positions in template pivot formulas.
     * Autofilling vertically increments the field of the deepest row
     * group of the formula. Autofilling horizontally does the same for
     * column groups.
     */
    apply: (rule, data, getters, direction) => {
        const formulaString =
            data.cell.type === "formula"
                ? getters.getFormulaCellContent(data.sheetId, data.cell)
                : "";
        const pivotId = formulaString.match(/PIVOT\.POSITION\(\s*"(\w+)"\s*,/)[1];
        const pivot = getters.getPivot(pivotId);
        if (!pivot) return { cellData: {...data.cell, content: formulaString } };
        const fields = [UP, DOWN].includes(direction)
            ? pivot.rowGroupBys.slice()
            : pivot.colGroupBys.slice();
        const step = [RIGHT, DOWN].includes(direction) ? 1 : -1;

        const field = fields
            .reverse()
            .find((field) => new RegExp(`PIVOT\\.POSITION.*${field}.*\\)`).test(formulaString));
        const content = formulaString.replace(
            new RegExp(`(.*PIVOT\\.POSITION\\(\\s*"\\w"\\s*,\\s*"${field}"\\s*,\\s*"?)(\\d+)(.*)`),
            (match, before, position, after) => {
                rule.current += step;
                return before + Math.max(parseInt(position) + rule.current, 1) + after;
            }
        );
        return {
            cellData: {...data.cell, content },
            tooltip: content ? {
                props: { content },
            } : undefined,
        }
    },
});
