/** @odoo-module */

import { Component, useRef, useState } from "@odoo/owl";

export class AccountReportSearchBar extends Component {
    static template = "account_reports.AccountReportSearchBar";
    static props = {};

    setup() {
        this.searchText = useRef("search_bar_input");
        this.controller = useState(this.env.controller);
    }

    //------------------------------------------------------------------------------------------------------------------
    // Search
    //------------------------------------------------------------------------------------------------------------------
    search() {
        const searchQuery = this.searchText.el.value.trim().toLowerCase();

        let lineIndex = 0;
        let linesIDsMatched = {
            lines: new Set(),
            ancestors: {},
        };

        while (lineIndex < this.controller.lines.length) {
            let line = this.controller.lines[lineIndex];
            let lineName = line.name.trim().toLowerCase();
            let searchMatch = (lineName.indexOf(searchQuery) !== -1);

            if (searchMatch) {
                linesIDsMatched.lines.add(line.id);
                linesIDsMatched.ancestors[line.id.split('|')[0]] = line.level;
            }

            lineIndex += 1;
        }

        if (searchQuery.length > 0 && linesIDsMatched.lines.size > 0)
            this.controller.lines_searched = linesIDsMatched;
        else
            delete this.controller.lines_searched;
    }
}
