/** @odoo-module */

import { useComponent } from "@odoo/owl";

/**
 * Hook to get the props for the timesheet overtime component use in the
 * timesheet_many2one and timesheet_avatar_many2one components.
 */
export function useTimesheetOvertimeProps() {
    const comp = useComponent();
    return {
        get props() {
            const value = comp.props.record.data[comp.props.name];
            const resId = value && value[0]; // assume the hook is used in many2one component
            if (resId && comp.props.workingHours && resId in comp.props.workingHours) {
                return comp.props.workingHours[resId];
            } else {
                return {};
            }
        },
    };
}
