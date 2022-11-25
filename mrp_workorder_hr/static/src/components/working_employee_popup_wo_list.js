/** @odoo-module **/

import { MrpTimer } from "@mrp/widgets/timer";
import { browser } from "@web/core/browser/browser";
import { useService } from "@web/core/utils/hooks";

const { Component, useState, onWillStart} = owl;

export class WorkingEmployeePopupWOList extends Component {
    setup() {
        const { origin } = browser.location;
        this.imageBaseURL = `${origin}/web/image?model=hr.employee&field=avatar_128&id=`
        this.employeesData= useState({employees : []})
        this.orm = useService("orm");
        this.firstTime=true;

        onWillStart(async () => {
            await this.onWillStart();
        });
    }

    close() {
        this.props.onClosePopup('WorkingEmployeePopupWOList', true);
    }

    addEmployee() {
        this.props.onAddEmployee();
        this.close();
    }

    lockEmployee(employeeId,pin) {
        this.props.disconnectEmployee(employeeId,pin);
        this.close();
    }

    onWillStart(){
        this.data = [];
        if(!this.props.popupData.employeesConnected)
            return this.employeesData.employees = this.data;

        this.props.popupData.employeesConnected.forEach(emp => {
            this.workorders = [];
            emp.workorder.forEach(wo => {
                this.workorders.push({
                    id : wo.id,
                    name : wo.operation_name + ' - ' + wo.work_order_name,
                    duration : wo.duration,
                    ongoing : wo.ongoing
                })
            });
            this.data.push({
                id: emp.id,
                name: emp.name, 
                // Compute the image src bc t-attf has a latency to load images ?
                src: this.imageBaseURL + `${emp.id}`,
                workorder : this.workorders
            });
        });
        this.employeesData.employees=this.data
        this.firstTime=false;
    }

    get employeesList(){
        return this.props.popupData.list
    }
    get connectedEmployeesList(){
        return this.employeesData.employees;
    }

    async startEmployee(empId, woId){
        // reupdate the time from the ORM
        // useful because of timer onsleep change
        // if not done, bug for now
        // this should be done in the timer??
        const time = await this.orm.call(
            "hr.employee", "get_wo_time_by_employees_ids",[empId,woId],
        );
        this.data.some(emp=>{
            emp.workorder.forEach(wo=>{
                if(wo.id == woId){
                    wo.ongoing = true;
                    wo.duration = time;
                    return true
                }
            })
        })
        this.employeesData.employees = this.data;
        this.props.onStartEmployee(empId,woId)
    }

    stopEmployee(empId, woId){
        this.data.forEach(emp=>{
            emp.workorder.forEach(wo=>{
                if(wo.id == woId)
                    wo.ongoing = false;
            })
        })
        this.employeesData.employees = this.data;
        this.props.onStopEmployee(empId, woId)
    }

    async becomeAdmin(employee_id,pin){
        await this.props.becomeAdmin(employee_id,pin)
        this.close();
    }
}

WorkingEmployeePopupWOList.components = { MrpTimer };
WorkingEmployeePopupWOList.props = {
    popupData: Object,
    onAddEmployee: Function,
    onStartEmployee: Function,
    onStopEmployee: Function,
    onClosePopup: Function,
    becomeAdmin: Function,
};
WorkingEmployeePopupWOList.template = 'mrp_workorder_hr.WorkingEmployeePopupWOList';
