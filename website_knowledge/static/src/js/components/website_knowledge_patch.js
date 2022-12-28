/** @odoo-module **/

import { PermissionPanel } from "@knowledge/components/permission_panel/permission_panel";
import { CopyClipboardCharField } from "@web/views/fields/copy_clipboard/copy_clipboard_field";

PermissionPanel.components = {
    ...PermissionPanel.components,
    CopyClipboardCharField,
};
