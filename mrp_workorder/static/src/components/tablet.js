/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import core from "web.core";
import ViewsWidget from '@mrp_workorder/widgets/views_widget';
import DocumentViewer from '@mrp_workorder/components/viewer';
import StepComponent from '@mrp_workorder/components/step';
import ViewsWidgetAdapter from '@mrp_workorder/components/views_widget_adapter';
import MenuPopup from '@mrp_workorder/components/menuPopup';
import SummaryStep from '@mrp_workorder/components/summary_step';

const {useState, useEffect, onWillStart, EventBus, Component, markup} = owl;

/**
 * Main Component
 * Gather the workorder and its quality check information.
 */

class Tablet extends Component {
    //--------------------------------------------------------------------------
    // Lifecycle
    //--------------------------------------------------------------------------
    setup() {
        this.rpc = useService('rpc');
        this.orm = useService('orm');
        this.state = useState({
            selectedStepId: 0,
            workingState: "",
        });

        this.popup = useState({
            menu: {
                isShown: false,
                data: {},
            }
        });
        this.workorderId = this.props.action.context.active_id;
        this.additionalContext = this.props.action.context;
        this.ViewsWidget = ViewsWidget;
        this.bus = new EventBus();
        this.bus.on('refresh', this, async () => {
            await this.getState();
            this.render();
        });
        this.bus.on('workorder_event', this, (method) => {
            this[method]();
        });
        this.bus.on('exit', this, this.exit);
        core.bus.on('barcode_scanned', this, this._onBarcodeScanned);
        onWillStart(async () => {
            await this._onWillStart();
        });

        useEffect(() => {
            this._scrollToHighlighted();
        });
    }

    _scrollToHighlighted() {
        let selectedLine = document.querySelector('.o_tablet_timeline .o_tablet_step.o_selected');
        if (selectedLine) {
            // If a line is selected, checks if this line is entirely visible
            // and if it's not, scrolls until the line is.
            const headerHeight = document.querySelector('.o_legacy_form_view').offsetHeight.height;
            const lineRect = selectedLine.getBoundingClientRect();
            const page = document.querySelector('.o_tablet_timeline');
            // Computes the real header's height (the navbar is present if the page was refreshed).
            let scrollCoordY = false;
            if (lineRect.top < headerHeight) {
                scrollCoordY = lineRect.top - headerHeight + page.scrollTop;
            } else if (lineRect.bottom > window.innerHeight) {
                const pageRect = page.getBoundingClientRect();
                scrollCoordY = page.scrollTop - (pageRect.bottom - lineRect.bottom);
            }
            if (scrollCoordY !== false) { // Scrolls to the line only if it's not entirely visible.
                page.scroll({ left: 0, top: scrollCoordY, behavior: this._scrollBehavior });
                this._scrollBehavior = 'smooth';
            }
        }
    }

    async getState() {
        this.data = await this.orm.call(
            'mrp.workorder',
            'get_workorder_data',
            [this.workorderId],
        );
        this.steps = this.data['quality.check'];
        this.state.workingState = this.data.working_state;
        if (this.steps.length && this.steps.every(step => step.quality_state !== 'none')) {
            this.createSummaryStep();
        } else {
            this.state.selectedStepId = this.data['mrp.workorder'].current_quality_check_id;
        }
    }

    createSummaryStep() {
        this.steps.push({
            id: 0,
            title: 'Summary',
            test_type: '',
        });
        this.state.selectedStepId = 0;
    }

    async exit(ev) {
        await new Promise(resolve => this.bus.trigger('save', resolve));
        this._buttonClick('button_pending');
        this.env.config.historyBack();
    }

    async _buttonClick(method) {
        const res = await this.orm.call('mrp.workorder', method, [this.workorderId]);
        await this.getState();
        return res;
    }

    async selectStep(id) {
        await this.saveCurrentStep(id);
    }

    async saveCurrentStep(newId) {
        await new Promise(resolve => this.bus.trigger('save', resolve));
        this.orm.write(
            'mrp.workorder',
            [this.workorderId],
            {current_quality_check_id: newId},
        );
        this.state.selectedStepId = newId;
    }

    get worksheetData() {
        if (this.selectedStep) {
            if (this.selectedStep.worksheet_document) {
                return {
                    resModel: 'quality.check',
                    resId: this.state.selectedStepId,
                    resField: 'worksheet_document',
                    value: this.selectedStep.worksheet_document,
                    page: 1,
                };
            } else if (this.data.operation !== undefined && this.selectedStep.worksheet_page) {
                return {
                    resModel: 'mrp.routing.workcenter',
                    resId: this.data.operation.id,
                    resField: 'worksheet',
                    value: this.data.operation.worksheet,
                    page: this.selectedStep.worksheet_page,
                };
            } else {
                return false;
            }

        } else if (this.data.operation.worksheet) {
            return {
                resModel: 'mrp.routing.workcenter',
                resId: this.data.operation.id,
                resField: 'worksheet',
                value: this.data.operation.worksheet,
                page: 1,
            };
        } else {
            return false;
        }
    }

    get selectedStep() {
        return this.state.selectedStepId && this.steps.find(
            l => l.id === this.state.selectedStepId
        );
    }

    get viewsWidgetData() {
        const data = {
            workorder: {
                model: 'mrp.workorder',
                view: 'mrp_workorder.mrp_workorder_view_form_tablet',
                additionalContext: this.additionalContext,
                params: {currentId: this.workorderId},
                currentId: this.workorderId,
                bus: this.bus
            },
            check: {
                model: 'quality.check',
                view: 'mrp_workorder.quality_check_view_form_tablet',
                additionalContext: this.additionalContext,
                params: {currentId: this.state.selectedStepId},
                currentId: this.state.selectedStepId,
                bus: this.bus
            },
        };
        return data;
    }

    get checkInstruction() {
        let note = this.data['mrp.workorder'].operation_note;
        if (note && note !== '<p><br></p>') {
            return markup(note);
        } else {
            return undefined;
        }
    }

    get isBlocked() {
        return this.state.workingState === 'blocked';
    }

    showPopup(props, popupId) {
        this.popup[popupId].isShown = true;
        this.popup[popupId].data = props;
    }

    closePopup(popupId) {
        this.getState();
        this.popup[popupId].isShown = false;
    }

    async onCloseRerender() {
        await this.getState();
        this.render();
    }

    openMenuPopup() {
        this.showPopup({
            title: 'Menu',
            workcenterId: this.data['mrp.workorder'].workcenter_id,
            selectedStepId: this.state.selectedStepId,
            workorderId: this.workorderId,
        }, 'menu');
    }

    async _onWillStart() {
        await this.getState();
    }

    _onBarcodeScanned(barcode) {
        const commands = {
            'O-BTN.pause': this._buttonClick.bind(this, 'action_pending'),
            'O-BTN.next': this.validate.bind(this),
            'O-BTN.prev': this.previousStep.bind(this),
            'O-BTN.skip': this.nextStep.bind(this),
            'O-BTN.cloWO': this._buttonClick.bind(this, 'do_finish'),
            'O-BTN.cloMO': this._buttonClick.bind(this, 'action_open_manufacturing_order'),
            'O-BTN.pass': this._buttonClick.bind(this, 'do_pass'),
            'O-BTN.fail': this._buttonClick.bind(this, 'do_fail'),
            'O-BTN.record': this.recordProduction.bind(this),
        };
        if (commands[barcode]) {
            commands[barcode]();
        } else {
            this.orm.call('quality.check', 'on_barcode_scanned', [this.state.selectedStepId]);
        }

    }
}

Tablet.props = ['action', '*'];
Tablet.template = 'mrp_workorder.Tablet';
Tablet.components = {
    StepComponent,
    DocumentViewer,
    ViewsWidgetAdapter,
    MenuPopup,
    SummaryStep,
};

registry.category('actions').add('tablet_client_action', Tablet);

export default Tablet;
