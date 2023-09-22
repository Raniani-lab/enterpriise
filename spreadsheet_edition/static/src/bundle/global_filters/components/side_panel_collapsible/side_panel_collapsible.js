/** @odoo-module */

import { Component, useState, useRef, useEffect } from "@odoo/owl";

export class SidePanelCollapsible extends Component {
    setup() {
        this.state = useState({ collapsed: this.props.collapsedAtInit ?? true });
        this.collapsibleRef = useRef("collapsible");

        useEffect(
            () => {
                // Set max-height value and animate the transition
                // Do it in a useEffect to wait for collapsibleRef.el.scrollHeight to be computed
                // First set max-height to undefined to have the correct scrollHeight measurement. That means that
                // we cannot use CSS transition and have to animate using JS.
                const startMaxHeight = this.collapsibleRef.el.style.maxHeight;
                this.collapsibleRef.el.style.maxHeight = "";
                const maxHeight = this.state.collapsed ? 0 : this.collapsibleRef.el.scrollHeight;
                this.collapsibleRef.el.style.maxHeight = `${maxHeight}px`;

                const keyFrames = [
                    { maxHeight: startMaxHeight },
                    { maxHeight: `${maxHeight}px` },
                ];

                this.collapsibleRef.el.animate(keyFrames, 200);
            },
            () => [this.state.collapsed, this.collapsibleRef.el]
        );
    }

    toggle() {
        this.state.collapsed = !this.state.collapsed;
    }
}

SidePanelCollapsible.template = "spreadsheet_edition.SidePanelCollapsible";
SidePanelCollapsible.props = {
    slots: Object,
    collapsedAtInit: { type: Boolean, optional: true },
};
