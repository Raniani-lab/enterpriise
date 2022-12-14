/** @odoo-module **/

import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";

const { useRef, useEffect } = owl;

export class MrpWorkorderKanbanRenderer extends KanbanRenderer {

    setup() {
        super.setup();
        const rootRef = useRef("root");
        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                const handler = (ev) => {
                    if (/^[A-Za-z0-9]$/.test(ev.key)) {
                        const searchviewInput = ev.target.parentElement.parentElement.querySelector(".o_searchview_input");
                        searchviewInput.focus();
                    }
                };
                el.tabIndex = 0;
                el.addEventListener("keydown", handler);
                return () => {
                    el.removeEventListener("keydown", handler);
                };
            },
            () => [rootRef.el]
        );
    }
}
