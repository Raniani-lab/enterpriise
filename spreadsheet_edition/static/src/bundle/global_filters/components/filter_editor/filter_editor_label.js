/** @odoo-module */

const { Component, onMounted, useRef } = owl;

export default class FilterEditorLabel extends Component {
    setup() {
        this.labelInput = useRef("labelInput");
        onMounted(this.onMounted);
    }

    onMounted() {
        this.labelInput.el.focus();
    }
}
FilterEditorLabel.template = "spreadsheet_edition.FilterEditorLabel";
