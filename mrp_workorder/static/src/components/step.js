/** @odoo-module **/

const { Component } = owl;

class StepComponent extends Component {

    get isSelected() {
        return this.props.step.id === this.props.selectedStepId;
    }

    selectStep() {
        this.props.onSelectStep(this.props.step.id);
    }

    get title() {
        return this.props.step.title || this.props.step.test_type;
    } 

}

StepComponent.template = 'mrp_workorder.StepComponent';
StepComponent.props = ["step", "onSelectStep", "selectedStepId"];

export default StepComponent;
