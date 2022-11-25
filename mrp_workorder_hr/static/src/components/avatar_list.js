/** @odoo-module **/

import { browser } from "@web/core/browser/browser";

const { Component } = owl;

export class AvatarList extends Component {
    setup(){
        const { origin }  = browser.location;
        this.baseURL = `${origin}/web/image?model=hr.employee&field=avatar_128&id=`
    }

    get stringToDiplay(){
        let name = "";
        if (this.props.employees.logged.length > 0){
            name = this.props.employees.logged.length > this.props.visibleAvatarCount ? "" : " " + this.props.employees.logged[this.props.employees.logged.length -1].name;
        }
        return this.props.employees.logged.length > this.props.visibleAvatarCount ? 
            " +".concat((this.props.employees.logged.length - this.props.visibleAvatarCount).toString()).concat(" ").concat(this.props.employees.logged[this.props.employees.logged.length -1].name) 
            : name;
    }

    get avatarsToDisplay(){
        let avatars = this.props.employees.logged.length > this.props.visibleAvatarCount ? this.props.employees.logged.slice(0, this.props.visibleAvatarCount) : this.props.employees.logged ;

        avatars.forEach(av=>{
            av.src = this.baseURL + `${av.id}`
        })
        return avatars
    }
}

AvatarList.props = {
    employees: [Object],
    visibleAvatarCount : Number
};
AvatarList.template = 'mrp_workorder.AvatarList';
