/** @odoo-module **/
"use strict";

import AbstractFieldOwl from 'web.AbstractFieldOwl';
import field_registry from 'web.field_registry_owl';


export class BankRecWidgetFormRecoModelsWidget extends AbstractFieldOwl{

    getRenderValues(){
        return this.record.data.reco_models_widget;
    }

    _onClickRecoModel(ev){
        ev.stopPropagation();
        let key = parseInt(ev.currentTarget.getAttribute('key'));
        let selected = parseInt(ev.currentTarget.getAttribute('selected'));
        this.trigger("reco-models-widget-button-clicked", {key: key, selected: selected});
    }

}

BankRecWidgetFormRecoModelsWidget.template = "account_accountant.bank_rec_widget_form_reco_models_widget";

field_registry.add("bank_rec_widget_form_reco_models_widget", BankRecWidgetFormRecoModelsWidget);
