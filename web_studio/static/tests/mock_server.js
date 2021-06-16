/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, "web_studio.MockServer", {
    performRPC(route, args) {
        if (route === "/web_studio/activity_allowed") {
            return Promise.resolve(this.mockActivityAllowed());
        }
        if (route === "/web_studio/get_studio_view_arch") {
            return Promise.resolve(this.mockGetStudioViewArch());
        }
        if (route === "/web_studio/chatter_allowed") {
            return Promise.resolve(this.mockChatterAllowed());
        }
        if (route === "/web_studio/get_default_value") {
            return Promise.resolve(this.mockGetDefaultValue());
        }
        return this._super(...arguments);
    },

    mockActivityAllowed() {
        return false;
    },

    mockChatterAllowed() {
        return false;
    },

    mockGetStudioViewArch() {
        return {
            studio_view_id: false,
            studio_view_arch: "<data/>",
        };
    },

    mockGetDefaultValue() {
        return {};
    },
});
