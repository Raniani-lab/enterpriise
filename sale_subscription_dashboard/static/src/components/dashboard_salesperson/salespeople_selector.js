/** @odoo-module **/

import { useSalespeopleDashboardData } from "@sale_subscription_dashboard/hooks/use_dashboard_data";
import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";
import { Component, useState } from "@odoo/owl";

export class SalespeopleSelector extends Component {
    setup() {
        this.state = useSalespeopleDashboardData();
        this.localState = useState({
            salespeople: [...this.state.selected_salespeople]
        });
    }

    onUpdateSalespeople() {
        this.state.selected_salespeople = [...this.localState.salespeople];
    }

    update(items) {
        this.localState.salespeople.push(...items);
    }

    removeSalesperson(id) {
        this.localState.salespeople = [...this.localState.salespeople.reduce((selectedSalespeople, currentSalesperson) => {
            if (currentSalesperson.id !== id) {
                selectedSalespeople.push(currentSalesperson);
            }
            return selectedSalespeople;
        }, [])];
    }

    getDomain() {
        const ids = this.state.available_salespeople.map(salesperson => salesperson.id);
        const unavailableIds = this.localState.salespeople.map(salesperson => salesperson.id);
        return [['id', 'in', ids], ['id', 'not in', unavailableIds]];
    }

    get tags() {
        return this.localState.salespeople.map(salesperson => {
            return {
                text: salesperson.name,
                img: `/web/image/res.users/${salesperson.id}/avatar_128`,
                onDelete: () => this.removeSalesperson(salesperson.id)
            }
        })
    }
}
SalespeopleSelector.components = {
    TagsList,
    Many2XAutocomplete
};
SalespeopleSelector.template = "sale_subscription_dashboard.SalespeopleSelector";
