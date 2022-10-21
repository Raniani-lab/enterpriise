/** @odoo-module **/

const { Component } = owl;

export class SelectionPopup extends Component {

    get title() {
        return this.props.popupData.title;
    }

    get list() {
        return this.props.popupData.list;
    }

    cancel() {
        this.props.onClosePopup('SelectionPopup', true);
    }

    async selectItem(id) {
        await this.props.onSelectEmployee(id);
        this.props.onClosePopup('SelectionPopup');
    }
}
SelectionPopup.props = {
    popupData: Object,
    onClosePopup: Function,
    onSelectEmployee: Function,
};
SelectionPopup.template = 'mrp_workorder_hr.SelectionPopup';
