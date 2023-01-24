/** @odoo-module **/

import { Component, useEffect, useRef } from "@odoo/owl";

export class GanttCellButtons extends Component {
    static props = {
        reactive: {
            type: Object,
            shape: {
                cell: [HTMLElement, { value: null }],
            },
        },
        canCreate: Boolean,
        canPlan: Boolean,
        onCreate: Function,
        onPlan: Function,
    };
    static template = "web_gantt.GanttCellButtons";

    setup() {
        const rootRef = useRef("root");
        useEffect(
            /** @param {HTMLElement | null} cell */
            (cell) => {
                if (!cell) {
                    return;
                }
                const rootRect = rootRef.el.getBoundingClientRect();
                const cellRect = cell.getBoundingClientRect();
                const parentBox = rootRef.el.parentElement.getBoundingClientRect();
                const top = cellRect.top - parentBox.top;
                const left = cellRect.left - parentBox.left + (cellRect.width - rootRect.width) / 2;
                Object.assign(rootRef.el.style, { top: `${top}px`, left: `${left}px` });
            },
            () => [this.props.reactive.cell]
        );
    }

    onCreate() {
        this.props.onCreate(this.props.reactive.cell.dataset);
    }

    onPlan() {
        this.props.onPlan(this.props.reactive.cell.dataset);
    }
}
