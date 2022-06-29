/** @odoo-module **/

const { Component, onMounted, useRef, useState } = owl;

export class DocumentsDropZone extends Component {
    setup() {
        this.state = useState({
            dragOver: false,
            topOffset: 0,
        });
        this.root = useRef("root");
        onMounted(() => this.props.setDropZone(this));
    }

    move(px) {
        this.state.topOffset = px;
    }

    toggle(newState) {
        if (newState != this.state.dragOver) {
            this.state.dragOver = newState;
        }
    }
}
DocumentsDropZone.template = "documents.DocumentsDropZone";
