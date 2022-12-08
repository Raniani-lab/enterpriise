/** @odoo-module **/
import { Component } from "@odoo/owl";
import { usePreparationDisplay } from "@pos_preparation_display/app/preparation_display_service";

export class Stages extends Component {
    static props = {
        stages: Object,
    };

    setup() {
        this.preparationDisplay = usePreparationDisplay();
    }
}

Stages.template = "pos_preparation_display.Stages";
