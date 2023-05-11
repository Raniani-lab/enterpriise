/** @odoo-module */

import { unpatch } from "@web/core/utils/patch";
import { GraphRenderer } from "@web/views/graph/graph_renderer";

unpatch(GraphRenderer.prototype, "graph_spreadsheet");
