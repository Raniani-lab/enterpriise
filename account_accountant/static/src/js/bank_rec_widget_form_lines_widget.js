/** @odoo-module **/
"use strict";

import AbstractFieldOwl from 'web.AbstractFieldOwl';
import field_registry from 'web.field_registry_owl';
import { _lt } from 'web.core';


export class BankRecWidgetFormLinesWidget extends AbstractFieldOwl{

    range(n){
        return [...Array(Math.max(n, 0)).keys()];
    }

    /** Create the data to render the template **/
    getRenderValues(){
        let data = this.record.data.lines_widget;

        // Prepare columns.
        let columns = [
            ["account", _lt("Account")],
            ["partner", _lt("Partner")],
            ["date", _lt("Date")],
            ["label", _lt("Label")],
        ];
        if(data.display_analytic_account_column){
            columns.push(["analytic_account", _lt("Analytic Account")]);
        }
        if(data.display_analytic_tags_column){
            columns.push(["analytic_tags", _lt("Analytic Tags")]);
        }
        if(data.display_multi_currency_column){
            columns.push(["amount_currency", _lt("Amount Currency")], ["currency", _lt("Currency")]);
        }
        if(data.display_taxes_column){
            columns.push(["taxes", _lt("Taxes")]);
        }
        columns.push(["debit", _lt("Debit")], ["credit", _lt("Credit")], ["__trash", ""]);

        return {...data, columns: columns}
    }

    /** The user clicked on a row **/
    _onClickMountLine(ev){
        ev.stopPropagation();

        // Get the index of the clicked line.
        let index = ev.currentTarget.getAttribute("index");

        // Get the name of the clicked field.
        let selectedField = null;
        let evPath = ev.path || (ev.composedPath && ev.composedPath()); // ev.path is not standard
        if(evPath){
            let tdElements = evPath.filter(x => x.tagName && x.tagName.toLowerCase() === "td");
            if(tdElements.length > 0){
                let clickedElement = tdElements[0];
                selectedField = clickedElement.getAttribute("field");
            }
        }

        this.trigger("lines-widget-mount-line", {
            index: index,
            selectedField: selectedField,
        });
    }

    /** The user clicked on the trash button **/
    _onClickRemoveLine(ev){
        ev.stopPropagation();
        let index = ev.currentTarget.getAttribute("index");
        this.trigger("lines-widget-remove-line", {index: index});
    }

    /** The user clicked on the link to see the journal entry details **/
    _onClickShowMove(ev){
        ev.stopPropagation();
        this.trigger("button_clicked", {attrs: {
            name: "button_form_redirect_to_move_form",
            type: "object",
            method_args: JSON.stringify([ev.currentTarget.getAttribute('move-id')]),
        }});
    }

    _onClickExpandCollapseExtraNote(ev) {
        ev.stopPropagation();
        let classList = ev.currentTarget.querySelector(".extra-notes").classList;
        let foldedClass = "d-none";

        if (classList.contains(foldedClass)) {
            classList.remove(foldedClass);
        } else {
            classList.add(foldedClass);
        }
    }

}
BankRecWidgetFormLinesWidget.template = "account_accountant.bank_rec_widget_form_lines_widget";

field_registry.add("bank_rec_widget_form_lines_widget", BankRecWidgetFormLinesWidget);
