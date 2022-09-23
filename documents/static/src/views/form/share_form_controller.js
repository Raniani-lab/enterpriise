/** @odoo-module **/

import { FormController } from "@web/views/form/form_controller";

import { useService } from "@web/core/utils/hooks";

const { onWillUpdateProps } = owl;

export class ShareFormController extends FormController {
    setup() {
        super.setup(...arguments);
        this.notificationService = useService('notification');
        
        this.props.setShareResId(this.props.resId);
        onWillUpdateProps((nextProps) => {
            this.props.setShareResId(nextProps.resId);
        });
    }

    /**
     * @override
     */
    async beforeExecuteActionButton(clickParams) {
        if (clickParams.special === "save") {
            // Copy the share link to the clipboard
            navigator.clipboard.writeText(this.model.root.data.full_url);
            // Show a notification to the user about the copy to clipboard
            this.notificationService.add(
                this.env._t("The share url has been copied to your clipboard."),
                {
                    type: "success",
                },
            );
            this.props.setShouldDelete(false);
        }
        return super.beforeExecuteActionButton(...arguments);
    }
};
ShareFormController.props = {
    ...FormController.props,
    setShareResId:  { type: Function },
    setShouldDelete: { type: Function },
}
