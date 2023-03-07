/** @odoo-module **/

import { FormController } from "@web/views/form/form_controller";
import { useService } from "@web/core/utils/hooks";


export default class AppointmentOnboardingAppointmentTypeFormController extends FormController {
    setup() {
        super.setup();
        this.orm = useService('orm');
        this.actionService = useService('action');
    }
    /**
     * Overridden to mark the onboarding step as completed and reload the view.
     *
     * @override
     */
    async saveButtonClicked() {
        await super.saveButtonClicked();
        const validationResponse = await this.orm.call(
            'onboarding.onboarding.step',
            'action_validate_step',
            ['appointment.appointment_onboarding_create_appointment_type_step']
        );
        this.env.dialogData.close();
        //refresh the view below the onboarding panel
        if (["JUST_DONE", "NOT_FOUND"].includes(validationResponse)) {
            this.actionService.restore(this.actionService.currentController.jsId);
        }
    }
    /**
     * Close modal on discard.
     *
     * @override
     */
    async discard() {
        await super.discard();
        this.env.dialogData.close();
    }
}
