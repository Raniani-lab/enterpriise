/** @odoo-module */

import { Chatter } from "@mail/web/chatter";

import { Component } from "@odoo/owl";

export class ChatterContainer extends Chatter {
    onClick(ev) {
        this.env.config.onNodeClicked({
            xpath: this.props.studioXpath,
            target: ev.target,
        });
    }
}
ChatterContainer.template = "web_studio.ChatterContainer";
ChatterContainer.props = [...Chatter.props, "studioXpath?"];

export class ChatterContainerHook extends Component {
    onClick() {
        this.env.config.onViewChange({
            structure: "chatter",
            ...this.props.chatterData,
        });
    }
}
ChatterContainerHook.template = "web_studio.ChatterContainerHook";
ChatterContainerHook.components = { Chatter };
ChatterContainerHook.props = {
    chatterData: Object,
    threadModel: String,
};
