/** @odoo-module */
import { Component, xml } from "@odoo/owl";

export class Sidebar extends Component {}
Sidebar.template = xml`
    <div class="o_web_studio_sidebar flex-grow-0 flex-shrink-0 overflow-auto">
      <div class="o_web_studio_sidebar_header">
        <t t-slot="header" />
      </div>
      <div class="o_web_studio_sidebar_content d-flex flex-column" style="gap: 12px;">
        <t t-slot="content" />
      </div>
    </div>
`;
Sidebar.props = ["slots?"];
